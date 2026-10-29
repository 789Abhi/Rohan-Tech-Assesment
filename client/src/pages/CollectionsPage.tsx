import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getPaymentHistory } from '../services/api';
import { Payment } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { Pagination, SearchInput, Badge } from '../components/common';
import { formatDate } from '../utils/formatters';
import { Coins } from 'lucide-react';

// Memoized Payment Row for high-performance rendering
const PaymentRow = React.memo<{
  payment: Payment;
  formatINR: (amount: number | string | undefined) => string;
}>(({ payment: p, formatINR }) => {
  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-6 py-4 font-mono font-bold text-slate-900">{p.payment_reference}</td>
      <td className="px-6 py-4 font-medium">{formatDate(p.payment_date)}</td>
      <td className="px-6 py-4 font-semibold text-slate-800">{p.customer_name}</td>
      <td className="px-6 py-4">
        {p.project_name} • <strong className="text-blue-700">{p.unit_number}</strong>
      </td>
      <td className="px-6 py-4">
        <Badge variant="primary">{p.milestone_name}</Badge>
      </td>
      <td className="px-6 py-4 text-right font-black text-emerald-600">
        +{formatINR(p.amount)}
      </td>
      <td className="px-6 py-4 text-xs text-slate-400 italic">{p.notes || '—'}</td>
    </tr>
  );
});

PaymentRow.displayName = 'PaymentRow';

export const CollectionsPage: React.FC = () => {
  const { formatINR, showToast } = useApp();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search query (250ms)
  const debouncedSearch = useDebounce(searchQuery, 250);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentHistory();
      setPayments(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load collections history', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  // Memoized client-side filtering with useDebounce
  const filteredPayments = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.payment_reference.toLowerCase().includes(q) ||
        (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
        (p.project_name && p.project_name.toLowerCase().includes(q)) ||
        (p.unit_number && p.unit_number.toLowerCase().includes(q))
    );
  }, [payments, debouncedSearch]);

  // Reusable Pagination Hook (10 entries per page default)
  const pagination = usePagination(filteredPayments, { initialPageSize: 10 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Collections & Payment Receipts
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete transaction ledger across all milestone collections and payment references.
          </p>
        </div>

        {/* Total Collected Pill */}
        <div className="bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider block">Total Realized Collections</span>
            <span className="text-xl font-black text-emerald-800">{formatINR(totalCollected)}</span>
          </div>
        </div>
      </div>

      {/* Global Search Component */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by payment reference, customer name, project or unit..."
        />
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Payment Reference</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Property Unit</th>
                <th className="px-6 py-4">Milestone</th>
                <th className="px-6 py-4 text-right">Amount Received</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {pagination.paginatedItems.map((p) => (
                <PaymentRow key={p.id} payment={p} formatINR={formatINR} />
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

      {filteredPayments.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          No collections records found matching your query.
        </div>
      )}
    </div>
  );
};
export default CollectionsPage;
