export function ProgressRing({
  pct, size = 64, stroke = 5, color = '#c9a84c',
  bg = 'rgba(255,255,255,0.06)', label, sublabel,
}: {
  pct: number; size?: number; stroke?: number;
  color?: string; bg?: string; label?: string; sublabel?: string;
}) {
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct)));

  return (
    <div className="prog-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      {label !== undefined && (
        <div className="prog-ring-inner">
          <span className="prog-ring-val">{label}</span>
          {sublabel && <span className="prog-ring-sub">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
