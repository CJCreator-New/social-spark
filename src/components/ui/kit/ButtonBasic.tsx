import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export default function ButtonBasic({ variant = 'primary', className = '', children, ...rest }: Props) {
  const base = 'rounded-md px-3 py-2 font-medium focus:outline-none';
  const variants: Record<string, string> = {
    primary: 'bg-[color:var(--color-primary)] text-white shadow-sm',
    ghost: 'bg-transparent text-[color:var(--color-text)] border border-transparent',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
