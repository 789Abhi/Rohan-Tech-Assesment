import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../config/db';

export const createPaymentSchema = z.object({
  milestoneId: z.number().int().positive('Valid milestone ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentReference: z.string().trim().min(3, 'Payment reference must be at least 3 characters'),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  const client = await getClient();
  try {
    const { milestoneId, amount, paymentReference, paymentDate, notes } = req.body;
    const cleanReference = paymentReference.trim();
    const payDate = paymentDate || new Date().toISOString().split('T')[0];

    await client.query('BEGIN'); // Start ACID Transaction

    // 1. Lock milestone row for update to prevent concurrent overpayments
    const milestoneRes = await client.query(
      `SELECT pm.*, b.agreed_price, b.booking_number, b.unit_id,
              c.name AS customer_name, u.unit_number, u.project_name
       FROM payment_milestones pm
       JOIN bookings b ON pm.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       JOIN units u ON b.unit_id = u.id
       WHERE pm.id = $1 FOR UPDATE`,
      [milestoneId]
    );

    if (milestoneRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Payment milestone not found' });
    }

    const milestone = milestoneRes.rows[0];
    const balanceAmount = Math.round((Number(milestone.balance_amount) + Number.EPSILON) * 100) / 100;
    const paymentAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

    // 2. REJECT OVERPAYMENTS (Required by assignment section 5 & 7)
    if (paymentAmount > balanceAmount + 0.001) {
      await client.query('ROLLBACK');
      const formattedBal = balanceAmount.toLocaleString('en-IN', {
        minimumFractionDigits: balanceAmount % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      });
      const formattedPay = paymentAmount.toLocaleString('en-IN', {
        minimumFractionDigits: paymentAmount % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      });
      return res.status(400).json({
        success: false,
        message: `Overpayment rejected! Remaining milestone balance is ₹${formattedBal}, but payment attempt was ₹${formattedPay}.`,
        currentBalance: balanceAmount,
        attemptedAmount: paymentAmount,
      });
    }

    // 3. REJECT DUPLICATE PAYMENT REFERENCES (Required by assignment section 5 & 7)
    const existingRef = await client.query(
      'SELECT id FROM payments WHERE payment_reference = $1',
      [cleanReference]
    );

    if (existingRef.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Duplicate payment reference '${cleanReference}' rejected! Each transaction must have a unique reference ID.`,
      });
    }

    // 4. Insert Payment record
    const paymentRes = await client.query(
      `INSERT INTO payments (milestone_id, payment_reference, amount, payment_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [milestoneId, cleanReference, paymentAmount, payDate, notes || null]
    );

    // 5. Update Milestone balance & status
    const newPaidAmount = Math.round((Number(milestone.paid_amount) + paymentAmount + Number.EPSILON) * 100) / 100;
    const rawBalance = Math.round((balanceAmount - paymentAmount + Number.EPSILON) * 100) / 100;
    const newBalanceAmount = rawBalance <= 0.005 ? 0 : rawBalance;
    const newStatus = newBalanceAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';

    await client.query(
      `UPDATE payment_milestones 
       SET paid_amount = $1, balance_amount = $2, status = $3 
       WHERE id = $4`,
      [newPaidAmount, newBalanceAmount, newStatus, milestoneId]
    );

    await client.query('COMMIT'); // Commit Transaction

    // Fetch total overall outstanding for the booking
    const bookingTotals = await pool.query(
      `SELECT (b.agreed_price - COALESCE(SUM(p.amount), 0)) AS total_outstanding,
              COALESCE(SUM(p.amount), 0) AS total_collected
       FROM bookings b
       LEFT JOIN payment_milestones pm ON pm.booking_id = b.id
       LEFT JOIN payments p ON p.milestone_id = pm.id
       WHERE b.id = $1
       GROUP BY b.id`,
      [milestone.booking_id]
    );

    const totals = bookingTotals.rows[0];

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: {
        payment: paymentRes.rows[0],
        updatedMilestone: {
          id: milestone.id,
          name: milestone.name,
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
        },
        bookingOverview: {
          bookingId: milestone.booking_id,
          totalCollected: Number(totals.total_collected),
          totalOutstanding: Number(totals.total_outstanding),
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.query;

    let queryText = `
      SELECT p.*, 
             pm.name AS milestone_name, pm.booking_id,
             b.booking_number, b.agreed_price,
             c.name AS customer_name,
             u.project_name, u.unit_number
      FROM payments p
      JOIN payment_milestones pm ON p.milestone_id = pm.id
      JOIN bookings b ON pm.booking_id = b.id
      JOIN customers c ON b.customer_id = c.id
      JOIN units u ON b.unit_id = u.id
    `;

    const params: any[] = [];
    if (bookingId) {
      queryText += ' WHERE pm.booking_id = $1';
      params.push(bookingId);
    }

    queryText += ' ORDER BY p.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};
