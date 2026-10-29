import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getQuotations, updateQuotationStatus, createBooking } from '../services/api';
import { Quotation, QuotationStatus } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { Pagination, SearchInput, Button, Badge } from '../components/common';
import { formatDate } from '../utils/formatters';
import {
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  X,
  ExternalLink,
} from 'lucide-react';

// Memoized Status Badge Component
const StatusBadge = React.memo<{ status: QuotationStatus; isExpired?: boolean }>(
  ({ status, isExpired }) => {
    if (isExpired && status !== 'ACCEPTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
          <Clock className="w-3 h-3 text-slate-500" /> Expired
        </span>
      );
    }

    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Draft
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Send className="w-3 h-3" /> Sent to Client
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Accepted
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return null;
    }
  }
);

StatusBadge.displayName = 'StatusBadge';

// Memoized Table Row Component
const QuotationRow = React.memo<{
  quotation: Quotation;
  onView: (q: Quotation) => void;
  onStatusChange: (id: number, status: QuotationStatus) => void;
  onConfirmBooking: (q: Quotation) => void;
  onGoToBooking: (bookingId: number) => void;
  bookingLoading: boolean;
  formatINR: (amount: number | string | undefined) => string;
}>(({ quotation: q, onView, onStatusChange, onConfirmBooking, onGoToBooking, bookingLoading, formatINR }) => {
  const isAlreadyBooked = Boolean(q.booking_id);
  const isUnitLockedByOther = !isAlreadyBooked && q.unit_status === 'BOOKED';
  const canBook = q.status === 'ACCEPTED' && !q.is_expired && !isAlreadyBooked && !isUnitLockedByOther;

  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-6 py-4 font-mono font-bold text-blue-700">{q.quotation_number}</td>
      <td className="px-6 py-4 font-semibold text-slate-900">
        {q.customer_name}
        <span className="block text-xs text-slate-400 font-normal">{q.customer_mobile}</span>
      </td>
      <td className="px-6 py-4">
        {q.project_name} • <strong className="text-slate-800">{q.unit_number}</strong>
      </td>
      <td className="px-6 py-4 font-extrabold text-slate-900">{formatINR(q.final_offered_price)}</td>
      <td className="px-6 py-4 text-xs font-medium">
        Valid until <strong className="text-slate-700">{new Date(q.valid_until).toLocaleDateString()}</strong>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={q.status} isExpired={q.is_expired} />
          {isAlreadyBooked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Booked
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right space-x-2">
        <button
          onClick={() => onView(q)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          View / PDF
        </button>

        {q.status === 'DRAFT' && !isAlreadyBooked && (
          <button
            onClick={() => onStatusChange(q.id, 'SENT')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
          >
            Mark Sent
          </button>
        )}

        {q.status === 'SENT' && !isAlreadyBooked && (
          <button
            onClick={() => onStatusChange(q.id, 'ACCEPTED')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
          >
            Mark Accepted
          </button>
        )}

        {/* Action based on booking state */}
        {isAlreadyBooked ? (
          <button
            onClick={() => onGoToBooking(q.booking_id!)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            title={`Booking #${q.booking_number} Confirmed - Click to View Ledger`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            View Booking
          </button>
        ) : isUnitLockedByOther ? (
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1"
            title="This unit has already been booked by another transaction."
          >
            <XCircle className="w-3.5 h-3.5" /> Unit Sold
          </span>
        ) : (
          canBook && (
            <button
              disabled={bookingLoading}
              onClick={() => onConfirmBooking(q)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white transition shadow-xs cursor-pointer"
            >
              Confirm Booking
            </button>
          )
        )}
      </td>
    </tr>
  );
});

QuotationRow.displayName = 'QuotationRow';

export const QuotationsPage: React.FC = () => {
  const { setActiveTab, setSelectedBookingId, formatINR, showToast } = useApp();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Debounced search query (250ms)
  const debouncedSearch = useDebounce(searchQuery, 250);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getQuotations(statusFilter);
      setQuotations(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleStatusChange = useCallback(
    async (id: number, newStatus: QuotationStatus) => {
      try {
        await updateQuotationStatus(id, newStatus);
        showToast(`Quotation status updated to ${newStatus}`, 'success');
        fetchQuotations();
        setActiveQuotation((prev) => (prev && prev.id === id ? { ...prev, status: newStatus } : prev));
      } catch (err: any) {
        showToast(err.message || 'Failed to update quotation status', 'error');
      }
    },
    [fetchQuotations, showToast]
  );

  const handleConfirmBooking = useCallback(
    async (quotation: Quotation) => {
      if (quotation.status !== 'ACCEPTED') {
        showToast('Only ACCEPTED quotations can be booked! Please accept it first.', 'error');
        return;
      }

      setBookingLoading(true);
      try {
        const res = await createBooking(quotation.id);
        showToast(res.message || 'Booking confirmed successfully!', 'success');
        setActiveQuotation(null);
        setSelectedBookingId(res.data.id);
        fetchQuotations();
        setActiveTab('bookings');
      } catch (err: any) {
        showToast(err.message || 'Failed to confirm booking', 'error');
      } finally {
        setBookingLoading(false);
      }
    },
    [fetchQuotations, setActiveTab, setSelectedBookingId, showToast]
  );

  const handleGoToBooking = useCallback(
    (bookingId: number) => {
      setSelectedBookingId(bookingId);
      setActiveTab('bookings');
    },
    [setSelectedBookingId, setActiveTab]
  );

  // Memoized filtered list with debounced search
  const filteredQuotations = useMemo(() => {
    let list = quotations;
    if (statusFilter !== 'ALL') {
      list = list.filter((q) => q.status === statusFilter);
    }
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.quotation_number.toLowerCase().includes(q) ||
        (item.customer_name && item.customer_name.toLowerCase().includes(q)) ||
        (item.unit_number && item.unit_number.toLowerCase().includes(q)) ||
        (item.project_name && item.project_name.toLowerCase().includes(q))
    );
  }, [quotations, statusFilter, debouncedSearch]);

  // Reusable Pagination Hook (10 quotations per page)
  const pagination = usePagination(filteredQuotations, { initialPageSize: 10 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Quotation Lifecycle Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage Quotations: Draft → Sent → Accepted. Only accepted, unexpired quotations can confirm bookings.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('cost-sheets')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm transition shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          Create New from Cost Sheet
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === tab
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab === 'ALL' ? 'All Quotations' : tab}
            </button>
          ))}
        </div>

        <div className="min-w-[280px]">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search quotations..."
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Quotation #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Project & Unit</th>
                <th className="px-6 py-4">Final Quoted Price</th>
                <th className="px-6 py-4">Validity (7 Days)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {pagination.paginatedItems.map((q) => (
                <QuotationRow
                  key={q.id}
                  quotation={q}
                  onView={setActiveQuotation}
                  onStatusChange={handleStatusChange}
                  onConfirmBooking={handleConfirmBooking}
                  onGoToBooking={handleGoToBooking}
                  bookingLoading={bookingLoading}
                  formatINR={formatINR}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Global Pagination Component */}
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {filteredQuotations.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium">No quotations found for this status filter.</p>
        </div>
      )}

      {/* FULLY RESPONSIVE PRINTABLE / DOWNLOADABLE OFFICIAL QUOTATION MODAL */}
      {/* Notice: items-start + p-3 sm:p-6 + max-h-[92vh] flex flex-col guarantees the top action header is ALWAYS visible on all screen sizes! */}
      {activeQuotation && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-auto max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 print-page">
            
            {/* STICKY TOP ACTION HEADER: Always pinned at the top on laptops, tablets, and small screens */}
            <div className="sticky top-0 z-20 px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shadow-md no-print shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100">
                  Quotation Preview
                </span>
                <span className="hidden sm:inline-block font-mono text-xs text-blue-300 bg-slate-800 px-2 py-0.5 rounded">
                  {activeQuotation.quotation_number}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / Save</span> PDF
                </button>

                {activeQuotation.status !== 'ACCEPTED' && !activeQuotation.booking_id && (
                  <button
                    onClick={() => handleStatusChange(activeQuotation.id, 'ACCEPTED')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Accept
                  </button>
                )}

                {activeQuotation.booking_id ? (
                  <button
                    onClick={() => {
                      setSelectedBookingId(activeQuotation.booking_id!);
                      setActiveTab('bookings');
                      setActiveQuotation(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                    title={`Booking #${activeQuotation.booking_number} Confirmed`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    View Booking
                  </button>
                ) : activeQuotation.unit_status === 'BOOKED' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-900/60 text-rose-300 text-xs font-semibold inline-flex items-center gap-1 border border-rose-700">
                    <XCircle className="w-3.5 h-3.5" /> Unit Sold
                  </span>
                ) : (
                  activeQuotation.status === 'ACCEPTED' && (
                    <button
                      disabled={bookingLoading}
                      onClick={() => handleConfirmBooking(activeQuotation)}
                      className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                    </button>
                  )
                )}

                <button
                  onClick={() => setActiveQuotation(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SCROLLABLE DOCUMENT BODY: Scrolls smoothly inside the modal without hiding the header */}
            <div className="p-6 sm:p-10 space-y-6 bg-white text-slate-800 overflow-y-auto flex-1">
              {/* Header Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-slate-200 pb-5 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">ROHAN CORPORATION</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Premier Real Estate & Infrastructure Developers</p>
                  <p className="text-xs text-slate-500">Mangalore, Karnataka, India</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">OFFICIAL QUOTATION</span>
                  <span className="text-sm font-mono font-bold text-blue-700 block">{activeQuotation.quotation_number}</span>
                  <span className="text-xs text-slate-500 block">
                    Issue Date: {new Date(activeQuotation.issue_date).toLocaleDateString()}
                  </span>
                  <span className="text-xs font-bold text-amber-600 block">
                    Valid Until: {new Date(activeQuotation.valid_until).toLocaleDateString()} (7 Days)
                  </span>
                </div>
              </div>

              {/* Status Notice */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-600 font-medium">Quotation Status:</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeQuotation.status} isExpired={activeQuotation.is_expired} />
                  {activeQuotation.booking_id && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Booking Confirmed (#{activeQuotation.booking_number})
                    </span>
                  )}
                </div>
              </div>

              {/* Customer & Unit Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Offered To (Customer)
                  </span>
                  <p className="font-bold text-slate-900">{activeQuotation.customer_name}</p>
                  <p className="text-slate-600 text-xs">Mobile: {activeQuotation.customer_mobile}</p>
                  <p className="text-slate-600 text-xs">Email: {activeQuotation.customer_email}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Property Unit Specification
                  </span>
                  <p className="font-bold text-slate-900">{activeQuotation.project_name}</p>
                  <p className="text-slate-600 text-xs">Unit Number: <strong>{activeQuotation.unit_number}</strong></p>
                  <p className="text-slate-600 text-xs">Specification: {activeQuotation.bhk_type} ({activeQuotation.area_sqft} sq ft)</p>
                </div>
              </div>

              {/* Financial Pricing Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Financial Commitment</h4>
                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 text-xs font-bold uppercase">
                    <tr>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3">Standard Listed Price</td>
                      <td className="p-3 text-right font-medium">{formatINR(activeQuotation.listed_price)}</td>
                    </tr>
                    <tr className="text-emerald-700 bg-emerald-50/50">
                      <td className="p-3">Approved Special Discount</td>
                      <td className="p-3 text-right font-medium">- {formatINR(activeQuotation.discount_amount)}</td>
                    </tr>
                    <tr className="bg-blue-50/60 font-bold text-slate-900 text-base border-t-2 border-blue-200">
                      <td className="p-3 text-blue-900">Total Agreed Quoted Price</td>
                      <td className="p-3 text-right text-blue-700">{formatINR(activeQuotation.final_offered_price)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Terms & Conditions */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-700 uppercase tracking-wider">Terms & Conditions:</p>
                <p>1. This quotation is valid for 7 days from the issue date and retains original financial values.</p>
                <p>2. A booking can only be confirmed upon acceptance of this quotation and subject to unit availability.</p>
                <p>3. Four payment milestones will be generated upon booking confirmation: Booking (10%), Foundation (20%), Structure (30%), and Handover (40%).</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
