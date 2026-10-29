import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
});

export const financialLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 120, // Max 120 write transactions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'High transaction volume detected. Please wait a moment before trying again.',
  },
});

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ success: false, message: 'Invalid request payload' });
    }
  };
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);

  const statusCode = err.statusCode || (err.code === '23505' ? 409 : 500);
  let message = err.message || 'Internal Server Error';

  // PostgreSQL unique violation
  if (err.code === '23505') {
    if (err.detail?.includes('mobile')) {
      message = 'A customer with this 10-digit mobile number already exists.';
    } else if (err.detail?.includes('payment_reference')) {
      message = 'Payment reference already exists. Duplicate references are rejected.';
    } else if (err.detail?.includes('unit_id')) {
      message = 'This unit is already booked.';
    } else {
      message = 'Duplicate entry conflict.';
    }
  }

  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    if (err.constraint?.includes('discount_percentage')) {
      message = 'Discount percentage must be between 0% and 2%.';
    } else {
      message = 'Database constraint check failed.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    detail: process.env.NODE_ENV === 'development' ? err.detail : undefined,
  });
};
