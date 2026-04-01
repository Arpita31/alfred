const colors = {
  bg:       '#0d1117',
  surface:  '#161b22',
  surface1: '#161b22',
  surface2: '#1c2128',
  surface3: '#262c36',
  border:   '#30363d',
  text:     '#e6edf3',
  subtext:  '#7a8899',
  muted:    '#7a8899',
  accent:   '#c9a84c',
  yellow:   '#c9a84c',
  green:    '#3fb950',
  red:      '#f85149',
  blue:     '#58a6ff',
  purple:   '#a78bfa',
  orange:   '#f97316',
} as const;

export type Color = typeof colors[keyof typeof colors];
export { colors };
export default colors;
