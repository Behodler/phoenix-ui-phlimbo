import type { Stat, StatTone } from '../../../lib/uniV2MockMath';

const TONE_CLASS: Record<StatTone, string> = {
  default: 'text-foreground',
  warn: 'text-pxusd-yellow-400 font-semibold',
  danger: 'text-pxusd-pink-400 font-semibold',
  approve: 'text-pxusd-orange-300 font-semibold',
};

interface QuoteStatsProps {
  stats: Stat[];
  className?: string;
}

/** Definition list of quote rows (label left, value right). */
export default function QuoteStats({ stats, className = '' }: QuoteStatsProps) {
  return (
    <dl className={`m-0 flex flex-col gap-2 text-[13px] ${className}`}>
      {stats.map((s) => (
        <div key={s.label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{s.label}</dt>
          <dd className={`m-0 text-right ${TONE_CLASS[s.tone]}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
