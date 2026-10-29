import { Router } from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  createBookingSchema,
} from '../controllers/booking.controller';
import { validateRequest, financialLimiter } from '../middlewares';

const router = Router();

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', financialLimiter, validateRequest(createBookingSchema), createBooking);

export default router;
