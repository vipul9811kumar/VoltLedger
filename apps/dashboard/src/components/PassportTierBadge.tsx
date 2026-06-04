import type { PassportTier } from '@/lib/data';

interface Props {
  tier: PassportTier;
  verified?: boolean;
  size?: 'sm' | 'md';
}

const TIER_STYLES: Record<PassportTier, { label: string; classes: string }> = {
  PUBLIC:       { label: 'Public Tier',       classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  RESTRICTED:   { label: 'Restricted Tier',   classes: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  CONFIDENTIAL: { label: 'Confidential Tier', classes: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
};

export function PassportTierBadge({ tier, verified, size = 'md' }: Props) {
  const style = TIER_STYLES[tier];
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono ${textSize} ${style.classes}`}>
      {style.label}
      {verified && (
        <span className="text-emerald-400" title="Identity verified">✓</span>
      )}
    </span>
  );
}
