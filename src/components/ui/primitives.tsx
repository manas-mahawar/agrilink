import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold leading-none [&_svg]:size-3',
  {
    variants: {
      tone: {
        ok: 'bg-ok-bg text-ok-fg',
        wait: 'bg-wait-bg text-wait-fg',
        info: 'bg-info-bg text-info-fg',
        neutral: 'bg-neutral-bg text-neutral-fg',
        forest: 'bg-forest text-white',
        saffron: 'bg-saffron text-ink',
        demo: 'bg-ink text-cream',
        danger: 'bg-danger-bg text-danger-deep',
        light: 'bg-cream/95 text-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-white', className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-skeleton rounded-md bg-[linear-gradient(90deg,#ebeae0,#f5f4ec,#ebeae0)] bg-[length:200%_100%]', className)}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('eyebrow', className)} {...props} />;
}

const alertTones = {
  info: 'border-info-bg bg-info-bg/60 text-info-fg',
  warn: 'border-wait-bg bg-wait-bg/70 text-wait-fg',
  ok: 'border-ok-bg bg-ok-bg/70 text-ok-fg',
  danger: 'border-danger-line bg-danger-bg text-danger-deep',
} as const;

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', alertTones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-lg border border-line bg-white px-6 py-12 text-center', className)}>
      {icon ? (
        <span className="flex size-14 items-center justify-center rounded-full bg-sage text-forest [&_svg]:size-6">{icon}</span>
      ) : null}
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children ? <div className="max-w-md text-[15px] text-muted">{children}</div> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="tabular font-display text-[28px] font-extrabold leading-tight text-forest-deep">{value}</span>
      {note ? <span className="text-[13px] text-muted">{note}</span> : null}
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow ? <span className="text-sm text-muted">{eyebrow}</span> : null}
        <h1 className="text-[clamp(1.75rem,3vw,2.4rem)] font-extrabold text-forest-deep">{title}</h1>
        {description ? <p className="text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
