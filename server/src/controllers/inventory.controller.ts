import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

export const getUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project, bhk, status } = req.query;

    let queryText = 'SELECT * FROM units WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (project && project !== 'ALL') {
      queryText += ` AND project_name = $${paramIndex++}`;
      params.push(project);
    }

    if (bhk && bhk !== 'ALL') {
      queryText += ` AND bhk_type = $${paramIndex++}`;
      params.push(bhk);
    }

    if (status && status !== 'ALL') {
      queryText += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    queryText += ' ORDER BY project_name ASC, unit_number ASC';

    const result = await pool.query(queryText, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const getUnitById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
