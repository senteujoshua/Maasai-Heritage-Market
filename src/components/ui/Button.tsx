'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';
    const variants = {
      primary: 'bg-maasai-red hover:bg-maasai-red-dark text-white focus:ring-maasai-red shadow-maasai',
      secondary: 'bg-maasai-brown hover:bg-maasai-brown-light text-white focus:ring-maasai-brown',
      outline: 'border-2 border-maasai-red text-maasai-red hover:bg-maasai-red hover:text-white focus:ring-maasai-red',
      ghost: 'text-maasai-brown hover:bg-maasai-beige/30 focus:ring-maasai-brown',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      gold: 'bg-maasai-gold hover:bg-yellow-600 text-maasai-black font-bold focus:ring-maasai-gold',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
      xl: 'px-8 py-4 text-lg',
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export { Button };
