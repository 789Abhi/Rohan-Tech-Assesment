import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  customerSchema,
} from '../controllers/customer.controller';
import { validateRequest } from '../middlewares';

const router = Router();

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', validateRequest(customerSchema), createCustomer);
router.put('/:id', validateRequest(customerSchema), updateCustomer);

export default router;
