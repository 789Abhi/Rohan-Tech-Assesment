export type UnitStatus = 'AVAILABLE' | 'BOOKED';
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type MilestoneName = 'BOOKING' | 'FOUNDATION' | 'STRUCTURE' | 'HANDOVER';
export type MilestoneStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

export interface Unit {
  id: number;
  project_name: string;
  unit_number: string;
  bhk_type: string;
  area_sqft: number;
  listed_price: number | string;
  status: UnitStatus;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email: string;
  created_at: string;
}

export interface CostSheet {
  id: number;
  cost_sheet_number: string;
  customer_id: number;
  unit_id: number;
  listed_price: number | string;
  discount_percentage: number | string;
  discount_amount: number | string;
  final_offered_price: number | string;
  created_at: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  project_name?: string;
  unit_number?: string;
  bhk_type?: string;
  area_sqft?: number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  cost_sheet_id: number;
  customer_id: number;
  unit_id: number;
  listed_price: number | string;
  discount_amount: number | string;
  final_offered_price: number | string;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string;
  created_at: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  project_name?: string;
  unit_number?: string;
  bhk_type?: string;
  area_sqft?: number;
  cost_sheet_number?: string;
  discount_percentage?: number | string;
  is_expired?: boolean;
  unit_status?: 'AVAILABLE' | 'BOOKED';
  booking_id?: number;
  booking_number?: string;
}

export interface Booking {
  id: number;
  booking_number: string;
  quotation_id: number;
  customer_id: number;
  unit_id: number;
  agreed_price: number | string;
  status: BookingStatus;
  booking_date: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  project_name?: string;
  unit_number?: string;
  bhk_type?: string;
  area_sqft?: number;
  quotation_number?: string;
  total_collected?: number | string;
  total_outstanding?: number | string;
  milestones?: PaymentMilestone[];
  payments?: Payment[];
}

export interface PaymentMilestone {
  id: number;
  booking_id: number;
  name: MilestoneName;
  percentage: number | string;
  amount: number | string;
  paid_amount: number | string;
  balance_amount: number | string;
  status: MilestoneStatus;
  created_at: string;
}

export interface Payment {
  id: number;
  milestone_id: number;
  payment_reference: string;
  amount: number | string;
  payment_date: string;
  notes?: string;
  created_at: string;
  milestone_name?: string;
  customer_name?: string;
  project_name?: string;
  unit_number?: string;
}

export interface DashboardStats {
  units: {
    total: number;
    available: number;
    booked: number;
  };
  financials: {
    totalBookingValue: number;
    totalCollected: number;
    totalOutstanding: number;
  };
  counts: {
    bookings: number;
    quotations: number;
    acceptedQuotations: number;
    customers: number;
  };
  recentBookings: any[];
  recentPayments: any[];
}
