import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getBookings, getBookingById, recordPayment } from '../services/api';
import { Booking, PaymentMilestone, Payment } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { Pagination, SearchInput, Button, Badge } from '../components/common';
import { formatDate } from '../utils/formatters';
import {
  CheckCircle2,
  ShieldAlert,
  CreditCard,
  X,
  History,
  TrendingUp,
} from 'lucide-react';

// Memoized Milestone Card
const MilestoneCard = React.memo<{
  milestone: PaymentMilestone;
  onRecordPayment: (m: PaymentMilestone) => void;
  formatINR: (amount: number | string | undefined) => string;
}>(({ milestone, onRecordPayment, formatINR }) => {
  const totalAmt = Number(milestone.amount);
  const paidAmt = Number(milestone.paid_amount);
  const balAmt = Number(milestone.balance_amount);
  const isFullyPaid = balAmt <= 0.005;

  // Never prematurely claim 100% if there is any remaining milestone balance!
  const rawPct = totalAmt > 0 ? (paidAmt / totalAmt) * 100 : 0;
  const progressPct = isFullyPaid ? 100 : Math.min(99, Math.floor(rawPct));

  return (
    <div
      className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition ${
        isFullyPaid
          ? 'border-emerald-200 bg-emerald-50/20'
          : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            {milestone.name} ({milestone.percentage}%)
          </span>
          <Badge variant={isFullyPaid ? 'success' : paidAmt > 0 ? 'primary' : 'neutral'}>
            {milestone.status}
          </Badge>
        </div>

        <div className="my-3">
          <span className="text-2xl font-black text-slate-900 block">{formatINR(totalAmt)}</span>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isFullyPaid ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 mt-1.5 font-medium">
            <span>
              Paid: <strong className="text-slate-800">{formatINR(paidAmt)}</strong>
            </span>
            <span>{progressPct}%</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
        <div>
          <span className="text-[11px] text-slate-400 block font-medium">Milestone Balance</span>
          <span className={`text-sm font-extrabold ${isFullyPaid ? 'text-emerald-700' : 'text-amber-600'}`}>
            {formatINR(balAmt)}
          </span>
        </div>

        <button
          disabled={isFullyPaid}
          onClick={() => onRecordPayment(milestone)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            isFullyPaid
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs cursor-pointer'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          {isFullyPaid ? 'Settled' : 'Record Pay'}
        </button>
      </div>
    </div>
  );
});

MilestoneCard.displayName = 'MilestoneCard';

export const BookingsPage: React.FC = () => {
  const { selectedBookingId, setSelectedBookingId, formatINR, showToast } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search query (250ms)
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<PaymentMilestone | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadBookingDetail = useCallback(
    async (id: number) => {
      try {
        const res = await getBookingById(id);
        setActiveBooking(res.data);
      } catch (err: any) {
        // If booking not found (stale ID in localStorage), clean up gracefully
        setActiveBooking(null);
        setSelectedBookingId(null);
      }
    },
    [setSelectedBookingId]
  );

  const fetchBookingsList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBookings();
      setBookings(res.data);
      return res.data;
    } catch (err: any) {
      showToast(err.message || 'Failed to load bookings', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Single unified mount effect: Load list, validate selectedBookingId against real data
  useEffect(() => {
    let isCancelled = false;

    const initBookings = async () => {
      const list = await fetchBookingsList();
      if (isCancelled) return;

      if (!list || list.length === 0) {
        setActiveBooking(null);
        setSelectedBookingId(null);
        return;
      }

      // Check if selectedBookingId exists in the fresh list
      const matched = selectedBookingId ? list.find((b: Booking) => b.id === selectedBookingId) : null;
      const targetId = matched ? matched.id : list[0].id;

      setSelectedBookingId(targetId);
      loadBookingDetail(targetId);
    };

    initBookings();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectBooking = useCallback(
    (id: number) => {
      setSelectedBookingId(id);
      loadBookingDetail(id);
    },
    [setSelectedBookingId, loadBookingDetail]
  );

  const handleOpenPaymentModal = useCallback((milestone: PaymentMilestone) => {
    setActiveMilestone(milestone);
    setPaymentAmount('');
    setPaymentReference(`TXN-${Date.now().toString().slice(-6)}`);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setPaymentError('');
    setPaymentModalOpen(true);
  }, []);

  const handleRecordPayment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPaymentError('');

      if (!activeMilestone) return;

      const amountNum = Math.round((Number(paymentAmount) + Number.EPSILON) * 100) / 100;
      const balanceNum = Math.round((Number(activeMilestone.balance_amount) + Number.EPSILON) * 100) / 100;

      if (isNaN(amountNum) || amountNum <= 0) {
        setPaymentError('Payment amount must be greater than zero.');
        return;
      }

      // STRICT OVERPAYMENT CHECK (Section 5 & 7)
      if (amountNum > balanceNum + 0.001) {
        setPaymentError(
          `Overpayment Rejected! The maximum payable balance for ${activeMilestone.name} is ${formatINR(
            balanceNum
          )}.`
        );
        return;
      }

      if (!paymentReference.trim()) {
        setPaymentError('Unique payment reference ID is required.');
        return;
      }

      setSubmittingPayment(true);
      try {
        const res = await recordPayment({
          milestoneId: activeMilestone.id,
          amount: amountNum,
          paymentReference: paymentReference.trim(),
          paymentDate,
          notes: paymentNotes.trim() || undefined,
        });

        showToast(res.message || 'Payment recorded successfully!', 'success');
        setPaymentModalOpen(false);

        if (activeBooking) {
          await loadBookingDetail(activeBooking.id);
        }
        fetchBookingsList();
      } catch (err: any) {
        setPaymentError(err.message || 'Payment failed');
      } finally {
        setSubmittingPayment(false);
      }
    },
    [activeMilestone, paymentAmount, paymentReference, paymentDate, paymentNotes, activeBooking, loadBookingDetail, fetchBookingsList, formatINR, showToast]
  );

  // Memoized client-side filtered bookings with debounced search
  const filteredBookings = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.booking_number.toLowerCase().includes(q) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        (b.unit_number && b.unit_number.toLowerCase().includes(q)) ||
        (b.project_name && b.project_name.toLowerCase().includes(q))
    );
  }, [bookings, debouncedSearch]);

  // Payment Collection History Pagination (Requested by user)
  const paymentsList = useMemo(() => activeBooking?.payments || [], [activeBooking]);
  const paymentPagination = usePagination(paymentsList, { initialPageSize: 5 });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Bookings & Milestone Collections
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage unit bookings, track the 4 payment milestones, record collections, and prevent overpayments.
        </p>
      </div>

      {/* Main Grid: Left Bookings List (4 cols) & Right Milestone Workspace (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Confirmed Bookings List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Confirmed Bookings ({filteredBookings.length})
              </span>
            </div>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search bookings..."
            />
          </div>

          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredBookings.map((b) => {
              const isSelected = activeBooking?.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => handleSelectBooking(b.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{b.booking_number}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                    {b.project_name} • Unit {b.unit_number}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {b.customer_name} ({b.bhk_type})
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Agreed Value</span>
                      <span className="font-extrabold text-slate-900">{formatINR(b.agreed_price)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block font-medium">Outstanding</span>
                      <span className="font-bold text-amber-600">{formatINR(b.total_outstanding)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {bookings.length === 0 && !loading && (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                No confirmed bookings yet. Accept a quotation and confirm booking first!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Booking Milestone Schedule & Payments */}
        <div className="lg:col-span-8 space-y-6">
          {activeBooking ? (
            <>
              {/* Top Overview Financial Card */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-700/80 pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider block">
                      Booking #{activeBooking.booking_number}
                    </span>
                    <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
                      {activeBooking.project_name} • {activeBooking.unit_number}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Customer: <strong className="text-slate-200">{activeBooking.customer_name}</strong> | Phone: {activeBooking.customer_mobile}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400 block font-medium">Booking Date</span>
                    <span className="text-sm font-semibold text-slate-200">
                      {new Date(activeBooking.booking_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* 3 Metric Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-400 font-medium block">Total Agreed Price</span>
                    <span className="text-xl font-extrabold text-white mt-1 block">
                      {formatINR(activeBooking.agreed_price)}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                    <span className="text-xs text-emerald-400 font-medium block">Total Collected</span>
                    <span className="text-xl font-extrabold text-emerald-400 mt-1 block">
                      {formatINR(activeBooking.total_collected)}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                    <span className="text-xs text-amber-400 font-medium block">Overall Outstanding</span>
                    <span className="text-xl font-extrabold text-amber-400 mt-1 block">
                      {formatINR(activeBooking.total_outstanding)}
                    </span>
                  </div>
                </div>
              </div>

              {/* The 4 Payment Milestones Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-700" />
                    Payment Milestone Schedule (10%, 20%, 30%, 40%)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Strict overpayment protection enabled</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {activeBooking.milestones?.map((milestone) => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      onRecordPayment={handleOpenPaymentModal}
                      formatINR={formatINR}
                    />
                  ))}
                </div>
              </div>

              {/* Payment History Audit Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-600" />
                    Payment Collection History ({paymentsList.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Reference ID</th>
                        <th className="px-5 py-3">Milestone</th>
                        <th className="px-5 py-3 text-right">Amount Paid</th>
                        <th className="px-5 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
                      {paymentPagination.paginatedItems.length > 0 ? (
                        paymentPagination.paginatedItems.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3 font-medium">
                              {formatDate(p.payment_date)}
                            </td>
                            <td className="px-5 py-3 font-mono font-bold text-slate-800">
                              {p.payment_reference}
                            </td>
                            <td className="px-5 py-3 font-semibold text-blue-700">
                              {p.milestone_name}
                            </td>
                            <td className="px-5 py-3 text-right font-extrabold text-emerald-600">
                              +{formatINR(p.amount)}
                            </td>
                            <td className="px-5 py-3 text-slate-400 italic">{p.notes || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">
                            No payments recorded yet for this booking. Click "Record Pay" on any milestone above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Reusable Global Pagination Component */}
                {paymentsList.length > 0 && (
                  <Pagination
                    currentPage={paymentPagination.currentPage}
                    totalPages={paymentPagination.totalPages}
                    totalItems={paymentPagination.totalItems}
                    startIndex={paymentPagination.startIndex}
                    endIndex={paymentPagination.endIndex}
                    pageSize={paymentPagination.pageSize}
                    onPageChange={paymentPagination.setPage}
                    onPageSizeChange={paymentPagination.setPageSize}
                    pageSizeOptions={[5, 10, 20]}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
              Select a booking from the left to view milestone schedules and record collections.
            </div>
          )}
        </div>
      </div>

      {/* Record Partial Payment Modal (Sticky top & fully visible) */}
      {paymentModalOpen && activeMilestone && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-700" />
                  Record Partial Payment
                </h3>
                <span className="text-xs text-slate-500">
                  Against <strong>{activeMilestone.name}</strong> Milestone ({activeMilestone.percentage}%)
                </span>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Milestone Balance Highlight */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Current Milestone Balance</span>
                  <span className="text-xs text-slate-400">Maximum payable amount</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-600 block">
                    {formatINR(activeMilestone.balance_amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const exactBal = Math.round((Number(activeMilestone.balance_amount) + Number.EPSILON) * 100) / 100;
                      setPaymentAmount(exactBal);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline mt-0.5 inline-block cursor-pointer"
                  >
                    Pay Full Balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Amount (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || '')}
                  className="w-full px-3.5 py-2.5 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Overpayments above remaining milestone balance are automatically rejected.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Unique Payment Reference ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC-NEFT-984029"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-semibold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Duplicate reference strings across all transactions are rejected.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes / Transaction Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received via RTGS from HDFC account"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingPayment ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
