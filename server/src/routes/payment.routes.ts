import { Router } from 'express';
import {
  recordPayment,
  getPaymentHistory,
  createPaymentSchema,
} from '../controllers/payment.controller';
import { validateRequest, financialLimiter } from '../middlewares';

const router = Router();

router.get('/', getPaymentHistory);
router.post('/', financialLimiter, validateRequest(createPaymentSchema), recordPayment);

export default router;
