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
  listed_price: number;
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
  listed_price: number;
  discount_percentage: number;
  discount_amount: number;
  final_offered_price: number;
  created_at: string;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  cost_sheet_id: number;
  customer_id: number;
  unit_id: number;
  listed_price: number;
  discount_amount: number;
  final_offered_price: number;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string;
  created_at: string;
}

export interface Booking {
  id: number;
  booking_number: string;
  quotation_id: number;
  customer_id: number;
  unit_id: number;
  agreed_price: number;
  status: BookingStatus;
  booking_date: string;
}

export interface PaymentMilestone {
  id: number;
  booking_id: number;
  name: MilestoneName;
  percentage: number;
  amount: number;
  paid_amount: number;
  balance_amount: number;
  status: MilestoneStatus;
  created_at: string;
}

export interface Payment {
  id: number;
  milestone_id: number;
  payment_reference: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}
