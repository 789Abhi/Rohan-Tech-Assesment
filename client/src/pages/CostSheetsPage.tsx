import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getUnits, getCustomers, createCostSheet, getCostSheets, createQuotation } from '../services/api';
import { Unit, Customer, CostSheet } from '../types';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';
import { Pagination, SearchInput, Button, SelectField } from '../components/common';
import { formatDate } from '../utils/formatters';
import {
  Calculator,
  Printer,
  FileText,
  ArrowRight,
  X,
} from 'lucide-react';

// Memoized Cost Sheet Table Row
const CostSheetRow = React.memo<{
  costSheet: CostSheet;
  onPreview: (cs: CostSheet) => void;
  onGenerateQuotation: (id: number) => void;
  formatINR: (amount: number | string | undefined) => string;
}>(({ costSheet: cs, onPreview, onGenerateQuotation, formatINR }) => {
  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-6 py-4 font-mono font-bold text-blue-700">{cs.cost_sheet_number}</td>
      <td className="px-6 py-4 font-semibold text-slate-900">
        {cs.customer_name}
        <span className="block text-xs text-slate-400 font-normal">{cs.customer_mobile}</span>
      </td>
      <td className="px-6 py-4">
        {cs.project_name} • <strong className="text-slate-800">{cs.unit_number}</strong>
        <span className="block text-xs text-slate-400">{cs.bhk_type}</span>
      </td>
      <td className="px-6 py-4 text-slate-500">{formatINR(cs.listed_price)}</td>
      <td className="px-6 py-4 text-emerald-600 font-medium">
        {cs.discount_percentage}% ({formatINR(cs.discount_amount)})
      </td>
      <td className="px-6 py-4 font-bold text-slate-900">{formatINR(cs.final_offered_price)}</td>
      <td className="px-6 py-4 text-right space-x-2">
        <Button
          size="xs"
          variant="outline"
          onClick={() => onPreview(cs)}
        >
          View / PDF
        </Button>
        <Button
          size="xs"
          variant="primary"
          onClick={() => onGenerateQuotation(cs.id)}
        >
          Make Quotation
        </Button>
      </td>
    </tr>
  );
});

CostSheetRow.displayName = 'CostSheetRow';

