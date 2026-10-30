import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerSchema,
} from '../controllers/customer.controller';
import { validateRequest } from '../middlewares';

const router = Router();

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', validateRequest(customerSchema), createCustomer);
router.put('/:id', validateRequest(customerSchema), updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
