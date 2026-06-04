import * as React from 'react';

export const Card = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-xl shadow-black/15 backdrop-blur-md transition-all duration-300 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-2 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold ${className}`} {...rest}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-slate-400 ${className}`} {...rest}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`pt-2 ${className}`} {...rest}>
    {children}
  </div>
);

export default Card;
