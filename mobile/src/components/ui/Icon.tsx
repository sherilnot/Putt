import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme';

// Custom 24×24 line icon set. Shapes are drawn on a 1.8px stroke with round joins;
// `filled` adds a soft tint inside closed shapes (used for active tabs and highlights).
type Shape =
  | { d: string }
  | { circle: [number, number, number] }
  | { rect: [number, number, number, number, number] };

const ICONS = {
  home: [{ d: 'M3 10.5 12 3l9 7.5' }, { d: 'M5 9.2V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.2' }],
  bowl: [{ d: 'M3 11h18a9 8 0 0 1-18 0Z' }, { d: 'M9 7.5c0-1.3 1.2-1.7 1.2-3' }, { d: 'M13.5 7.5c0-1.3 1.2-1.7 1.2-3' }],
  calendar: [{ rect: [3, 5, 18, 16, 2.5] }, { d: 'M3 10h18' }, { d: 'M8 3v4' }, { d: 'M16 3v4' }],
  receipt: [{ d: 'M6 3h12v18l-3-2-3 2-3-2-3 2Z' }, { d: 'M9 8h6' }, { d: 'M9 12h6' }, { d: 'M9 16h3' }],
  user: [{ circle: [12, 8, 4] }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  users: [{ circle: [9, 8, 3.5] }, { d: 'M3 20a6 6 0 0 1 12 0' }, { d: 'M16 4.5a3.5 3.5 0 0 1 0 7' }, { d: 'M17 14.5a6 6 0 0 1 4 5.5' }],
  clock: [{ circle: [12, 12, 9] }, { d: 'M12 7v5l3.2 2' }],
  check: [{ d: 'M5 12.5 9.5 17 19 7' }],
  checkCircle: [{ circle: [12, 12, 9] }, { d: 'm8 12.3 2.7 2.7L16 9.6' }],
  chevronRight: [{ d: 'm9 5 7 7-7 7' }],
  chevronLeft: [{ d: 'm15 5-7 7 7 7' }],
  chevronDown: [{ d: 'm5 9 7 7 7-7' }],
  plus: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
  close: [{ d: 'M6 6l12 12' }, { d: 'M18 6 6 18' }],
  arrowRight: [{ d: 'M5 12h14' }, { d: 'm13 6 6 6-6 6' }],
  logout: [{ d: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3' }, { d: 'm10 16-4-4 4-4' }, { d: 'M6 12h10' }],
  leaf: [{ d: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z' }, { d: 'm5 19 8-8' }],
  flame: [{ d: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 1.5 2 2 2.5.5-2.5.5-5 1-7.5Z' }],
  sparkle: [{ d: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z' }, { d: 'm19 15.5.7 1.8 1.8.7-1.8.7L19 20.5l-.7-1.8-1.8-.7 1.8-.7Z' }],
  wallet: [{ rect: [3, 6, 18, 14, 2.5] }, { d: 'M3 10h18' }, { d: 'M15.5 15h2.5' }],
  cash: [{ rect: [2.5, 6, 19, 12, 2] }, { circle: [12, 12, 2.6] }, { d: 'M6 10v4' }, { d: 'M18 10v4' }],
  chef: [{ d: 'M7 13a4 4 0 1 1 1.5-7.7A4 4 0 0 1 16 5.3 4 4 0 1 1 17 13' }, { d: 'M7 13v6h10v-6' }, { d: 'M7 16h10' }],
  bag: [{ d: 'M5 8h14l-1 12H6Z' }, { d: 'M9 8V6a3 3 0 0 1 6 0v2' }],
  store: [{ d: 'M4 9 5.5 4h13L20 9' }, { d: 'M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0' }, { d: 'M5 11v9h14v-9' }, { d: 'M10 20v-5h4v5' }],
  lock: [{ rect: [5, 11, 14, 10, 2] }, { d: 'M8 11V8a4 4 0 0 1 8 0v3' }],
  trash: [{ d: 'M4 7h16' }, { d: 'M9 7V4h6v3' }, { d: 'M6 7l1 13h10l1-13' }],
  phone: [{ d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z' }],
  mail: [{ rect: [3, 5, 18, 14, 2.5] }, { d: 'm3 7 9 6 9-6' }],
  bell: [{ d: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4Z' }, { d: 'M10 20a2 2 0 0 0 4 0' }],
  eye: [{ d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z' }, { circle: [12, 12, 3] }],
  eyeOff: [{ d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z' }, { circle: [12, 12, 3] }, { d: 'M4 4l16 16' }],
  grid: [{ rect: [3, 3, 7, 7, 2] }, { rect: [14, 3, 7, 7, 2] }, { rect: [3, 14, 7, 7, 2] }, { rect: [14, 14, 7, 7, 2] }],
  pause: [{ circle: [12, 12, 9] }, { d: 'M10 9v6' }, { d: 'M14 9v6' }],
  play: [{ circle: [12, 12, 9] }, { d: 'm10 8.5 5 3.5-5 3.5Z' }],
  refresh: [{ d: 'M20 11a8 8 0 1 0-2.3 5.7' }, { d: 'M20 4v7h-7' }],
  info: [{ circle: [12, 12, 9] }, { d: 'M12 11v5' }, { d: 'M12 8v.01' }],
  cloche: [{ d: 'M3 18h18' }, { d: 'M5 18a7 7 0 0 1 14 0' }, { d: 'M12 9V7' }, { d: 'M10.5 7h3' }],
  pin: [{ d: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z' }, { circle: [12, 10, 2.5] }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = colors.text,
  strokeWidth = 1.8,
  filled = false,
}) => {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: filled ? color : 'none',
    fillOpacity: filled ? 0.16 : 0,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(ICONS[name] as Shape[]).map((s, i) => {
        if ('circle' in s) return <Circle key={i} cx={s.circle[0]} cy={s.circle[1]} r={s.circle[2]} {...common} />;
        if ('rect' in s) {
          const [x, y, w, h, r] = s.rect;
          return <Rect key={i} x={x} y={y} width={w} height={h} rx={r} {...common} />;
        }
        return <Path key={i} d={s.d} {...common} />;
      })}
    </Svg>
  );
};
