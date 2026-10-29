import { Router } from 'express';
import {
  createCostSheet,
  getCostSheets,
  getCostSheetById,
  createCostSheetSchema,
} from '../controllers/costSheet.controller';
import { validateRequest } from '../middlewares';

const router = Router();

router.get('/', getCostSheets);
router.get('/:id', getCostSheetById);
router.post('/', validateRequest(createCostSheetSchema), createCostSheet);

export default router;
