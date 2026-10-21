import { InfoTip } from '@/components/ui/overlays';
import { formatINR } from '@/domain/money';
import { UNIT_HELP, UNIT_LABEL, type Unit, pricePerKgPaise } from '@/domain/units';
import { cn } from '@/lib/utils';

/** Farmer's asking price: per listing unit, with the per-kg equivalent underneath. */
export function AskingPrice({
  pricePerUnitPaise,
  unit,
  size = 'md',
  align = 'start',
  className,
}: {
  pricePerUnitPaise: number;
  unit: Unit;
  size?: 'md' | 'lg';
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <div className={cn('tabular flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5', align === 'end' && 'justify-end text-right', className)}>
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-forest">Asking</span>
      <span className={cn('font-display font-extrabold leading-none text-forest-deep', size === 'lg' ? 'text-[40px]' : 'text-2xl')}>
        {formatINR(pricePerUnitPaise)}
      </span>
      <span className={cn('text-muted', size === 'lg' ? 'text-base' : 'text-sm')}>/ {UNIT_LABEL[unit].singular}</span>
      {unit !== 'kg' ? (
        <span className={cn('basis-full text-muted', size === 'lg' ? 'text-[15px]' : 'text-[13px]')}>
          ≈ {formatINR(pricePerKgPaise(pricePerUnitPaise, unit))} per kg
        </span>
      ) : null}
    </div>
  );
}

export function UnitTip({ unit }: { unit: Unit }) {
  if (unit === 'kg') return null;
  return <InfoTip label={`What is a ${UNIT_LABEL[unit].singular}?`}>{UNIT_HELP[unit]}</InfoTip>;
}
