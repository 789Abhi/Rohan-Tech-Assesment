import type {
  Unit,
  Customer,
  CostSheet,
  Quotation,
  Booking,
  Payment,
  DashboardStats,
  QuotationStatus,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();

  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`Server Error (${response.status}): ${text.slice(0, 120)}`);
    }
    throw new Error('Received unexpected non-JSON response from server');
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// 1. Dashboard
export const getDashboardStats = () =>
  request<{ success: boolean; data: DashboardStats }>('/dashboard/stats');

// 2. Inventory / Units
export const getUnits = (filters?: { project?: string; bhk?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.project && filters.project !== 'ALL') params.append('project', filters.project);
  if (filters?.bhk && filters.bhk !== 'ALL') params.append('bhk', filters.bhk);
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  return request<{ success: boolean; count: number; data: Unit[] }>(`/units${query}`);
};

export const getUnitById = (id: number) =>
  request<{ success: boolean; data: Unit }>(`/units/${id}`);

// 3. Customers
export const getCustomers = (search?: string) => {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<{ success: boolean; count: number; data: Customer[] }>(`/customers${query}`);
};

export const createCustomer = (customerData: { name: string; mobile: string; email: string }) =>
  request<{ success: boolean; data: Customer }>('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  });

export const updateCustomer = (
  id: number,
  customerData: { name: string; mobile: string; email: string }
) =>
  request<{ success: boolean; data: Customer }>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  });

export const deleteCustomer = (id: number) =>
  request<{ success: boolean; message: string }>(`/customers/${id}`, {
    method: 'DELETE',
  });

// 4. Cost Sheets
export const createCostSheet = (data: {
  customerId: number;
  unitId: number;
  discountPercentage: number;
}) =>
  request<{ success: boolean; data: CostSheet }>('/cost-sheets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getCostSheets = () =>
  request<{ success: boolean; count: number; data: CostSheet[] }>('/cost-sheets');

export const getCostSheetById = (id: number) =>
  request<{ success: boolean; data: CostSheet }>(`/cost-sheets/${id}`);

// 5. Quotations
export const createQuotation = (costSheetId: number) =>
  request<{ success: boolean; data: Quotation }>('/quotations', {
    method: 'POST',
    body: JSON.stringify({ costSheetId }),
  });

export const getQuotations = (status?: string) => {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  return request<{ success: boolean; count: number; data: Quotation[] }>(`/quotations${query}`);
};

export const getQuotationById = (id: number) =>
  request<{ success: boolean; data: Quotation }>(`/quotations/${id}`);

export const updateQuotationStatus = (id: number, status: QuotationStatus) =>
  request<{ success: boolean; data: Quotation }>(`/quotations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// 6. Bookings
export const createBooking = (quotationId: number) =>
  request<{ success: boolean; data: Booking; message: string }>('/bookings', {
    method: 'POST',
    body: JSON.stringify({ quotationId }),
  });

export const getBookings = () =>
  request<{ success: boolean; count: number; data: Booking[] }>('/bookings');

export const getBookingById = (id: number) =>
  request<{ success: boolean; data: Booking }>(`/bookings/${id}`);

// 7. Payments
export const recordPayment = (data: {
  milestoneId: number;
  amount: number;
  paymentReference: string;
  paymentDate?: string;
  notes?: string;
}) =>
  request<{ success: boolean; data: any; message: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getPaymentHistory = (bookingId?: number) => {
  const query = bookingId ? `?bookingId=${bookingId}` : '';
  return request<{ success: boolean; count: number; data: Payment[] }>(`/payments${query}`);
};
