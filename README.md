# Rohan Core Lite — Real Estate Management System
**Round 2 | Full-Stack Developer Coding Assignment**  
*Quotation, Cost Sheet, Booking & Collections Management*

Built with **React 18 + TypeScript**, **Tailwind CSS**, **Node.js + Express**, and **PostgreSQL (Supabase Cloud)**.

---

## 🌟 Table of Contents
1. [Overview & Business Workflow](#overview--business-workflow)
2. [High-Level Design (HLD)](#high-level-design-hld)
3. [Low-Level Design (LLD)](#low-level-design-lld)
   - [Database Entity-Relationship (ER) Schema](#database-entity-relationship-er-schema)
   - [Business Logic & Mathematical Formulations](#business-logic--mathematical-formulations)
   - [ACID Transactions & Concurrency Locking](#acid-transactions--concurrency-locking)
   - [Global Design System & Reusable Components](#global-design-system--reusable-components)
4. [API Contract & Specifications](#api-contract--specifications)
5. [Section 6 Calculation Match](#section-6-calculation-match)
6. [Automated Test Suite (Jest)](#automated-test-suite-jest)
7. [Local Setup & Running Guide](#local-setup--running-guide)
8. [Vercel & Production Hosting Guide](#vercel--production-hosting-guide)

---

## Overview & Business Workflow

Rohan Core Lite automates the commercial real estate sales pipeline across four flagship residential projects: **Rohan Nest**, **Rohan City**, **Rohan Park**, and **Rohan Estate**.

$$\mathbf{Inventory \ (12 \ Units)} \longrightarrow \mathbf{Cost \ Sheet} \longrightarrow \mathbf{Quotation} \longrightarrow \mathbf{Booking} \longrightarrow \mathbf{Milestone \ Collections}$$

### Key Modules:
- **Executive Analytics Dashboard**: Real-time KPI counters for unit inventory, booked values, milestone collections, outstanding balances, and recent audit trails.
- **Project & Unit Inventory**: 12 pre-seeded units with dual Grid/Table view, multi-attribute filtering (Project, BHK, Availability), debounced search, and pagination.
- **Customer CRM**: Full lifecycle management (Add, Edit, Search) with 10-digit mobile uniqueness enforcement and RFC-compliant email validation.
- **Cost Sheet Engine**: Real-time discount calculation capped at **2.00% maximum** per Rohan Corporation policy, itemized pricing summary, and printable PDF view.
- **Quotation Lifecycle**: Generated from saved cost sheets with auto-expiring 7-day validity, status progression (`Draft` $\to$ `Sent` $\to$ `Accepted` $\to$ `Expired`), and printable quotation documents.
- **Booking & Milestone Engine**: Concurrency-safe booking confirmation (`SELECT ... FOR UPDATE`), automatic 10%/20%/30%/40% milestone schedule creation, partial milestone payments, and overpayment rejections.

---

## High-Level Design (HLD)

### System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Layer (React 18 + Vite SPA)"]
        UI["UI Pages (Dashboard, Inventory, CostSheets, Quotations, Bookings, Collections)"]
        GlobalComps["Reusable Common UI (SearchInput, Button, InputField, SelectField, Pagination, Badge)"]
        AppContext["React Context (State, Memoized Actions, Toast Notifications)"]
        APIClient["API Client (Fetch API + Debouncing + Token Support)"]
    end

    subgraph ServerLayer["Backend API Layer (Node.js + Express + TypeScript)"]
        Middlewares["Security Middlewares (Helmet, CORS, Rate Limiters, Request Validation)"]
        Routes["REST Endpoints (/api/units, /api/customers, /api/cost-sheets, /api/quotations, /api/bookings, /api/payments)"]
        Controllers["Domain Controllers (Business Rules, 2% Discount Cap, 7-Day Validity)"]
        DBPool["PostgreSQL Connection Pool (pg Pool with SSL)"]
    end

    subgraph DataLayer["Persistence Layer (Supabase PostgreSQL Cloud)"]
        UnitsTable[("units")]
        CustomersTable[("customers")]
        CostSheetsTable[("cost_sheets")]
        QuotationsTable[("quotations")]
        BookingsTable[("bookings")]
        MilestonesTable[("milestones")]
        PaymentsTable[("payments")]
    end

    UI --> GlobalComps
    GlobalComps --> AppContext
    AppContext --> APIClient
    APIClient -->|HTTPS / REST| Middlewares
    Middlewares --> Routes
    Routes --> Controllers
    Controllers --> DBPool
    DBPool -->|ACID SQL & Row Locks| DataLayer
```

### End-to-End Business Sequence

```mermaid
sequenceDiagram
    autonumber
    actor SalesAgent as Sales Agent / Admin
    participant Client as Frontend (React SPA)
    participant API as Backend (Express REST API)
    participant DB as PostgreSQL (Supabase)

    SalesAgent->>Client: Selects Unit & Customer, enters Discount (max 2%)
    Client->>API: POST /api/cost-sheets {unitId, customerId, discountPercentage}
    API->>DB: Validates unit AVAILABLE & saves Cost Sheet
    DB-->>API: Cost Sheet Created
    API-->>Client: Returns Cost Sheet (Saved with fixed prices)

    SalesAgent->>Client: Clicks "Convert to Quotation"
    Client->>API: POST /api/quotations {costSheetId}
    API->>DB: Generates unique QUO-XXXXXX, status: DRAFT, validity: 7 days
    DB-->>API: Quotation Created
    API-->>Client: Returns Quotation

    SalesAgent->>Client: Marks Quotation as ACCEPTED
    Client->>API: PATCH /api/quotations/:id/status {status: "ACCEPTED"}
    API->>DB: Updates status to ACCEPTED
    DB-->>API: Success

    SalesAgent->>Client: Confirms Booking
    Client->>API: POST /api/bookings {quotationId}
    API->>DB: BEGIN Transaction -> SELECT unit FOR UPDATE
    Note over API,DB: Locks unit row; verifies Quotation is ACCEPTED & unit AVAILABLE
    API->>DB: UPDATE units SET status = 'BOOKED'
    API->>DB: INSERT bookings
    API->>DB: INSERT 4 milestones (10%, 20%, 30%, 40%)
    API->>DB: COMMIT Transaction
    DB-->>API: Booking & Milestones Created
    API-->>Client: Returns Booking Details

    SalesAgent->>Client: Records Milestone Payment
    Client->>API: POST /api/payments {bookingId, milestoneId, amount, paymentReference}
    API->>DB: BEGIN Transaction -> SELECT milestone FOR UPDATE
    Note over API,DB: Validates amount <= remaining balance & reference is unique
    API->>DB: INSERT payments
    API->>DB: UPDATE milestones (decrease balance)
    API->>DB: COMMIT Transaction
    DB-->>API: Payment Recorded
    API-->>Client: Returns Updated Milestone Balance & Receipt
```

---

## Low-Level Design (LLD)

### Database Entity-Relationship (ER) Schema

```mermaid
erDiagram
    units ||--o{ cost_sheets : "referenced in"
    customers ||--o{ cost_sheets : "prepared for"
    cost_sheets ||--o{ quotations : "generates"
    customers ||--o{ quotations : "issued to"
    units ||--o{ quotations : "quotes"
    quotations ||--o| bookings : "confirmed as"
    customers ||--o{ bookings : "booked by"
    units ||--o| bookings : "booked unit"
    bookings ||--|{ milestones : "divided into 4"
    bookings ||--o{ payments : "receives"
    milestones ||--o{ payments : "credited to"

    units {
        int id PK
        varchar project_name
        varchar unit_number UK
        varchar bhk_type
        int area_sqft
        numeric listed_price
        varchar status "AVAILABLE | BOOKED"
        timestamp created_at
    }

    customers {
        int id PK
        varchar name
        varchar mobile UK "10 digits"
        varchar email
        timestamp created_at
    }

    cost_sheets {
        int id PK
        varchar cost_sheet_number UK
        int unit_id FK
        int customer_id FK
        numeric listed_price
        numeric discount_percentage "CHECK 0.00 to 2.00"
        numeric discount_amount
        numeric final_offered_price
        timestamp created_at
    }

    quotations {
        int id PK
        varchar quotation_number UK
        int cost_sheet_id FK
        int customer_id FK
        int unit_id FK
        numeric listed_price
        numeric discount_percentage
        numeric discount_amount
        numeric final_offered_price
        varchar status "DRAFT | SENT | ACCEPTED | EXPIRED"
        timestamp validity_date "created_at + 7 days"
        timestamp created_at
    }

    bookings {
        int id PK
        varchar booking_number UK
        int quotation_id FK
        int customer_id FK
        int unit_id FK
        numeric booking_amount
        numeric total_amount
        varchar status "CONFIRMED | CANCELLED"
        timestamp booking_date
    }

    milestones {
        int id PK
        int booking_id FK
        varchar milestone_name "Booking | Foundation | Structure | Handover"
        numeric percentage "10 | 20 | 30 | 40"
        numeric amount
        numeric paid_amount
        numeric balance_amount
        varchar status "PENDING | PARTIALLY_PAID | COMPLETED"
    }

    payments {
        int id PK
        int booking_id FK
        int milestone_id FK
        numeric amount
        varchar payment_method
        varchar payment_reference UK
        date payment_date
        timestamp created_at
    }
```

### Business Logic & Mathematical Formulations

#### 1. Strictly Bounded Discount (0.00% – 2.00%)
Rohan Corporation policy mandates that commercial sales discounts must never exceed **2.00%**.
$$\text{Discount Amount} = \text{round}\left(\text{Listed Price} \times \frac{\text{Discount \%}}{100}, 2\right)$$
$$\text{Final Offered Price} = \text{Listed Price} - \text{Discount Amount}$$
* **Backend Validation**: Zod schema and PostgreSQL `CHECK (discount_percentage >= 0 AND discount_percentage <= 2)` reject any value outside $[0.00, 2.00]$ with `400 Bad Request`.
* **Frontend Clamping**: Real-time slider and numeric inputs automatically clamp manual user inputs $> 2.0\%$ to `2.0%` with an explanatory policy warning.

#### 2. Automatic Milestone Schedule (10% / 20% / 30% / 40%)
Upon booking confirmation, four immutable milestones are computed from the accepted final price:
* **Booking Milestone (10%)**: $\text{Final Price} \times 0.10$
* **Foundation Milestone (20%)**: $\text{Final Price} \times 0.20$
* **Structure Milestone (30%)**: $\text{Final Price} \times 0.30$
* **Handover Milestone (40%)**: $\text{Final Price} \times 0.40$
$$\sum \text{Milestone Percentages} = 10\% + 20\% + 30\% + 40\% = 100\%$$

#### 3. Overpayment Prevention with Fractional Paise Handling
* Every incoming payment is checked against the target milestone's remaining balance:
$$\text{Payment Amount} \le \text{Milestone Balance} + \epsilon \quad (\epsilon = 0.005)$$
* Overpayments trigger an explicit `400 Bad Request` rejection with the exact maximum payable balance in the response message.
* If a balance drops below ₹0.005 due to floating-point division, it is automatically reconciled to ₹0.00 and marked `COMPLETED`.

### ACID Transactions & Concurrency Locking

To prevent race conditions where two sales agents attempt to book the same property unit simultaneously:
```sql
BEGIN;
-- Lock the unit record across concurrent threads
SELECT * FROM units WHERE id = $1 FOR UPDATE;

-- Verify the unit is currently AVAILABLE
-- If status is already BOOKED, roll back and return 409 Conflict

-- Update unit status atomically
UPDATE units SET status = 'BOOKED' WHERE id = $1;

-- Create Booking & 4 Milestone Records
INSERT INTO bookings (...) VALUES (...);
INSERT INTO milestones (...) VALUES (...);

COMMIT;
```

Similarly, milestone payments use `SELECT * FROM milestones WHERE id = $1 FOR UPDATE` within an isolated transaction to prevent race conditions during concurrent partial payments.

### Global Design System & Reusable Components

All UI elements are unified under `client/src/components/common/` and styled with centralized tokens in `client/src/constants/theme.ts`:
- **[`SearchInput`](client/src/components/common/SearchInput.tsx)**: Debounced search with leading icon and one-click clear button.
- **[`Pagination`](client/src/components/common/Pagination.tsx)**: Page numbering, ellipsis support, row selector, and entry indicators.
- **[`Button`](client/src/components/common/Button.tsx)**: Standardized variants (`primary`, `secondary`, `success`, `danger`, `outline`, `ghost`) and loading spinners.
- **[`Badge`](client/src/components/common/Badge.tsx)**: High-contrast status pills for unit availability, booking state, and quotations.
- **[`InputField`](client/src/components/common/InputField.tsx)** & **[`SelectField`](client/src/components/common/SelectField.tsx)**: Accessible form controls with validation states.

---

## API Contract & Specifications

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | `200` |
| `GET` | `/api/dashboard/stats` | Aggregate dashboard KPIs and collection metrics | `200`, `500` |
| `GET` | `/api/units` | List units (query by `project`, `bhk`, `status`) | `200`, `500` |
| `GET` | `/api/customers` | Search & list customer CRM records | `200`, `500` |
| `POST`| `/api/customers` | Register customer with 10-digit mobile check | `201`, `400`, `409` |
| `PUT` | `/api/customers/:id` | Update existing customer details | `200`, `400`, `404` |
| `POST`| `/api/cost-sheets` | Create cost sheet (validates 0%–2% discount cap) | `201`, `400`, `404` |
| `GET` | `/api/cost-sheets` | Fetch historical saved cost sheets | `200`, `500` |
| `POST`| `/api/quotations` | Generate quotation from cost sheet (7-day validity)| `201`, `400`, `404` |
| `GET` | `/api/quotations` | List all quotations and validity statuses | `200`, `500` |
| `PATCH`| `/api/quotations/:id/status`| Transition quotation state (`SENT`, `ACCEPTED`, etc.) | `200`, `400`, `404` |
| `POST`| `/api/bookings` | Confirm booking (requires ACCEPTED quotation & locks unit)| `201`, `400`, `409` |
| `GET` | `/api/bookings` | List all confirmed bookings with milestones | `200`, `500` |
| `GET` | `/api/bookings/:id` | Detailed booking view with milestone ledger | `200`, `404` |
| `POST`| `/api/payments` | Record milestone payment (validates balance & reference)| `201`, `400`, `409` |
| `GET` | `/api/payments` | Full payments audit history | `200`, `500` |

---

## Section 6 Calculation Match

The business engine matches the assignment mandatory test vector to the exact rupee:

* **Unit**: `RN-101` (Rohan Nest, 2 BHK, 1,100 sq ft)
* **Listed Price**: ₹68,00,000
* **Discount (1%)**: ₹68,000
* **Final Offered / Accepted Price**: **₹67,32,000**
* **Milestone Distribution**:
  - Booking (10%): **₹6,73,200**
  - Foundation (20%): **₹13,46,400**
  - Structure (30%): **₹20,19,600**
  - Handover (40%): **₹26,92,800**
* **After Partial Payment of ₹5,00,000 against Booking Milestone**:
  - **Booking Milestone Balance**: ₹6,73,200 − ₹5,00,000 = **₹1,73,200**
  - **Overall Outstanding**: ₹67,32,000 − ₹5,00,000 = **₹62,32,000**

---

## Automated Test Suite (Jest)

The project includes an end-to-end integration test suite verifying every mandatory policy rule against the live database:

```bash
cd server
npm test
```

### Verified Test Scenarios (10/10 Passing):
```
PASS  src/tests/assignment.test.ts
  Rohan Core Lite - Mandatory Assessment Test Suite
    1. Cost-Sheet Discount Policy Validation
      ✓ should REJECT a discount greater than 2% (e.g., 2.5%) with 400 Bad Request
      ✓ should REJECT a negative discount with 400 Bad Request
      ✓ should ACCEPT a valid 1% discount and calculate exact formula matching Section 6
    2. Quotation Status & Expiry Lifecycle
      ✓ should create quotation with default status DRAFT and 7-day validity
      ✓ should REJECT booking confirmation if quotation is in DRAFT or SENT status
      ✓ should allow booking ONLY after quotation status is marked ACCEPTED
    3. Concurrency & Duplicate Booking Protection
      ✓ should REJECT attempting to book an already sold unit with 409 Conflict
    4. Milestone Overpayment Rejection
      ✓ should REJECT payment that exceeds the milestone remaining balance with 400 Bad Request
      ✓ should ACCEPT partial payment and correctly decrease milestone balance
    5. Duplicate Payment Reference Rejection
      ✓ should REJECT a payment with an already-used payment reference with 409 Conflict

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        32.053 s
```

---

## Local Setup & Running Guide

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- PostgreSQL database (or use pre-configured Supabase instance)

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/789Abhi/Rohan-Tech-Assesment.git
cd Rohan-Tech-Assesment

# Install dependencies
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root:
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:your_password@db.your_project.supabase.co:5432/postgres
CLIENT_URL=http://localhost:5173
```

### 3. Seed Database
```bash
npm run seed
```

### 4. Run Development Servers
```bash
# Start both client and server concurrently
npm run dev
```
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/health`

---

## Vercel & Production Hosting Guide

You can host the **Frontend (Vite SPA)** on **Vercel** and the **Backend (Express)** on **Render, Railway, or Vercel Serverless Functions**.

### Option A: Hosting Frontend on Vercel (Recommended)

1. **Import Repository in Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Select `789Abhi/Rohan-Tech-Assesment`.
2. **Project Settings**:
   - **Root Directory**: Select `client` (or leave as root with build command targeting `client`).
   - **Framework Preset**: `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. **Environment Variables to add in Vercel Dashboard**:

| Variable Name | Required? | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** (in production) | `https://rohan-core-backend.onrender.com` | URL of your deployed backend service. |
| `VITE_SUPABASE_URL` | Optional | `https://owuckxdhfrepjbelfxqu.supabase.co` | Supabase Cloud API URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | `sb_publishable_...` | Supabase Public Anonymous API Key. |

*(Note: The repository includes a pre-configured [`client/vercel.json`](client/vercel.json) ensuring all SPA sub-routes route to `index.html` without 404 errors).*

---

### Option B: Hosting Backend on Render / Railway

Deploy the `server` directory on Render or Railway with the following environment variables:

| Variable Name | Required? | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:...@db....supabase.co:5432/postgres` | PostgreSQL connection string. |
| `CLIENT_URL` | **Yes** | `https://rohan-tech-assesment.vercel.app` | Frontend Vercel URL for CORS origin validation. |
| `PORT` | Auto | `5000` or assigned by platform | Listening port. |
| `NODE_ENV` | **Yes** | `production` | Production environment flag. |

---

## 📄 License
Assessment submission for Rohan Corporation. Built for evaluation purposes.
