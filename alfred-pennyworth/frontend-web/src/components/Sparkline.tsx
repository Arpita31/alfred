export function Sparkline({
  data, width = 80, height = 28, color = '#c9a84c',
}: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pad   = 2;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - pad - ((v - min) / range) * (height - pad * 2),
  ]);

  const d    = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fill = `${d} L${width},${height} L0,${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="sparkline-svg" aria-hidden>
      <path d={fill} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}
