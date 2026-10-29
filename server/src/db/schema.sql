-- ==============================================================================
-- Rohan Core Lite: PostgreSQL Database Schema
-- Modules: Inventory, Customers, Cost Sheet, Quotations, Bookings, Collections
-- ==============================================================================

-- Drop tables if needed in reverse dependency order
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS payment_milestones CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS cost_sheets CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS units CASCADE;

-- Drop Enums if needed
DROP TYPE IF EXISTS unit_status CASCADE;
DROP TYPE IF EXISTS quotation_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS milestone_name CASCADE;
DROP TYPE IF EXISTS milestone_status CASCADE;

-- 1. ENUMS
CREATE TYPE unit_status AS ENUM ('AVAILABLE', 'BOOKED');
CREATE TYPE quotation_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED');
CREATE TYPE booking_status AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE milestone_name AS ENUM ('BOOKING', 'FOUNDATION', 'STRUCTURE', 'HANDOVER');
CREATE TYPE milestone_status AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID');

-- 2. UNITS TABLE (Inventory: Fixed 12 Units)
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    unit_number VARCHAR(50) UNIQUE NOT NULL,
    bhk_type VARCHAR(20) NOT NULL,
    area_sqft INT NOT NULL CHECK (area_sqft > 0),
    listed_price NUMERIC(14, 2) NOT NULL CHECK (listed_price > 0),
    status unit_status NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_units_project ON units(project_name);
CREATE INDEX idx_units_bhk ON units(bhk_type);
CREATE INDEX idx_units_status ON units(status);

-- 3. CUSTOMERS TABLE
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(10) UNIQUE NOT NULL CHECK (mobile ~ '^[0-9]{10}$'),
    email VARCHAR(150) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_customers_name ON customers(name);

-- 4. COST SHEETS TABLE (Historical Snapshot with 0% - 2% Discount Cap)
CREATE TABLE cost_sheets (
    id SERIAL PRIMARY KEY,
    cost_sheet_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    unit_id INT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    listed_price NUMERIC(14, 2) NOT NULL CHECK (listed_price > 0),
    discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0.00 AND discount_percentage <= 2.00),
    discount_amount NUMERIC(14, 2) NOT NULL CHECK (discount_amount >= 0.00),
    final_offered_price NUMERIC(14, 2) NOT NULL CHECK (final_offered_price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cost_sheets_customer ON cost_sheets(customer_id);
CREATE INDEX idx_cost_sheets_unit ON cost_sheets(unit_id);

-- 5. QUOTATIONS TABLE (7 Days Validity, Status Lifecycle)
CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    cost_sheet_id INT NOT NULL REFERENCES cost_sheets(id) ON DELETE RESTRICT,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    unit_id INT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    listed_price NUMERIC(14, 2) NOT NULL,
    discount_amount NUMERIC(14, 2) NOT NULL,
    final_offered_price NUMERIC(14, 2) NOT NULL,
    status quotation_status NOT NULL DEFAULT 'DRAFT',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_valid_until ON quotations(valid_until);

-- 6. BOOKINGS TABLE
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id INT UNIQUE NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    unit_id INT UNIQUE NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    agreed_price NUMERIC(14, 2) NOT NULL CHECK (agreed_price > 0),
    status booking_status NOT NULL DEFAULT 'CONFIRMED',
    booking_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_unit ON bookings(unit_id);

-- 7. PAYMENT MILESTONES TABLE (10%, 20%, 30%, 40%)
CREATE TABLE payment_milestones (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    name milestone_name NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL CHECK (percentage > 0),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0.00),
    balance_amount NUMERIC(14, 2) NOT NULL CHECK (balance_amount >= 0.00),
    status milestone_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_booking_milestone UNIQUE (booking_id, name)
);

CREATE INDEX idx_milestones_booking ON payment_milestones(booking_id);

-- 8. PAYMENTS TABLE (Collections & Receipt Audit)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    milestone_id INT NOT NULL REFERENCES payment_milestones(id) ON DELETE RESTRICT,
    payment_reference VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_milestone ON payments(milestone_id);
CREATE INDEX idx_payments_reference ON payments(payment_reference);
