/**
 * Centralized Formatter and Utility Functions for Rohan Core Lite.
 */

export const formatDate = (dateString?: string | Date | null): string => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export const formatPercent = (val: number | string | undefined): string => {
  if (val === undefined || val === null) return '0%';
  const num = Number(val);
  return isNaN(num) ? '0%' : `${num.toFixed(num % 1 !== 0 ? 1 : 0)}%`;
};

export const generatePaymentReference = (): string => {
  return `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
};
