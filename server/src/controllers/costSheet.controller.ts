import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';

export const createCostSheetSchema = z.object({
  customerId: z.number().int().positive('Valid customer ID is required'),
  unitId: z.number().int().positive('Valid unit ID is required'),
  discountPercentage: z
    .number()
    .min(0, 'Discount percentage cannot be negative')
    .max(2, 'Discount percentage cannot exceed 2% (Policy Maximum)'),
});

export const createCostSheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, unitId, discountPercentage } = req.body;

    // 1. Fetch customer
    const customerRes = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // 2. Fetch unit
    const unitRes = await pool.query('SELECT * FROM units WHERE id = $1', [unitId]);
    if (unitRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }

    const unit = unitRes.rows[0];
    const listedPrice = Number(unit.listed_price);

    // 3. Precise monetary calculation
    // Discount = Listed price * (Discount % / 100)
    const discountAmount = Math.round((listedPrice * (discountPercentage / 100) + Number.EPSILON) * 100) / 100;
    const finalOfferedPrice = Math.round((listedPrice - discountAmount + Number.EPSILON) * 100) / 100;

    const costSheetNumber = `CS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const insertResult = await pool.query(
      `INSERT INTO cost_sheets 
       (cost_sheet_number, customer_id, unit_id, listed_price, discount_percentage, discount_amount, final_offered_price) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [costSheetNumber, customerId, unitId, listedPrice, discountPercentage, discountAmount, finalOfferedPrice]
    );

    const fullResult = await pool.query(
      `SELECT cs.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft, u.status AS unit_status
       FROM cost_sheets cs
       JOIN customers c ON cs.customer_id = c.id
       JOIN units u ON cs.unit_id = u.id
       WHERE cs.id = $1`,
      [insertResult.rows[0].id]
    );

    res.status(201).json({ success: true, data: fullResult.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const getCostSheets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft
       FROM cost_sheets cs
       JOIN customers c ON cs.customer_id = c.id
       JOIN units u ON cs.unit_id = u.id
       ORDER BY cs.created_at DESC`
    );

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getCostSheetById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT cs.*, 
              c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
              u.project_name, u.unit_number, u.bhk_type, u.area_sqft, u.status AS unit_status
       FROM cost_sheets cs
       JOIN customers c ON cs.customer_id = c.id
       JOIN units u ON cs.unit_id = u.id
       WHERE cs.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cost Sheet not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
