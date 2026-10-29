import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
  email: z.string().email('Invalid email address'),
});

export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;

    let queryText = 'SELECT * FROM customers';
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      queryText += ' WHERE name ILIKE $1 OR mobile ILIKE $1 OR email ILIKE $1';
      params.push(`%${search.trim()}%`);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, mobile, email } = req.body;

    // Check duplicate mobile explicitly for a clear message
    const existing = await pool.query('SELECT id FROM customers WHERE mobile = $1', [mobile]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A customer with this 10-digit mobile number already exists.',
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, mobile, email) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name.trim(), mobile.trim(), email.trim().toLowerCase()]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, mobile, email } = req.body;

    // Check duplicate mobile on other customers
    const existing = await pool.query(
      'SELECT id FROM customers WHERE mobile = $1 AND id != $2',
      [mobile, id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number is already registered to another customer.',
      });
    }

    const result = await pool.query(
      `UPDATE customers 
       SET name = $1, mobile = $2, email = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [name.trim(), mobile.trim(), email.trim().toLowerCase(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
