import clsx from 'clsx';

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  B: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  C: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  D: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  F: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

const GRADE_LABELS: Record<string, string> = {
  A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical',
};

export function GradeBadge({
  grade,
  showLabel = false,
  size = 'md',
}: {
  grade: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = GRADE_STYLES[grade] ?? GRADE_STYLES['F'];
  const sizeClass = size === 'lg'
    ? 'text-2xl font-bold px-4 py-2 rounded-xl'
    : size === 'sm'
    ? 'text-xs px-2 py-0.5 rounded'
    : 'text-sm font-semibold px-2.5 py-1 rounded-md';

  return (
    <span className={clsx('inline-flex items-center gap-1.5', style, sizeClass)}>
      {grade}
      {showLabel && <span className="text-xs opacity-70">{GRADE_LABELS[grade]}</span>}
    </span>
  );
}
