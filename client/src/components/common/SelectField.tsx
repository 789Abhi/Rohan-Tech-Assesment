import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  actionButton?: React.ReactNode;
}

export const SelectField: React.FC<SelectFieldProps> = React.memo(({
  label,
  error,
  helperText,
  options = [],
  placeholder = '-- Select an option --',
  actionButton,
  children,
  className = '',
  required,
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        {actionButton}
      </div>

      <select
        id={selectId}
        required={required}
        className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition text-slate-900 font-medium ${
          error
            ? 'border-rose-300 focus:ring-rose-500 text-rose-900 bg-rose-50/20'
            : 'border-slate-200 focus:ring-blue-500'
        } ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.length > 0
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {error ? (
        <p className="text-xs font-semibold text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
});

SelectField.displayName = 'SelectField';
export default SelectField;
