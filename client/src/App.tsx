import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Toast } from './components/Toast';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { CostSheetsPage } from './pages/CostSheetsPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { BookingsPage } from './pages/BookingsPage';
import { CollectionsPage } from './pages/CollectionsPage';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'inventory' && <InventoryPage />}
        {activeTab === 'customers' && <CustomersPage />}
        {activeTab === 'cost-sheets' && <CostSheetsPage />}
        {activeTab === 'quotations' && <QuotationsPage />}
        {activeTab === 'bookings' && <BookingsPage />}
        {activeTab === 'collections' && <CollectionsPage />}
      </main>

      {/* Global Toast Notification */}
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
