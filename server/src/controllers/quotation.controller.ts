import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';

export const createQuotationSchema = z.object({
  costSheetId: z.number().int().positive('Valid Cost Sheet ID is required'),
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED']),
});

export const createQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { costSheetId } = req.body;

    // 1. Fetch cost sheet details
    const csRes = await pool.query(
      `SELECT cs.*, u.status AS unit_status 
       FROM cost_sheets cs
       JOIN units u ON cs.unit_id = u.id
       WHERE cs.id = $1`,
      [costSheetId]
    );

    if (csRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cost Sheet not found' });
    }

    const cs = csRes.rows[0];

    // Unique quotation number
    const quotationNumber = `QUO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Validity: 7 days from today
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 7);
    const validUntil = validUntilDate.toISOString().split('T')[0];

    const insertRes = await pool.query(
      `INSERT INTO quotations 
       (quotation_number, cost_sheet_id, customer_id, unit_id, listed_price, discount_amount, final_offered_price, status, valid_until) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8) 
       RETURNING *`,
      [
        quotationNumber,
        cs.id,
        cs.customer_id,
        cs.unit_id,
        cs.listed_price,
        cs.discount_amount,
        cs.final_offered_price,
        validUntil,
      ]
    );

    const fullResult = await pool.query(
      `SELECT q.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft, u.status AS unit_status,
              cs.cost_sheet_number, cs.discount_percentage
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       JOIN units u ON q.unit_id = u.id
       JOIN cost_sheets cs ON q.cost_sheet_id = cs.id
       WHERE q.id = $1`,
      [insertRes.rows[0].id]
    );

    res.status(201).json({ success: true, data: fullResult.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const getQuotations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;

    let queryText = `
      SELECT q.*, 
             c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
             u.project_name, u.unit_number, u.bhk_type, u.area_sqft, u.status AS unit_status,
             cs.cost_sheet_number, cs.discount_percentage,
             b.id AS booking_id, b.booking_number,
             CASE 
               WHEN q.valid_until < CURRENT_DATE AND q.status != 'ACCEPTED' THEN true 
               ELSE false 
             END AS is_expired
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      JOIN units u ON q.unit_id = u.id
      JOIN cost_sheets cs ON q.cost_sheet_id = cs.id
      LEFT JOIN bookings b ON b.quotation_id = q.id
    `;

    const params: any[] = [];
    if (status && status !== 'ALL') {
      queryText += ' WHERE q.status = $1';
      params.push(status);
    }

    queryText += ' ORDER BY q.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getQuotationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT q.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft, u.status AS unit_status,
              cs.cost_sheet_number, cs.discount_percentage,
              b.id AS booking_id, b.booking_number,
              CASE 
                WHEN q.valid_until < CURRENT_DATE AND q.status != 'ACCEPTED' THEN true 
                ELSE false 
              END AS is_expired
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       JOIN units u ON q.unit_id = u.id
       JOIN cost_sheets cs ON q.cost_sheet_id = cs.id
       LEFT JOIN bookings b ON b.quotation_id = q.id
       WHERE q.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const updateQuotationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if quotation exists
    const qRes = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = qRes.rows[0];

    // If attempting to mark accepted, ensure validity is not expired
    if (status === 'ACCEPTED') {
      const today = new Date().toISOString().split('T')[0];
      const validUntil = new Date(quotation.valid_until).toISOString().split('T')[0];
      if (validUntil < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept an expired quotation. Please generate a new cost sheet.',
        });
      }
    }

    const result = await pool.query(
      `UPDATE quotations 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    res.json({ success: true, message: `Quotation status updated to ${status}`, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
