type Provenance = 'REAL_ANCHORED' | 'SIMULATED_CALIBRATED' | 'ILLUSTRATIVE';

interface Props {
  provenance: Provenance;
  size?: 'sm' | 'md';
}

const PROVENANCE_STYLES: Record<Provenance, { label: string; classes: string }> = {
  REAL_ANCHORED:         { label: 'Real Anchored',         classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  SIMULATED_CALIBRATED:  { label: 'Simulated · Calibrated', classes: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  ILLUSTRATIVE:          { label: 'Illustrative',           classes: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

export function ProvenanceBadge({ provenance, size = 'md' }: Props) {
  const style = PROVENANCE_STYLES[provenance];
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-mono ${textSize} ${style.classes}`}>
      {style.label}
    </span>
  );
}
