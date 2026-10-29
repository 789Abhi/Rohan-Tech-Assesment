import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../config/db';

export const createBookingSchema = z.object({
  quotationId: z.number().int().positive('Valid quotation ID is required'),
});

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  const client = await getClient();
  try {
    const { quotationId } = req.body;

    await client.query('BEGIN'); // Start ACID Transaction

    // 1. Fetch quotation and verify ACCEPTED and valid date
    const qRes = await client.query(
      `SELECT q.*, u.status AS unit_status 
       FROM quotations q
       JOIN units u ON q.unit_id = u.id
       WHERE q.id = $1`,
      [quotationId]
    );

    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = qRes.rows[0];

    // Must be ACCEPTED
    if (quotation.status !== 'ACCEPTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only an ACCEPTED quotation can be booked. Current status is '${quotation.status}'.`,
      });
    }

    // Must not be expired
    const today = new Date().toISOString().split('T')[0];
    const validUntil = new Date(quotation.valid_until).toISOString().split('T')[0];
    if (validUntil < today) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This quotation has expired. Please generate a new cost sheet and quotation.',
      });
    }

    // 2. CRITICAL CONCURRENCY LOCK: Lock the unit row exclusively for update
    const unitRes = await client.query(
      'SELECT * FROM units WHERE id = $1 FOR UPDATE',
      [quotation.unit_id]
    );

    const lockedUnit = unitRes.rows[0];

    // Check if unit is already sold/booked
    if (lockedUnit.status === 'BOOKED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Unit ${lockedUnit.unit_number} (${lockedUnit.project_name}) is already sold/booked! Simultaneous booking rejected.`,
      });
    }

    // Check if already booked under this quotation
    const existingBooking = await client.query(
      'SELECT id FROM bookings WHERE quotation_id = $1 OR unit_id = $2',
      [quotation.id, quotation.unit_id]
    );

    if (existingBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A confirmed booking already exists for this quotation or unit.',
      });
    }

    // 3. Mark unit as BOOKED
    await client.query(
      "UPDATE units SET status = 'BOOKED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [quotation.unit_id]
    );

    // 4. Create Booking record
    const bookingNumber = `BK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const agreedPrice = Number(quotation.final_offered_price);

    const bookingRes = await client.query(
      `INSERT INTO bookings (booking_number, quotation_id, customer_id, unit_id, agreed_price, status)
       VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')
       RETURNING *`,
      [bookingNumber, quotation.id, quotation.customer_id, quotation.unit_id, agreedPrice]
    );

    const bookingId = bookingRes.rows[0].id;

    // 5. Generate the 4 Standard Milestones
    // Booking: 10%, Foundation: 20%, Structure: 30%, Handover: 40%
    const milestones = [
      { name: 'BOOKING', percentage: 10, amount: Math.round((agreedPrice * 0.10 + Number.EPSILON) * 100) / 100 },
      { name: 'FOUNDATION', percentage: 20, amount: Math.round((agreedPrice * 0.20 + Number.EPSILON) * 100) / 100 },
      { name: 'STRUCTURE', percentage: 30, amount: Math.round((agreedPrice * 0.30 + Number.EPSILON) * 100) / 100 },
      { name: 'HANDOVER', percentage: 40, amount: Math.round((agreedPrice * 0.40 + Number.EPSILON) * 100) / 100 },
    ];

    for (const m of milestones) {
      await client.query(
        `INSERT INTO payment_milestones (booking_id, name, percentage, amount, paid_amount, balance_amount, status)
         VALUES ($1, $2, $3, $4, 0.00, $4, 'PENDING')`,
        [bookingId, m.name, m.percentage, m.amount]
      );
    }

    await client.query('COMMIT'); // Commit Transaction successfully

    // Fetch full booking details with customer and unit
    const fullBooking = await pool.query(
      `SELECT b.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft,
              q.quotation_number, q.discount_amount
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN units u ON b.unit_id = u.id
       JOIN quotations q ON b.quotation_id = q.id
       WHERE b.id = $1`,
      [bookingId]
    );

    const milestonesRes = await pool.query(
      'SELECT * FROM payment_milestones WHERE booking_id = $1 ORDER BY id ASC',
      [bookingId]
    );

    res.status(201).json({
      success: true,
      message: 'Booking confirmed and 4 payment milestones generated.',
      data: {
        ...fullBooking.rows[0],
        milestones: milestonesRes.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const getBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT b.*, 
              c.name AS customer_name, c.mobile AS customer_mobile,
              u.project_name, u.unit_number, u.bhk_type,
              COALESCE(SUM(p.amount), 0) AS total_collected,
              (b.agreed_price - COALESCE(SUM(p.amount), 0)) AS total_outstanding
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN units u ON b.unit_id = u.id
       LEFT JOIN payment_milestones pm ON pm.booking_id = b.id
       LEFT JOIN payments p ON p.milestone_id = pm.id
       GROUP BY b.id, c.name, c.mobile, u.project_name, u.unit_number, u.bhk_type
       ORDER BY b.booking_date DESC`
    );

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. Fetch booking info
    const bookingRes = await pool.query(
      `SELECT b.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft,
              q.quotation_number, q.listed_price, q.discount_amount
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN units u ON b.unit_id = u.id
       JOIN quotations q ON b.quotation_id = q.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingRes.rows[0];

    // 2. Fetch milestones
    const milestonesRes = await pool.query(
      'SELECT * FROM payment_milestones WHERE booking_id = $1 ORDER BY id ASC',
      [id]
    );

    // 3. Fetch all payments across milestones
    const paymentsRes = await pool.query(
      `SELECT p.*, pm.name AS milestone_name
       FROM payments p
       JOIN payment_milestones pm ON p.milestone_id = pm.id
       WHERE pm.booking_id = $1
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      [id]
    );

    // Calculate totals
    const totalCollected = paymentsRes.rows.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOutstanding = Math.max(0, Number(booking.agreed_price) - totalCollected);

    res.json({
      success: true,
      data: {
        ...booking,
        total_collected: totalCollected,
        total_outstanding: totalOutstanding,
        milestones: milestonesRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};
