import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
}

export default function Select({ label, options, className = '', id, ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-white/70">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent text-base ${className}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-pitch-darker">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
