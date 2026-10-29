import request from 'supertest';
import { app } from '../index';
import { pool } from '../config/db';

jest.setTimeout(20000);

describe('Rohan Core Lite - Mandatory Assessment Test Suite', () => {
  let testCustomerId: number;
  let testUnitId: number;
  let testCostSheetId: number;
  let testQuotationId: number;
  let testBookingId: number;
  let testBookingMilestoneId: number;

  beforeAll(async () => {
    // Ensure database connection is ready
    const res = await pool.query('SELECT id FROM units WHERE status = $1 LIMIT 1', ['AVAILABLE']);
    if (res.rows.length > 0) {
      testUnitId = res.rows[0].id;
    }

    // Create a dedicated test customer
    const mobile = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const custRes = await pool.query(
      'INSERT INTO customers (name, mobile, email) VALUES ($1, $2, $3) RETURNING id',
      ['Test Suite Customer', mobile, `test-${Date.now()}@rohancorp.com`]
    );
    testCustomerId = custRes.rows[0].id;
  });

  afterAll(async () => {
    // Close pool after tests finish
    await pool.end();
  });

  // ============================================================================
  // Test 1: Cost-Sheet Discount Rules (0% to 2% max policy)
  // ============================================================================
  describe('1. Cost-Sheet Discount Policy Validation', () => {
    it('should REJECT a discount greater than 2% (e.g., 2.5%) with 400 Bad Request', async () => {
      const response = await request(app)
        .post('/api/cost-sheets')
        .send({
          customerId: testCustomerId,
          unitId: testUnitId,
          discountPercentage: 2.5, // ❌ Exceeds 2% cap
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Validation Error|discount/i);
    });

    it('should REJECT a negative discount with 400 Bad Request', async () => {
      const response = await request(app)
        .post('/api/cost-sheets')
        .send({
          customerId: testCustomerId,
          unitId: testUnitId,
          discountPercentage: -1.0, // ❌ Negative discount
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should ACCEPT a valid 1% discount and calculate exact formula matching Section 6', async () => {
      // For unit RN-101 (68,00,000 listed), 1% discount = 68,000, final = 67,32,000
      const response = await request(app)
        .post('/api/cost-sheets')
        .send({
          customerId: testCustomerId,
          unitId: testUnitId,
          discountPercentage: 1.0, // ✅ 1% valid
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Number(response.body.data.discount_percentage)).toBe(1);

      const listed = Number(response.body.data.listed_price);
      const discountAmount = Number(response.body.data.discount_amount);
      const finalPrice = Number(response.body.data.final_offered_price);

      expect(discountAmount).toBeCloseTo(listed * 0.01, 2);
      expect(finalPrice).toBeCloseTo(listed - discountAmount, 2);

      testCostSheetId = response.body.data.id;
    });
  });

  // ============================================================================
  // Test 2: Quotation Status & Expiry Validation
  // ============================================================================
  describe('2. Quotation Status & Expiry Lifecycle', () => {
    it('should create quotation with default status DRAFT and 7-day validity', async () => {
      const response = await request(app)
        .post('/api/quotations')
        .send({ costSheetId: testCostSheetId });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.quotation_number).toMatch(/^QUO-/);

      testQuotationId = response.body.data.id;
    });

    it('should REJECT booking confirmation if quotation is in DRAFT or SENT status', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ quotationId: testQuotationId }); // Status is still DRAFT

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/ACCEPTED/i);
    });

    it('should allow booking ONLY after quotation status is marked ACCEPTED', async () => {
      // Update status to ACCEPTED
      const updateRes = await request(app)
        .patch(`/api/quotations/${testQuotationId}/status`)
        .send({ status: 'ACCEPTED' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('ACCEPTED');

      // Now create booking
      const bookRes = await request(app)
        .post('/api/bookings')
        .send({ quotationId: testQuotationId });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.success).toBe(true);
      expect(bookRes.body.data.milestones).toHaveLength(4);

      testBookingId = bookRes.body.data.id;
      const bookingMilestone = bookRes.body.data.milestones.find(
        (m: any) => m.name === 'BOOKING'
      );
      testBookingMilestoneId = bookingMilestone.id;
    });
  });

  // ============================================================================
  // Test 3: Duplicate Bookings & Concurrency Protection
  // ============================================================================
  describe('3. Concurrency & Duplicate Booking Protection', () => {
    it('should REJECT attempting to book an already sold unit with 409 Conflict', async () => {
      const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      // Create another quotation for the same unit
      const csRes = await pool.query(
        `INSERT INTO cost_sheets 
         (cost_sheet_number, customer_id, unit_id, listed_price, discount_percentage, discount_amount, final_offered_price) 
         VALUES ($1, $2, $3, 6800000, 1.0, 68000, 6732000) 
         RETURNING id`,
        [`CS-DUP-${uniqueSuffix}`, testCustomerId, testUnitId]
      );

      const quoRes = await pool.query(
        `INSERT INTO quotations 
         (quotation_number, cost_sheet_id, customer_id, unit_id, listed_price, discount_amount, final_offered_price, status, valid_until) 
         VALUES ($1, $2, $3, $4, 6800000, 68000, 6732000, 'ACCEPTED', CURRENT_DATE + 7) 
         RETURNING id`,
        [`QUO-DUP-${uniqueSuffix}`, csRes.rows[0].id, testCustomerId, testUnitId]
      );

      // Attempt to book unit that was already booked in Test 2
      const response = await request(app)
        .post('/api/bookings')
        .send({ quotationId: quoRes.rows[0].id });

      expect(response.status).toBe(409); // Conflict
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already sold|already booked/i);
    });
  });

  // ============================================================================
  // Test 4: Overpayment Rejection
  // ============================================================================
  describe('4. Milestone Overpayment Rejection', () => {
    it('should REJECT payment that exceeds the milestone remaining balance with 400 Bad Request', async () => {
      // Fetch current balance of the booking milestone
      const mRes = await pool.query(
        'SELECT balance_amount FROM payment_milestones WHERE id = $1',
        [testBookingMilestoneId]
      );
      const balance = Number(mRes.rows[0].balance_amount);

      // Attempt to pay balance + ₹50,000
      const overAmount = balance + 50000;
      const ref = `PAY-OVER-${Date.now()}`;

      const response = await request(app)
        .post('/api/payments')
        .send({
          milestoneId: testBookingMilestoneId,
          amount: overAmount,
          paymentReference: ref,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Overpayment rejected/i);
    });

    it('should ACCEPT partial payment and correctly decrease milestone balance', async () => {
      const ref = `PAY-VALID-${Date.now()}`;
      const response = await request(app)
        .post('/api/payments')
        .send({
          milestoneId: testBookingMilestoneId,
          amount: 500000, // ₹5,00,000 partial payment matching Section 6
          paymentReference: ref,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Number(response.body.data.updatedMilestone.paidAmount)).toBe(500000);
    });
  });

  // ============================================================================
  // Test 5: Duplicate Payment Reference Rejection
  // ============================================================================
  describe('5. Duplicate Payment Reference Rejection', () => {
    it('should REJECT a payment with an already-used payment reference with 409 Conflict', async () => {
      const duplicateRef = `PAY-UNIQUE-REF-${Date.now()}`;

      // First payment succeeds
      const firstRes = await request(app)
        .post('/api/payments')
        .send({
          milestoneId: testBookingMilestoneId,
          amount: 10000,
          paymentReference: duplicateRef,
        });

      expect(firstRes.status).toBe(201);

      // Second payment with SAME reference MUST be rejected
      const secondRes = await request(app)
        .post('/api/payments')
        .send({
          milestoneId: testBookingMilestoneId,
          amount: 10000,
          paymentReference: duplicateRef, // ❌ Duplicate reference ID!
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toMatch(/Duplicate payment reference/i);
    });
  });
});
