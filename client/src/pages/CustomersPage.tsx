import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getCustomers, createCustomer, updateCustomer } from '../services/api';
import { Customer } from '../types';
import { Users, UserPlus, Edit2, Phone, Mail } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { Pagination, SearchInput, Button, InputField } from '../components/common';
import { formatDate } from '../utils/formatters';

// Memoized Customer Row for high-performance rendering
const CustomerRow = React.memo<{
  customer: Customer;
  onSelectForCostSheet: (c: Customer) => void;
  onEdit: (c: Customer) => void;
}>(({ customer: c, onSelectForCostSheet, onEdit }) => {
  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
      <td className="px-6 py-4 font-mono font-medium text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          {c.mobile}
        </span>
      </td>
      <td className="px-6 py-4 text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          {c.email}
        </span>
      </td>
      <td className="px-6 py-4 text-slate-500 text-xs">
        {formatDate(c.created_at)}
      </td>
      <td className="px-6 py-4 text-right space-x-2">
        <button
          onClick={() => onSelectForCostSheet(c)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
        >
          Use for Cost Sheet
        </button>
        <button
          onClick={() => onEdit(c)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          title="Edit Customer"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

export const CustomersPage: React.FC = () => {
  const { setSelectedCustomer, setActiveTab, showToast } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', mobile: '', email: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await getCustomers();
      setCustomers(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load customers', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounced search query for optimized performance
  const debouncedSearch = useDebounce(searchQuery, 250);

  // High-performance client-side filtering with useMemo & useDebounce
  const filteredCustomers = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const mobileMatch = c.mobile.includes(q);
      const emailMatch = c.email.toLowerCase().includes(q);
      return nameMatch || mobileMatch || emailMatch;
    });
  }, [customers, debouncedSearch]);

  // Global Pagination Hook
  const {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems: paginatedCustomers,
    setPage,
    setPageSize,
  } = usePagination(filteredCustomers, { initialPageSize: 10 });

  const handleOpenAdd = useCallback(() => {
    setEditingCustomer(null);
    setFormData({ name: '', mobile: '', email: '' });
    setFormError('');
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, mobile: customer.mobile, email: customer.email });
    setFormError('');
    setModalOpen(true);
  }, []);

  const handleSelectForCostSheet = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setActiveTab('cost-sheets');
      showToast(`Selected customer ${customer.name} for Cost Sheet!`, 'info');
    },
    [setSelectedCustomer, setActiveTab, showToast]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setFormError('Name must be at least 2 characters');
      return;
    }

    if (!/^[0-9]{10}$/.test(formData.mobile.trim())) {
      setFormError('Mobile number must be exactly 10 digits');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setFormError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
        showToast(`Customer ${formData.name} updated successfully!`, 'success');
      } else {
        await createCustomer(formData);
        showToast(`Customer ${formData.name} created successfully!`, 'success');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Customer Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Add, update, search customers with 10-digit mobile uniqueness validation.
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Add Customer
        </Button>
      </div>

      {/* Global Reusable Search Input */}
      <SearchInput
        placeholder="Search by customer name, 10-digit mobile, or email..."
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">10-Digit Mobile</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Registered Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedCustomers.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  onSelectForCostSheet={handleSelectForCostSheet}
                  onEdit={handleOpenEdit}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Global Reusable Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          startIndex={startIndex}
          endIndex={endIndex}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {filteredCustomers.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium">
            No customers found matching "{searchQuery}".
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <InputField
                label="Full Name"
                required
                placeholder="e.g. Ramesh Hegde"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <InputField
                label="10-Digit Mobile Number"
                required
                type="tel"
                maxLength={10}
                placeholder="e.g. 9845123456"
                helperText="Must be unique across all records"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                className="font-mono"
              />

              <InputField
                label="Email Address"
                required
                type="email"
                placeholder="e.g. ramesh@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                >
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
