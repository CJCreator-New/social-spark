import React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode };

export default function CardBasic({ children, className = '', ...rest }: Props) {
  return (
    <div className={`bg-[color:var(--color-surface)] rounded-lg p-4 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}
