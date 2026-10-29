import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getUnits } from '../services/api';
import { Unit } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { Pagination, SearchInput, Button, Badge } from '../components/common';
import {
  Calculator,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  List,
} from 'lucide-react';

// Memoized Unit Card for Grid View
const UnitCard = React.memo<{
  unit: Unit;
  onGenerateCostSheet: (u: Unit) => void;
  formatINR: (amount: number | string | undefined) => string;
}>(({ unit, onGenerateCostSheet, formatINR }) => {
  const isAvailable = unit.status === 'AVAILABLE';

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
        isAvailable ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50/60 opacity-90'
      }`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {unit.project_name}
          </span>
          <Badge
            variant={isAvailable ? 'success' : 'danger'}
            icon={isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          >
            {isAvailable ? 'Available' : 'Booked'}
          </Badge>
        </div>

        <h3 className="text-2xl font-black text-slate-900 tracking-tight">
          {unit.unit_number}
        </h3>

        <div className="flex items-center gap-4 my-4 py-3 border-y border-slate-100 text-sm text-slate-600 font-medium">
          <span>🛏️ <strong>{unit.bhk_type}</strong></span>
          <span>📐 <strong>{unit.area_sqft}</strong> sq.ft</span>
        </div>

        <div>
          <span className="text-xs text-slate-400 block font-medium">Fixed Listed Price</span>
          <span className="text-xl font-extrabold text-blue-700">
            {formatINR(unit.listed_price)}
          </span>
        </div>
      </div>

      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {isAvailable ? 'Ready for Cost Sheet' : 'Sold Unit'}
        </span>
        <Button
          disabled={!isAvailable}
          onClick={() => onGenerateCostSheet(unit)}
          variant={isAvailable ? 'primary' : 'secondary'}
          size="sm"
          icon={<Calculator className="w-3.5 h-3.5" />}
        >
          Generate Cost Sheet
        </Button>
      </div>
    </div>
  );
});

UnitCard.displayName = 'UnitCard';

// Memoized Unit Row for Table View
const UnitRow = React.memo<{
  unit: Unit;
  onGenerateCostSheet: (u: Unit) => void;
  formatINR: (amount: number | string | undefined) => string;
}>(({ unit: u, onGenerateCostSheet, formatINR }) => {
  const isAvailable = u.status === 'AVAILABLE';

  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-6 py-4 font-semibold text-slate-900">{u.project_name}</td>
      <td className="px-6 py-4 font-bold text-blue-700">{u.unit_number}</td>
      <td className="px-6 py-4">{u.bhk_type}</td>
      <td className="px-6 py-4">{u.area_sqft} sq ft</td>
      <td className="px-6 py-4 font-bold">{formatINR(u.listed_price)}</td>
      <td className="px-6 py-4">
        <Badge variant={isAvailable ? 'success' : 'danger'}>
          {isAvailable ? 'Available' : 'Booked'}
        </Badge>
      </td>
      <td className="px-6 py-4 text-right">
        <Button
          disabled={!isAvailable}
          onClick={() => onGenerateCostSheet(u)}
          variant={isAvailable ? 'primary' : 'secondary'}
          size="xs"
        >
          Cost Sheet
        </Button>
      </td>
    </tr>
  );
});

UnitRow.displayName = 'UnitRow';

export const InventoryPage: React.FC = () => {
  const { setSelectedUnit, setActiveTab, formatINR, showToast } = useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter States
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [bhkFilter, setBhkFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUnits({
        project: projectFilter,
        bhk: bhkFilter,
        status: statusFilter,
      });
      setUnits(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load inventory units', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, bhkFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Debounce search query to prevent unnecessary re-filters on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Client-side search memoized with useMemo & useDebounce
  const filteredUnits = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.unit_number.toLowerCase().includes(q) ||
        u.project_name.toLowerCase().includes(q) ||
        u.bhk_type.toLowerCase().includes(q)
    );
  }, [units, debouncedSearch]);

  // Global Pagination Hook for Inventory (Grid or Table)
  const {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems: paginatedUnits,
    setPage,
    setPageSize,
  } = usePagination(filteredUnits, { initialPageSize: 6 });

  const handleCreateCostSheet = useCallback(
    (unit: Unit) => {
      setSelectedUnit(unit);
      setActiveTab('cost-sheets');
      showToast(`Selected ${unit.project_name} (${unit.unit_number}) for Cost Sheet generation!`, 'info');
    },
    [setSelectedUnit, setActiveTab, showToast]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Project & Unit Inventory
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Displaying fixed 12 assessment units across Rohan Nest, City, Park & Estate.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border text-sm font-medium transition cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg border text-sm font-medium transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar with Reusable SearchInput */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
        {/* Search Input */}
        <div className="w-full flex-1">
          <SearchInput
            placeholder="Search by unit number or project..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Project Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Project:</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              <option value="Rohan Nest">Rohan Nest</option>
              <option value="Rohan City">Rohan City</option>
              <option value="Rohan Park">Rohan Park</option>
              <option value="Rohan Estate">Rohan Estate</option>
            </select>
          </div>

          {/* BHK Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">BHK:</span>
            <select
              value={bhkFilter}
              onChange={(e) => setBhkFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="1 BHK">1 BHK</option>
              <option value="2 BHK">2 BHK</option>
              <option value="3 BHK">3 BHK</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="BOOKED">Booked</option>
            </select>
          </div>

          {(projectFilter !== 'ALL' || bhkFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setProjectFilter('ALL');
                setBhkFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedUnits.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                onGenerateCostSheet={handleCreateCostSheet}
                formatINR={formatINR}
              />
            ))}
          </div>

          {/* Pagination for Grid View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredUnits.length}
              startIndex={startIndex}
              endIndex={endIndex}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[6, 12, 24]}
            />
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Unit #</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Area</th>
                  <th className="px-6 py-4">Listed Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedUnits.map((u) => (
                  <UnitRow
                    key={u.id}
                    unit={u}
                    onGenerateCostSheet={handleCreateCostSheet}
                    formatINR={formatINR}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination for Table View */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUnits.length}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 12, 24]}
          />
        </div>
      )}

      {/* Empty State */}
      {filteredUnits.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium">No units found matching your filter criteria.</p>
        </div>
      )}
    </div>
  );
};
