import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getDashboardStats } from '../services/api';
import { DashboardStats } from '../types';
import {
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { setActiveTab, formatINR, showToast } = useApp();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard data', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats(!stats);
  }, [fetchStats]);

  // Memoized percentage calculations
  const { availablePct, collectionPct } = useMemo(() => {
    const ap = stats?.units.total
      ? Math.round((stats.units.available / stats.units.total) * 100)
      : 0;

    const cp = stats?.financials.totalBookingValue
      ? Math.round((stats.financials.totalCollected / stats.financials.totalBookingValue) * 100)
      : 0;

    return { availablePct: ap, collectionPct: cp };
  }, [stats]);

  // Only show full loader if there is NO data yet (initial cold load)
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading Rohan Core Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Quick Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 sm:p-8 rounded-2xl shadow-md">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-800 text-blue-200 mb-2">
            Rohan Corporation • Executive Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Property & Collections Overview
          </h1>
          <p className="text-blue-200 text-sm mt-1 max-w-xl">
            Real-time pipeline monitoring across inventory units, approved cost sheets, quotation lifecycles, and milestone collections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('inventory')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition shadow-sm cursor-pointer"
          >
            Explore Inventory <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('cost-sheets')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-sm transition border border-blue-500 cursor-pointer"
          >
            Create Cost Sheet
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Inventory Units */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Unit Inventory
              </span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats?.units.available ?? 0}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                / {stats?.units.total ?? 0} Available
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2 mb-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${availablePct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>{availablePct}% Available</span>
              <span>{stats?.units.booked ?? 0} Booked</span>
            </div>
          </div>
        </div>

        {/* Card 2: Accepted Booking Value */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Confirmed Bookings
              </span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
              {formatINR(stats?.financials.totalBookingValue)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{stats?.counts.bookings ?? 0} Confirmed Bookings</span>
            <span className="text-indigo-600 font-semibold">{stats?.counts.acceptedQuotations ?? 0} Accepted Quo</span>
          </div>
        </div>

        {/* Card 3: Total Collections */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Collections
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 truncate">
              {formatINR(stats?.financials.totalCollected)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2 mb-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>{collectionPct}% of Booked Value</span>
              <span className="text-emerald-700 font-semibold">Realized</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Outstanding */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Outstanding Balance
              </span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 truncate">
              {formatINR(stats?.financials.totalOutstanding)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pending Milestone Dues</span>
            <span className="text-amber-700 font-semibold">To Collect</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Bookings & Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Bookings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              Recent Confirmed Bookings
            </h3>
            <button
              onClick={() => setActiveTab('bookings')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              View All ({stats?.counts.bookings ?? 0})
            </button>
          </div>

          {stats?.recentBookings && stats.recentBookings.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {stats.recentBookings.map((b) => (
                <div key={b.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 block">
                      {b.project_name} • {b.unit_number}
                    </span>
                    <span className="text-xs text-slate-500">
                      Customer: <strong className="text-slate-700">{b.customer_name}</strong> ({b.bhk_type})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-700 block">
                      {formatINR(b.agreed_price)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(b.booking_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              No confirmed bookings yet. Convert an accepted quotation to see it here!
            </div>
          )}
        </div>

        {/* Recent Payments & Collections */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              Recent Milestone Collections
            </h3>
            <button
              onClick={() => setActiveTab('collections')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              View All Payments
            </button>
          </div>

          {stats?.recentPayments && stats.recentPayments.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {stats.recentPayments.map((p) => (
                <div key={p.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 block">
                      {p.customer_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.project_name} ({p.unit_number}) • <span className="font-semibold text-slate-600">{p.milestone_name}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600 block">
                      +{formatINR(p.amount)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Ref: {p.payment_reference}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              No payments collected yet. Record partial payments against booking milestones.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
