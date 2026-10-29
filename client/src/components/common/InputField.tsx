import React from 'react';

export interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = React.memo(({
  label,
  error,
  helperText,
  prefix,
  suffix,
  className = '',
  required,
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-600">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-slate-400 font-bold text-xs select-none pointer-events-none">
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          required={required}
          className={`w-full text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
            error
              ? 'border-rose-300 focus:ring-rose-500 text-rose-900 bg-rose-50/20'
              : 'border-slate-200 focus:ring-blue-500 text-slate-900'
          } ${prefix ? 'pl-8' : 'px-3.5'} ${suffix ? 'pr-8' : 'px-3.5'} py-2.5 ${className}`}
          {...props}
        />

        {suffix && (
          <span className="absolute right-3 text-slate-400 font-bold text-xs select-none pointer-events-none">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs font-semibold text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
});

InputField.displayName = 'InputField';
export default InputField;
