import { Router } from 'express';
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  createQuotationSchema,
  updateQuotationStatusSchema,
} from '../controllers/quotation.controller';
import { validateRequest } from '../middlewares';

const router = Router();

router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.post('/', validateRequest(createQuotationSchema), createQuotation);
router.patch('/:id/status', validateRequest(updateQuotationStatusSchema), updateQuotationStatus);

export default router;
