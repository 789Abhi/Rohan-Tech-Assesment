import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Available vs Booked unit counts
    const unitStats = await pool.query(`
      SELECT 
        COUNT(*) AS total_units,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available_units,
        COUNT(*) FILTER (WHERE status = 'BOOKED') AS booked_units
      FROM units
    `);

    // 2. Accepted booking values
    const bookingStats = await pool.query(`
      SELECT 
        COUNT(*) AS total_bookings,
        COALESCE(SUM(agreed_price), 0) AS total_booking_value
      FROM bookings
      WHERE status = 'CONFIRMED'
    `);

    // 3. Collections (Total Payments made)
    const paymentStats = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_collected
      FROM payments
    `);

    // 4. Quotations count
    const quotationStats = await pool.query(`
      SELECT 
        COUNT(*) AS total_quotations,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED') AS accepted_quotations,
        COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft_quotations,
        COUNT(*) FILTER (WHERE status = 'SENT') AS sent_quotations
      FROM quotations
    `);

    // 5. Customers count
    const customerStats = await pool.query('SELECT COUNT(*) AS total_customers FROM customers');

    const totalBookingValue = Number(bookingStats.rows[0].total_booking_value);
    const totalCollected = Number(paymentStats.rows[0].total_collected);
    const totalOutstanding = Math.max(0, totalBookingValue - totalCollected);

    // 6. Recent bookings for dashboard table
    const recentBookings = await pool.query(`
      SELECT b.id, b.booking_number, b.agreed_price, b.booking_date,
             c.name AS customer_name,
             u.project_name, u.unit_number, u.bhk_type
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN units u ON b.unit_id = u.id
      ORDER BY b.booking_date DESC
      LIMIT 5
    `);

    // 7. Recent payments
    const recentPayments = await pool.query(`
      SELECT p.id, p.payment_reference, p.amount, p.payment_date,
             pm.name AS milestone_name,
             u.project_name, u.unit_number,
             c.name AS customer_name
      FROM payments p
      JOIN payment_milestones pm ON p.milestone_id = pm.id
      JOIN bookings b ON pm.booking_id = b.id
      JOIN customers c ON b.customer_id = c.id
      JOIN units u ON b.unit_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        units: {
          total: Number(unitStats.rows[0].total_units),
          available: Number(unitStats.rows[0].available_units),
          booked: Number(unitStats.rows[0].booked_units),
        },
        financials: {
          totalBookingValue,
          totalCollected,
          totalOutstanding,
        },
        counts: {
          bookings: Number(bookingStats.rows[0].total_bookings),
          quotations: Number(quotationStats.rows[0].total_quotations),
          acceptedQuotations: Number(quotationStats.rows[0].accepted_quotations),
          customers: Number(customerStats.rows[0].total_customers),
        },
        recentBookings: recentBookings.rows,
        recentPayments: recentPayments.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};
