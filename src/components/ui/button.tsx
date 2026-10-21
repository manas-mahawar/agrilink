import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0 [&_svg]:size-[18px] cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-forest text-white hover:bg-forest-deep',
        secondary: 'border-line-strong bg-white text-forest hover:border-forest hover:text-forest-deep',
        accent: 'border-transparent bg-saffron text-ink hover:bg-saffron-deep',
        ghost: 'border-transparent bg-transparent text-ink hover:bg-sage',
        danger: 'border-danger-line bg-white text-danger-deep hover:border-danger-deep hover:bg-danger-bg',
        cream: 'border-transparent bg-cream text-forest-deep hover:bg-white',
        outlineLight: 'border-white/55 bg-transparent text-white hover:border-white hover:bg-white/10',
        link: 'h-auto border-transparent px-0 text-forest underline underline-offset-4 hover:text-forest-deep',
      },
      size: {
        sm: 'min-h-10 px-3.5 text-sm',
        md: 'min-h-11 px-[18px] text-[15px]',
        lg: 'min-h-[52px] px-6 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), variant === 'link' && 'min-h-0', className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
