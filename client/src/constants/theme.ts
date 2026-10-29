/**
 * Centralized Design System Colors & Theme Tokens for Rohan Core Lite.
 * Ensures consistent visual hierarchy across all UI components, buttons, badges, and tables.
 */

export const THEME_COLORS = {
  // Brand Primary (Royal Blue)
  primary: {
    base: '#1d4ed8', // blue-700
    hover: '#1e40af', // blue-800
    light: '#eff6ff', // blue-50
    text: '#1d4ed8',
    border: '#bfdbfe', // blue-200
  },

  // Success / Confirmed (Emerald)
  success: {
    base: '#059669', // emerald-600
    hover: '#047857', // emerald-700
    light: '#ecfdf5', // emerald-50
    text: '#047857', // emerald-700
    border: '#a7f3d0', // emerald-200
  },

  // Warning / Pending (Amber)
  warning: {
    base: '#d97706', // amber-600
    hover: '#b45309', // amber-700
    light: '#fffbeb', // amber-50
    text: '#b45309', // amber-700
    border: '#fde68a', // amber-200
  },

  // Danger / Rejection (Rose)
  danger: {
    base: '#e11d48', // rose-600
    hover: '#be123c', // rose-700
    light: '#fff1f2', // rose-50
    text: '#be123c', // rose-700
    border: '#fecdd3', // rose-200
  },

  // Neutral / Slate
  neutral: {
    bg: '#f8fafc', // slate-50
    card: '#ffffff',
    border: '#e2e8f0', // slate-200
    textPrimary: '#0f172a', // slate-900
    textSecondary: '#64748b', // slate-500
    textMuted: '#94a3b8', // slate-400
  },
} as const;

export const BUTTON_CLASSES = {
  primary: 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs focus:ring-blue-500',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 focus:ring-slate-400',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 focus:ring-slate-400',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 focus:ring-slate-400',
} as const;

export const BADGE_CLASSES = {
  primary: 'bg-blue-50 text-blue-700 border border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200',
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const;
