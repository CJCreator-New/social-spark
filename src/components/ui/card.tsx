import * as React from 'react';

export const Card = ({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-lg border border-white/6 bg-white/2 p-4 ${className}`} {...rest}>
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
