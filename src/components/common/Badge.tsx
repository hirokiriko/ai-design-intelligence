import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-line bg-white text-muted',
  accent: 'border-teal-200 bg-teal-50 text-accent',
  warning: 'border-amber-200 bg-amber-50 text-caution',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
