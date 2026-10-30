# Rohan Core Lite — Real Estate Management System
**Round 2 | Full-Stack Developer Coding Assignment**  
*Quotation, Cost Sheet, Booking & Collections Management*

Live Demo: [https://rohan-tech-assesment-zeta.vercel.app](https://rohan-tech-assesment-zeta.vercel.app)  
Repository: [https://github.com/789Abhi/Rohan-Tech-Assesment](https://github.com/789Abhi/Rohan-Tech-Assesment)

Built with **React 19 + TypeScript**, **Tailwind CSS v4**, **Node.js + Express**, and **PostgreSQL (Supabase Cloud)**. Unified monorepo hosted 100% on **Vercel** (Vite SPA + Serverless Functions).

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
8. [Vercel Production Hosting Architecture](#vercel-production-hosting-architecture)

---

## Overview & Business Workflow

Rohan Core Lite automates the commercial real estate sales pipeline across four flagship residential projects: **Rohan Nest**, **Rohan City**, **Rohan Park**, and **Rohan Estate**.

$$\mathbf{Inventory \ (12 \ Units)} \longrightarrow \mathbf{Cost \ Sheet} \longrightarrow \mathbf{Quotation} \longrightarrow \mathbf{Booking} \longrightarrow \mathbf{Milestone \ Collections}$$

### Key Modules:
- **Executive Analytics Dashboard**: Real-time KPI counters for unit inventory, booked values, milestone collections, outstanding balances, and recent audit trails.
- **Project & Unit Inventory**: 12 pre-seeded units with dual Grid/Table view, multi-attribute filtering (Project, BHK, Availability), debounced search, and pagination.
- **Customer CRM**: Full lifecycle management (Add, Edit, Safe Delete, Search) with 10-digit mobile uniqueness enforcement, RFC-compliant email validation, and transaction protection guards.
- **Cost Sheet Engine**: Real-time discount calculation capped at **2.00% maximum** per Rohan Corporation policy, itemized pricing summary, and printable PDF view.
- **Quotation Lifecycle**: Generated from saved cost sheets with auto-expiring 7-day validity, status progression (`Draft` $\to$ `Sent` $\to$ `Accepted` $\to$ `Expired`), and printable quotation documents.
- **Booking & Milestone Engine**: Concurrency-safe booking confirmation (`SELECT ... FOR UPDATE`), automatic 10%/20%/30%/40% milestone schedule creation, partial milestone payments, and overpayment rejections.

---

## High-Level Design (HLD)

### System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Layer (React 19 + Vite SPA)"]
        UI["UI Pages (Dashboard, Inventory, Customers, CostSheets, Quotations, Bookings, Collections)"]
        GlobalComps["Reusable Common UI (SearchInput, Button, InputField, SelectField, Pagination, Badge)"]
        AppContext["React Context (State, Memoized Actions, Toast Notifications)"]
        APIClient["API Client (Fetch API + Vite Proxy + Relative Routing)"]
    end

    subgraph ServerLayer["Backend API Layer (Vercel Serverless Function & Express)"]
        Middlewares["Security Middlewares (Helmet, CORS, Trust Proxy, Rate Limiters, Zod Validation)"]
        Routes["REST Endpoints (/api/units, /api/customers, /api/cost-sheets, /api/quotations, /api/bookings, /api/payments)"]
        Controllers["Domain Controllers (Business Rules, 2% Discount Cap, 7-Day Validity, Concurrency Locks)"]
        DBPool["PostgreSQL Connection Pool (pg Pool with SSL to Supabase Pooler)"]
    end

    subgraph DataLayer["Persistence Layer (Supabase PostgreSQL Cloud)"]
        UnitsTable[("units (12 Units)")]
        CustomersTable[("customers")]
        CostSheetsTable[("cost_sheets")]
        QuotationsTable[("quotations")]
        BookingsTable[("bookings")]
        MilestonesTable[("payment_milestones")]
        PaymentsTable[("payments")]
    end

    UI --> GlobalComps
    GlobalComps --> AppContext
    AppContext --> APIClient
    APIClient -->|HTTPS /api/*| Middlewares
    Middlewares --> Routes
    Routes --> Controllers
    Controllers --> DBPool
    DBPool -->|IPv4 Transaction Pooler Port 6543| DataLayer
```

### End-to-End Quotation-to-Booking Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor SalesAgent as Sales Agent
    participant Client as React 19 Frontend
    participant API as Express Serverless API
    participant DB as Supabase PostgreSQL

    SalesAgent->>Client: Selects Unit & Customer, enters Discount (max 2%)
    Client->>API: POST /api/cost-sheets {unitId, customerId, discountPercentage}
    API->>DB: Validates unit is AVAILABLE & saves Cost Sheet
    DB-->>API: Cost Sheet Created
    API-->>Client: Returns Cost Sheet (Section 6 exact calculation)

    SalesAgent->>Client: Clicks "Generate Quotation"
    Client->>API: POST /api/quotations {costSheetId}
    API->>DB: Inserts Quotation (status: DRAFT, expires_at: NOW() + 7 days)
    DB-->>API: Quotation Created
    API-->>Client: Returns Quotation with 7-day validity countdown

    SalesAgent->>Client: Marks Quotation as ACCEPTED
    Client->>API: PATCH /api/quotations/:id/status {status: "ACCEPTED"}
    API->>DB: Updates status to ACCEPTED
    DB-->>API: Updated
    API-->>Client: Status confirmed

    SalesAgent->>Client: Confirms Booking
    Client->>API: POST /api/bookings {quotationId}
    Note over API,DB: BEGIN TRANSACTION (SERIALIZABLE)
    API->>DB: SELECT status FROM units WHERE id = unit_id FOR UPDATE
    alt Unit Already Booked
        API-->>Client: 409 Conflict ("Unit already booked")
    else Unit Available
        API->>DB: UPDATE units SET status = 'BOOKED'
        API->>DB: INSERT INTO bookings ...
        API->>DB: INSERT INTO payment_milestones (4 milestones: 10%, 20%, 30%, 40%)
        Note over API,DB: COMMIT TRANSACTION
        API-->>Client: 201 Created (Booking Confirmed & Schedule Generated)
    end

    SalesAgent->>Client: Records Milestone Payment
    Client->>API: POST /api/payments {milestoneId, amount, paymentReference}
    Note over API,DB: BEGIN TRANSACTION
    API->>DB: SELECT balance_amount FROM payment_milestones WHERE id = milestone_id FOR UPDATE
    alt Payment exceeds remaining milestone balance
        API-->>Client: 400 Bad Request ("Overpayment rejected")
    else Valid Payment Amount
        API->>DB: INSERT INTO payments ...
        API->>DB: UPDATE payment_milestones (decrement balance, update status)
        Note over API,DB: COMMIT TRANSACTION
        API-->>Client: 201 Created (Payment recorded, ledger updated)
    end
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
    bookings ||--|{ payment_milestones : "divided into 4"
    payment_milestones ||--o{ payments : "collected against"

    units {
        int id PK
        varchar project_name
        varchar unit_number UK
        varchar bhk_type
        int area_sqft
        numeric listed_price
        unit_status status "AVAILABLE | BOOKED"
        timestamp created_at
    }

    customers {
        int id PK
        varchar name
        varchar mobile UK "10 Digits"
        varchar email
        timestamp created_at
    }

    cost_sheets {
        int id PK
        int unit_id FK
        int customer_id FK
        numeric listed_price
        numeric discount_percentage "CHECK 0.00 to 2.00"
        numeric discount_amount
        numeric final_amount
        timestamp created_at
    }

    quotations {
        int id PK
        int cost_sheet_id FK
        int customer_id FK
        int unit_id FK
        numeric listed_price
        numeric discount_percentage
        numeric final_amount
        quotation_status status "DRAFT | SENT | ACCEPTED | EXPIRED"
        timestamp expires_at "NOW() + 7 days"
        timestamp created_at
    }

    bookings {
        int id PK
        int quotation_id FK
        int customer_id FK
        int unit_id FK
        numeric booking_amount
        numeric total_amount
        booking_status status "CONFIRMED | CANCELLED"
        timestamp booking_date
    }

    payment_milestones {
        int id PK
        int booking_id FK
        milestone_name milestone_name "BOOKING(10%) | FOUNDATION(20%) | STRUCTURE(30%) | HANDOVER(40%)"
        numeric percentage
        numeric milestone_amount
        numeric paid_amount
        numeric balance_amount
        milestone_status status "PENDING | PARTIALLY_PAID | PAID"
    }

    payments {
        int id PK
        int milestone_id FK
        numeric amount
        timestamp payment_date
        varchar payment_reference UK
        varchar payment_mode "NEFT | RTGS | CHEQUE | UPI | CARD"
    }
```

### Business Logic & Mathematical Formulations

#### 1. Cost Sheet Discount Engine
Per Rohan Corporation policy, discounts are capped at **2.00%**:

$$\text{Discount Amount} = \text{Listed Price} \times \left( \frac{\text{Discount Percentage}}{100} \right)$$
$$\text{Final Offered Price} = \text{Listed Price} - \text{Discount Amount}$$

*If $\text{Discount Percentage} > 2.00\%$ or $< 0\%$, the server rejects the request with HTTP `400 Bad Request` and the database constraint `chk_cost_sheet_discount` rejects it.*

#### 2. Milestone Payment Schedule
Upon booking creation, the system calculates 4 non-negotiable payment milestones:
1. **Booking (10%)**: $\text{Final Price} \times 0.10$
2. **Foundation (20%)**: $\text{Final Price} \times 0.20$
3. **Structure (30%)**: $\text{Final Price} \times 0.30$
4. **Handover (40%)**: $\text{Final Price} \times 0.40$

$$\sum_{i=1}^{4} \text{Milestone Amount}_i = \text{Final Offered Price} \quad (\text{Exact Rupee Reconciliation})$$

#### 3. Overpayment Rejection & Partial Payments
Payments are recorded per milestone. When a payment of amount `P` is attempted:
* If `P > balance_amount`, the transaction is aborted with HTTP `400 Bad Request`:  
  *"Payment of ₹X exceeds remaining milestone balance of ₹Y."*
* If `P <= balance_amount`:
  * `paid_amount = paid_amount + P`
  * `balance_amount = balance_amount - P`
  * `status = PAID` if `balance_amount == 0` else `PARTIALLY_PAID`

### ACID Transactions & Concurrency Locking

To prevent race conditions where two sales agents attempt to book the same unit simultaneously:

```sql
BEGIN;
-- Pessimistic row-level lock on the unit
SELECT id, status FROM units WHERE id = $1 FOR UPDATE;

-- Validate unit availability
-- If status != 'AVAILABLE' -> ROLLBACK & Throw Conflict

UPDATE units SET status = 'BOOKED' WHERE id = $1;
INSERT INTO bookings (...) VALUES (...);
INSERT INTO payment_milestones (...) VALUES (...);
COMMIT;
```

---

## API Contract & Specifications

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint | `200` |
| `GET` | `/api/dashboard/stats` | Executive KPI counter aggregation | `200`, `500` |
| `GET` | `/api/units` | List units (query by `project`, `bhk`, `status`) | `200`, `500` |
| `GET` | `/api/units/:id` | Get unit details by ID | `200`, `404` |
| `GET` | `/api/customers` | Search & list customer CRM records | `200`, `500` |
| `POST`| `/api/customers` | Register customer with 10-digit mobile uniqueness | `201`, `400`, `409` |
| `PUT` | `/api/customers/:id` | Update existing customer details | `200`, `400`, `404` |
| `DELETE`| `/api/customers/:id` | Safe delete customer (guarded against transactions) | `200`, `404`, `409` |
| `POST`| `/api/cost-sheets` | Create cost sheet (validates 0%-2% discount cap) | `201`, `400`, `404` |
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

The business engine matches the assignment test vector to the exact rupee:

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
npm test
```

### Verified Test Scenarios (10/10 Passing):
```
PASS  server/src/tests/assignment.test.ts
  Rohan Core Lite - Mandatory Assessment Test Suite
    1. Cost-Sheet Discount Policy Validation
      √ should REJECT a discount greater than 2% (e.g., 2.5%) with 400 Bad Request
      √ should REJECT a negative discount with 400 Bad Request
      √ should ACCEPT a valid 1% discount and calculate exact formula matching Section 6
    2. Quotation Status & Expiry Lifecycle
      √ should create quotation with default status DRAFT and 7-day validity
      √ should REJECT booking confirmation if quotation is in DRAFT or SENT status
      √ should allow booking ONLY after quotation status is marked ACCEPTED
    3. Concurrency & Duplicate Booking Protection
      √ should REJECT attempting to book an already sold unit with 409 Conflict
    4. Milestone Overpayment Rejection
      √ should REJECT payment that exceeds the milestone remaining balance with 400 Bad Request
      √ should ACCEPT partial payment and correctly decrease milestone balance
    5. Duplicate Payment Reference Rejection
      √ should REJECT a payment with an already-used payment reference with 409 Conflict

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        26.444 s
```

---

## Local Setup & Running Guide

The project is structured as a **unified root monorepo** with a single `package.json` and a single `node_modules` directory.

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/789Abhi/Rohan-Tech-Assesment.git
cd Rohan-Tech-Assesment

# Install all frontend and backend dependencies in one command
npm install
```

### 2. Configure Environment Variables
Create a `.env` file at the root directory:
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres.owuckxdhfrepjbelfxqu:4K5FTP70k7hUBTTZ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
CLIENT_URL=http://localhost:5173
```

### 3. Reset & Seed the Database (Optional)
To reset tables and populate the 12 default units and demo customers:
```bash
npm run seed
```

### 4. Run Development Servers (Single Command)
```bash
npm run dev
```

This concurrently starts:
- **Express Backend API**: `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`)
- **Vite React Frontend**: `http://localhost:5173` (Proxies all `/api/*` requests to port `5000`)

---

## Vercel Production Hosting Architecture

Both Frontend and Backend are hosted **together on Vercel** under a single project deployment:

- **Frontend**: Built via Vite into `dist/` and served as a high-performance static SPA.
- **Backend API**: [`api/index.ts`](api/index.ts) executes as a Vercel Serverless Function handling all `/api/*` traffic.
- **Rewrites (`vercel.json`)**:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "rewrites": [
      {
        "source": "/api/(.*)",
        "destination": "/api"
      },
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

### Required Environment Variables in Vercel:

| Variable Name | Type | Value | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Secret** | `postgresql://postgres.owuckxdhfrepjbelfxqu:4K5FTP70k7hUBTTZ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres` | Supabase IPv4 Pooler URL (Port 6543, region `eu-west-1`). |
| `NODE_ENV` | **Config** | `production` | Production environment flag. |
| `VITE_SUPABASE_URL` | **Config** | `https://owuckxdhfrepjbelfxqu.supabase.co` | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Config** | `sb_publishable_...` | Supabase publishable anonymous key. |

---

## 📄 License
Assessment submission for Rohan Corporation. Built for evaluation purposes.
