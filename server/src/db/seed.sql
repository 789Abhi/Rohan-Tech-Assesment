-- ==============================================================================
-- Seed Script: 12 Fixed Inventory Units & Sample Customers for Rohan Core Lite
-- ==============================================================================

-- Clear existing data if reseeding
TRUNCATE TABLE payments, payment_milestones, bookings, quotations, cost_sheets, customers, units RESTART IDENTITY CASCADE;

-- 1. Insert 12 Units Exactly as per Assignment Table
INSERT INTO units (project_name, unit_number, bhk_type, area_sqft, listed_price, status) VALUES
('Rohan Nest', 'RN-101', '2 BHK', 1100, 6800000.00, 'AVAILABLE'),
('Rohan Nest', 'RN-201', '3 BHK', 1450, 8800000.00, 'AVAILABLE'),
('Rohan Nest', 'RN-301', '3 BHK', 1500, 9200000.00, 'AVAILABLE'),
('Rohan City', 'RC-101', '1 BHK', 750, 4500000.00, 'AVAILABLE'),
('Rohan City', 'RC-202', '2 BHK', 1150, 6600000.00, 'AVAILABLE'),
('Rohan City', 'RC-303', '3 BHK', 1520, 9100000.00, 'AVAILABLE'),
('Rohan Park', 'RP-102', '2 BHK', 1200, 7500000.00, 'AVAILABLE'),
('Rohan Park', 'RP-204', '3 BHK', 1550, 9800000.00, 'AVAILABLE'),
('Rohan Park', 'RP-305', '3 BHK', 1650, 10600000.00, 'AVAILABLE'),
('Rohan Estate', 'RE-101', '2 BHK', 1180, 7900000.00, 'AVAILABLE'),
('Rohan Estate', 'RE-202', '3 BHK', 1500, 10200000.00, 'AVAILABLE'),
('Rohan Estate', 'RE-304', '3 BHK', 1750, 11600000.00, 'AVAILABLE');

-- 2. Insert Sample Customers for Immediate Testing
INSERT INTO customers (name, mobile, email) VALUES
('Suresh Kamath', '9845123456', 'suresh.kamath@gmail.com'),
('Priya Shenoy', '9880198765', 'priya.shenoy@outlook.com'),
('Vikram Shetty', '9900112233', 'vikram.shetty@yahoo.co.in');
