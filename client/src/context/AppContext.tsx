import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Unit, Customer } from '../types';

export type NavTab =
  | 'dashboard'
  | 'inventory'
  | 'customers'
  | 'cost-sheets'
  | 'quotations'
  | 'bookings'
  | 'collections';

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedUnit: Unit | null;
  setSelectedUnit: (unit: Unit | null) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  selectedCostSheetId: number | null;
  setSelectedCostSheetId: (id: number | null) => void;
  selectedBookingId: number | null;
  setSelectedBookingId: (id: number | null) => void;
  toast: Toast | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  formatINR: (amount: number | string | undefined) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Restore activeTab from localStorage so refreshing keeps the user on the current tab
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('rohan_active_tab');
      if (saved && ['dashboard', 'inventory', 'customers', 'cost-sheets', 'quotations', 'bookings', 'collections'].includes(saved)) {
        return saved as NavTab;
      }
    } catch (e) {}
    return 'dashboard';
  });

  const setActiveTab = useCallback((tab: NavTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('rohan_active_tab', tab);
    } catch (e) {}
  }, []);

  const [selectedUnit, setSelectedUnitState] = useState<Unit | null>(null);
  const setSelectedUnit = useCallback((unit: Unit | null) => {
    setSelectedUnitState(unit);
  }, []);

  const [selectedCustomer, setSelectedCustomerState] = useState<Customer | null>(null);
  const setSelectedCustomer = useCallback((customer: Customer | null) => {
    setSelectedCustomerState(customer);
  }, []);

  const [selectedCostSheetId, setSelectedCostSheetIdState] = useState<number | null>(null);
  const setSelectedCostSheetId = useCallback((id: number | null) => {
    setSelectedCostSheetIdState(id);
  }, []);

  // Restore selected booking id from localStorage
  const [selectedBookingId, setSelectedBookingIdState] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('rohan_selected_booking_id');
      return saved ? Number(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const setSelectedBookingId = useCallback((id: number | null) => {
    setSelectedBookingIdState(id);
    try {
      if (id) {
        localStorage.setItem('rohan_selected_booking_id', id.toString());
      } else {
        localStorage.removeItem('rohan_selected_booking_id');
      }
    } catch (e) {}
  }, []);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const formatINR = useCallback((amount: number | string | undefined): string => {
    if (amount === undefined || amount === null) return '₹0';
    const num = Number(amount);
    if (isNaN(num)) return '₹0';

    // Show exact paise decimals when non-zero, otherwise clean integer formatting
    const hasDecimals = !Number.isInteger(num) && Math.abs(num - Math.round(num)) > 0.001;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(num);
  }, []);

  const contextValue = useMemo<AppContextType>(
    () => ({
      activeTab,
      setActiveTab,
      selectedUnit,
      setSelectedUnit,
      selectedCustomer,
      setSelectedCustomer,
      selectedCostSheetId,
      setSelectedCostSheetId,
      selectedBookingId,
      setSelectedBookingId,
      toast,
      showToast,
      formatINR,
    }),
    [
      activeTab,
      setActiveTab,
      selectedUnit,
      setSelectedUnit,
      selectedCustomer,
      setSelectedCustomer,
      selectedCostSheetId,
      setSelectedCostSheetId,
      selectedBookingId,
      setSelectedBookingId,
      toast,
      showToast,
      formatINR,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