export const CostSheetsPage: React.FC = () => {
  const {
    selectedUnit,
    selectedCustomer,
    setActiveTab,
    formatINR,
    showToast,
  } = useApp();

  const [units, setUnits] = useState<Unit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [costSheets, setCostSheets] = useState<CostSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [chosenUnitId, setChosenUnitId] = useState<number | ''>(selectedUnit ? selectedUnit.id : '');
  const [chosenCustomerId, setChosenCustomerId] = useState<number | ''>(
    selectedCustomer ? selectedCustomer.id : ''
  );
  const [discountPct, setDiscountPct] = useState<number>(1.0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Handle strictly bounded discount change (Enforces 0.00% - 2.00% Policy Cap)
  const handleDiscountChange = useCallback((valStr: string) => {
    if (valStr === '') {
      setDiscountPct(0);
      return;
    }
    const val = parseFloat(valStr);
    if (isNaN(val)) return;

    if (val > 2.0) {
      setDiscountPct(2.0);
      setFormError('Rohan Corporation policy strictly caps sales discounts at 2.00% maximum.');
    } else if (val < 0) {
      setDiscountPct(0);
      setFormError('Discount percentage cannot be negative.');
    } else {
      setDiscountPct(Math.round(val * 100) / 100);
      setFormError('');
    }
  }, []);

  // Selected Cost Sheet for Printable Modal
  const [previewCostSheet, setPreviewCostSheet] = useState<CostSheet | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [unitsRes, custRes, csRes] = await Promise.all([
        getUnits({ status: 'AVAILABLE' }),
        getCustomers(),
        getCostSheets(),
      ]);
      setUnits(unitsRes.data);
      setCustomers(custRes.data);
      setCostSheets(csRes.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load initial data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync when selectedUnit in context changes
  useEffect(() => {
    if (selectedUnit) setChosenUnitId(selectedUnit.id);
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedCustomer) setChosenCustomerId(selectedCustomer.id);
  }, [selectedCustomer]);

  // Derived Active Unit with useMemo
  const activeUnit = useMemo(() => {
    return units.find((u) => u.id === Number(chosenUnitId));
  }, [units, chosenUnitId]);

  const activeCustomer = useMemo(() => {
    return customers.find((c) => c.id === Number(chosenCustomerId));
  }, [customers, chosenCustomerId]);

  // Financial Calculations with useMemo
  const { listedPrice, discountAmount, finalOfferedPrice } = useMemo(() => {
    const lp = activeUnit ? Number(activeUnit.listed_price) : 0;
    const clampedDiscount = Math.min(2.0, Math.max(0, discountPct || 0));
    const da = Math.round((lp * (clampedDiscount / 100) + Number.EPSILON) * 100) / 100;
    const fop = Math.round((lp - da + Number.EPSILON) * 100) / 100;
    return { listedPrice: lp, discountAmount: da, finalOfferedPrice: fop };
  }, [activeUnit, discountPct]);

  // Search filter for historical Cost Sheets
  const debouncedSearch = useDebounce(searchQuery, 250);
  const filteredCostSheets = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return costSheets;
    return costSheets.filter(
      (cs) =>
        (cs.cost_sheet_number && cs.cost_sheet_number.toLowerCase().includes(q)) ||
        (cs.customer_name && cs.customer_name.toLowerCase().includes(q)) ||
        (cs.project_name && cs.project_name.toLowerCase().includes(q)) ||
        (cs.unit_number && cs.unit_number.toLowerCase().includes(q))
    );
  }, [costSheets, debouncedSearch]);

  // Pagination for Saved Cost Sheets
  const {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems: paginatedCostSheets,
    setPage,
    setPageSize,
  } = usePagination(filteredCostSheets, { initialPageSize: 5 });

  const handleSaveCostSheet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');

      if (!chosenUnitId) {
        setFormError('Please select an available property unit.');
        return;
      }

      if (!chosenCustomerId) {
        setFormError('Please select a customer.');
        return;
      }

      if (discountPct < 0 || discountPct > 2) {
        setFormError('Policy strictly enforces discount between 0.00% and 2.00%.');
        return;
      }

      setSaving(true);
      try {
        const res = await createCostSheet({
          unitId: Number(chosenUnitId),
          customerId: Number(chosenCustomerId),
          discountPercentage: Number(discountPct),
        });

        showToast(`Cost sheet ${res.data.cost_sheet_number} created successfully!`, 'success');
        setPreviewCostSheet(res.data);
        loadData();
      } catch (err: any) {
        setFormError(err.message || 'Failed to generate cost sheet');
      } finally {
        setSaving(false);
      }
    },
    [chosenUnitId, chosenCustomerId, discountPct, loadData, showToast]
  );

  const handleGenerateQuotation = useCallback(
    async (csId: number) => {
      try {
        const res = await createQuotation(csId);
        showToast(`Quotation ${res.data.quotation_number} generated from Cost Sheet!`, 'success');
        setPreviewCostSheet(null);
        setActiveTab('quotations');
      } catch (err: any) {
        showToast(err.message || 'Failed to generate quotation', 'error');
      }
    },
    [setActiveTab, showToast]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Cost Sheet Management
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Calculate itemized prices with 0%–2% policy discount cap and generate official quotations.
        </p>
      </div>

      {/* Two Column Layout: Calculator & Summary Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input Calculator Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cost Sheet Calculator</h2>
              <span className="text-xs text-slate-500">Inputs & Policy Compliance</span>
            </div>
          </div>

          <form onSubmit={handleSaveCostSheet} className="space-y-5">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Select Unit via Reusable SelectField */}
            <SelectField
              label="Select Available Unit"
              required
              value={chosenUnitId}
              onChange={(e) => setChosenUnitId(Number(e.target.value) || '')}
              placeholder="-- Choose an available unit --"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.project_name} • Unit {u.unit_number} ({u.bhk_type}, {u.area_sqft} sq ft) — {formatINR(u.listed_price)}
                </option>
              ))}
            </SelectField>

            {/* Select Customer via Reusable SelectField */}
            <SelectField
              label="Select Customer"
              required
              value={chosenCustomerId}
              onChange={(e) => setChosenCustomerId(Number(e.target.value) || '')}
              placeholder="-- Choose customer --"
              actionButton={
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  + Add Customer
                </button>
              }
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile}) - {c.email}
                </option>
              ))}
            </SelectField>

            {/* Discount Slider & Input */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Discount Percentage (Max 2.0%) *
                </label>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    discountPct > 2 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {discountPct}% Discount
                </span>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={discountPct}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="flex-1 accent-blue-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="w-24 relative">
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.05"
                    value={discountPct}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-bold text-center bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
                {[
                  { label: '0% (None)', val: 0 },
                  { label: '0.5%', val: 0.5 },
                  { label: '1.0% (Standard)', val: 1.0 },
                  { label: '1.5%', val: 1.5 },
                  { label: '2.0% (Max Policy)', val: 2.0 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setDiscountPct(preset.val);
                      setFormError('');
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition cursor-pointer ${
                      discountPct === preset.val
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-400 mt-2">
                Rohan Corporation policy strictly caps sales discounts at <strong>2.00% maximum</strong>. Values above 2% are blocked.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={saving}
                disabled={!chosenUnitId || !chosenCustomerId}
                className="w-full"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Save Cost Sheet
              </Button>
            </div>
          </form>
        </div>

        {/* Right: Real-Time Itemized Cost Sheet Card (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80 mb-5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Itemized Cost Breakdown
              </span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                Live Calculation
              </span>
            </div>

            {activeUnit ? (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Unit Details</span>
                  <span className="text-base font-bold text-white block">
                    {activeUnit.project_name} • {activeUnit.unit_number}
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeUnit.bhk_type} | {activeUnit.area_sqft} sq ft
                  </span>
                </div>

                {activeCustomer && (
                  <div>
                    <span className="text-xs text-slate-400 block">Customer</span>
                    <span className="text-sm font-semibold text-slate-200">
                      {activeCustomer.name} ({activeCustomer.mobile})
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-700 space-y-2.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Listed Price:</span>
                    <span className="font-semibold">{formatINR(listedPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Discount ({discountPct}%):</span>
                    <span className="font-semibold">- {formatINR(discountAmount)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-slate-700 flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Final Offered Price
                    </span>
                    <span className="text-xs text-slate-400">(Excludes GST & Stamp Duty)</span>
                  </div>
                  <span className="text-2xl font-black text-blue-400">
                    {formatINR(finalOfferedPrice)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-sm">
                Select an available unit from the left to calculate live cost breakdown.
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-700 text-xs text-slate-400">
            Formula: Final Offered Price = Listed Price − Discount Amount
          </div>
        </div>
      </div>

      {/* Saved Cost Sheets History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Saved Cost Sheets ({filteredCostSheets.length})</h3>
            <span className="text-xs text-slate-500 font-medium">Historical records retain original price & discount</span>
          </div>
          <div className="w-full sm:w-72">
            <SearchInput
              placeholder="Search cost sheets..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="py-1.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Cost Sheet #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Project & Unit</th>
                <th className="px-6 py-4">Listed Price</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Final Offered Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedCostSheets.map((cs) => (
                <CostSheetRow
                  key={cs.id}
                  costSheet={cs}
                  onPreview={setPreviewCostSheet}
                  onGenerateQuotation={handleGenerateQuotation}
                  formatINR={formatINR}
                />
              ))}
              {paginatedCostSheets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No cost sheets match your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Global Reusable Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCostSheets.length}
          startIndex={startIndex}
          endIndex={endIndex}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>

      {/* RESPONSIVE PRINTABLE / DOWNLOADABLE COST SHEET MODAL */}
      {previewCostSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-auto max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 print-page">
            
            {/* STICKY TOP ACTION HEADER: Always pinned at the top */}
            <div className="sticky top-0 z-20 px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shadow-md no-print shrink-0">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-100">
                  Cost Sheet Preview
                </span>
                <span className="hidden sm:inline-block font-mono text-xs text-blue-300 bg-slate-800 px-2 py-0.5 rounded">
                  {previewCostSheet.cost_sheet_number}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / Save</span> PDF
                </button>
                <button
                  onClick={() => handleGenerateQuotation(previewCostSheet.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Convert to</span> Quotation
                </button>
                <button
                  onClick={() => setPreviewCostSheet(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SCROLLABLE DOCUMENT BODY */}
            <div className="p-6 sm:p-10 space-y-6 bg-white text-slate-800 overflow-y-auto flex-1">
              {/* Letterhead */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-slate-200 pb-5 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">ROHAN CORPORATION</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Premier Real Estate & Infrastructure Developers</p>
                  <p className="text-xs text-slate-500">Mangalore, Karnataka, India</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">COST SHEET</span>
                  <span className="text-sm font-mono font-bold text-blue-700 block">{previewCostSheet.cost_sheet_number}</span>
                  <span className="text-xs text-slate-500">Date: {formatDate(previewCostSheet.created_at)}</span>
                </div>
              </div>

              {/* Customer & Unit Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Customer Details
                  </span>
                  <p className="font-bold text-slate-900">{previewCostSheet.customer_name}</p>
                  <p className="text-slate-600 text-xs">Phone: {previewCostSheet.customer_mobile}</p>
                  <p className="text-slate-600 text-xs">Email: {previewCostSheet.customer_email}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Unit Details
                  </span>
                  <p className="font-bold text-slate-900">{previewCostSheet.project_name}</p>
                  <p className="text-slate-600 text-xs">Unit Number: <strong>{previewCostSheet.unit_number}</strong></p>
                  <p className="text-slate-600 text-xs">Type: {previewCostSheet.bhk_type} ({previewCostSheet.area_sqft} sq ft)</p>
                </div>
              </div>

              {/* Itemized Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Itemized Financial Pricing</h4>
                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 text-xs font-bold uppercase">
                    <tr>
                      <th className="p-3 text-left">Component</th>
                      <th className="p-3 text-right">Calculation</th>
                      <th className="p-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-medium">Standard Listed Base Price</td>
                      <td className="p-3 text-right text-slate-400">Fixed Assessment Price</td>
                      <td className="p-3 text-right font-semibold">{formatINR(previewCostSheet.listed_price)}</td>
                    </tr>
                    <tr className="text-emerald-700 bg-emerald-50/50">
                      <td className="p-3 font-medium">Promotional Discount</td>
                      <td className="p-3 text-right">{previewCostSheet.discount_percentage}% applied</td>
                      <td className="p-3 text-right font-semibold">- {formatINR(previewCostSheet.discount_amount)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-900 text-base border-t-2 border-slate-300">
                      <td className="p-3" colSpan={2}>Final Offered Price</td>
                      <td className="p-3 text-right text-blue-700">{formatINR(previewCostSheet.final_offered_price)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-400 border-t border-slate-200 pt-4 leading-relaxed">
                * Note: Listed prices are fixed for this assessment; excludes GST, stamp duty, registration fees and other statutory charges. All currency values are in INR. Valid for quotation issuance.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
