import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-pitch-darker font-bold hover:bg-gold-dim active:scale-95 shadow-gold',
  secondary: 'bg-pitch text-white font-semibold hover:bg-pitch-dark active:scale-95 border border-white/10',
  ghost: 'bg-transparent text-white/90 hover:bg-white/10 border border-white/20',
  danger: 'bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-95',
};

export default function Button({ variant = 'primary', className = '', disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`px-5 py-3 rounded-xl text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 touch-manipulation ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
