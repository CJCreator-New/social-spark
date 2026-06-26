import * as React from 'react';

export const Card = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_10px_30px_rgba(120,113,108,0.06),0_1px_3px_rgba(120,113,108,0.02)] transition-all duration-300 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-2 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`font-display text-lg font-semibold text-stone-900 ${className}`} {...rest}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-stone-500 ${className}`} {...rest}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`pt-2 ${className}`} {...rest}>
    {children}
  </div>
);

export default Card;
