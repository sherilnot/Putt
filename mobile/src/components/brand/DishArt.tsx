import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

// Small hand-drawn illustrations for the mess's dish families, so the menu has
// imagery without needing photos. The family and curry colour come from the dish name.
type Family = 'biriyani' | 'kabsa' | 'kappa' | 'puttu' | 'idiyappam' | 'rice';

const familyOf = (name: string): Family => {
  const n = name.toLowerCase();
  if (n.includes('biriyani') || n.includes('biryani')) return 'biriyani';
  if (n.includes('kabsa')) return 'kabsa';
  if (n.includes('kappa')) return 'kappa';
  if (n.includes('puttu') || n.includes('putti')) return 'puttu';
  if (n.includes('idiyappam')) return 'idiyappam';
  return 'rice';
};

const curryOf = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('chickpea') || n.includes('kadala')) return { base: '#9A4A1C', bits: '#E2B04A' };
  if (n.includes('egg')) return { base: '#C2662A', bits: '#F4D26B' };
  if (n.includes('fish')) return { base: '#C4562A', bits: '#F1C9A6' };
  if (n.includes('beef')) return { base: '#5E2412', bits: '#8E3E22' };
  if (n.includes('mutton')) return { base: '#6E3418', bits: '#A0522D' };
  if (n.includes('veg')) return { base: '#5E7F34', bits: '#E59A3A' };
  return { base: '#B85A26', bits: '#E7A35A' }; // chicken
};

const BG: Record<Family, string> = {
  biriyani: '#F6E3C4',
  kabsa: '#F3E6CF',
  kappa: '#F4ECCB',
  puttu: '#EFE7DA',
  idiyappam: '#EDE8DF',
  rice: '#F2E4D2',
};

const CurryBowl: React.FC<{ x: number; y: number; r: number; base: string; bits: string }> = ({ x, y, r, base, bits }) => (
  <G>
    <Path d={`M${x - r} ${y}h${2 * r}a${r} ${r * 0.8} 0 0 1 -${2 * r} 0Z`} fill="#2A1E16" />
    <Ellipse cx={x} cy={y} rx={r} ry={r * 0.3} fill={base} />
    <Circle cx={x - r * 0.35} cy={y - r * 0.05} r={r * 0.18} fill={bits} />
    <Circle cx={x + r * 0.3} cy={y - r * 0.08} r={r * 0.16} fill={bits} />
  </G>
);

export const DishArt: React.FC<{ name: string; size?: number }> = ({ name, size = 56 }) => {
  const family = familyOf(name);
  const curry = curryOf(name);

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="0" y="0" width="64" height="64" rx="18" fill={BG[family]} />

      {family === 'biriyani' && (
        <G>
          {/* handi pot with saffron rice */}
          <Path d="M14 30h36l-3 18a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5Z" fill="#B8642E" />
          <Rect x="12" y="27" width="40" height="5" rx="2.5" fill="#7E3A16" />
          <Path d="M16 27c2-8 10-12 16-12s14 4 16 12Z" fill="#FBF3E2" />
          <Circle cx="25" cy="21" r="1.6" fill="#E3A23B" />
          <Circle cx="33" cy="18" r="1.6" fill="#E3A23B" />
          <Circle cx="39" cy="22" r="1.6" fill="#E3A23B" />
          <Circle cx="29" cy="24" r="1.4" fill={curry.bits} />
          <Path d="M24 40h16" stroke="#E2A267" strokeWidth="2" strokeLinecap="round" />
        </G>
      )}

      {family === 'kabsa' && (
        <G>
          {/* platter with golden rice and a drumstick */}
          <Ellipse cx="32" cy="42" rx="24" ry="9" fill="#FFFDF9" />
          <Ellipse cx="32" cy="42" rx="24" ry="9" fill="none" stroke="#D9C4A3" strokeWidth="1.5" />
          <Path d="M14 40c2-9 10-14 18-14s16 5 18 14Z" fill="#E9C27A" />
          <Circle cx="24" cy="34" r="1.4" fill="#C47A2C" />
          <Circle cx="38" cy="31" r="1.4" fill="#C47A2C" />
          <Ellipse cx="34" cy="28" rx="7" ry="4.5" fill={curry.base} transform="rotate(-25 34 28)" />
          <Path d="M40 24l5-4" stroke="#F5EBDD" strokeWidth="2.6" strokeLinecap="round" />
        </G>
      )}

      {family === 'kappa' && (
        <G>
          {/* tapioca chunks beside curry */}
          <Rect x="9" y="30" width="15" height="11" rx="4" fill="#F2DA8B" stroke="#C9A64B" strokeWidth="1.2" transform="rotate(-12 16 35)" />
          <Rect x="15" y="39" width="15" height="11" rx="4" fill="#F5E29E" stroke="#C9A64B" strokeWidth="1.2" transform="rotate(10 22 44)" />
          <Rect x="11" y="19" width="13" height="10" rx="4" fill="#F7E7AE" stroke="#C9A64B" strokeWidth="1.2" />
          <CurryBowl x={44} y={36} r={11} {...curry} />
        </G>
      )}

      {family === 'puttu' && (
        <G>
          {/* layered puttu cylinder with curry */}
          <Rect x="11" y="13" width="16" height="36" rx="4" fill="#FFFDF9" stroke="#D9C4A3" strokeWidth="1.2" />
          <Rect x="11" y="22" width="16" height="3.2" fill="#E9D8BC" />
          <Rect x="11" y="31" width="16" height="3.2" fill="#E9D8BC" />
          <Rect x="11" y="40" width="16" height="3.2" fill="#E9D8BC" />
          <CurryBowl x={43} y={38} r={12} {...curry} />
        </G>
      )}

      {family === 'idiyappam' && (
        <G>
          {/* string-hopper nests with curry */}
          {[
            [21, 26],
            [17, 40],
            [30, 44],
          ].map(([cx, cy], i) => (
            <G key={i}>
              <Circle cx={cx} cy={cy} r="8" fill="#FFFDF9" stroke="#DCCFBD" strokeWidth="1.2" />
              <Circle cx={cx} cy={cy} r="5" fill="none" stroke="#E6DCCB" strokeWidth="1.2" strokeDasharray="2 1.6" />
              <Circle cx={cx} cy={cy} r="2.2" fill="none" stroke="#E6DCCB" strokeWidth="1.2" />
            </G>
          ))}
          <CurryBowl x={46} y={30} r={10} {...curry} />
        </G>
      )}

      {family === 'rice' && (
        <G>
          {/* rice on a plate with a bowl of curry */}
          <Ellipse cx="25" cy="42" rx="17" ry="7" fill="#FFFDF9" stroke="#D9C4A3" strokeWidth="1.2" />
          <Path d="M13 41c1-8 6-12 12-12s11 4 12 12Z" fill="#FBF7EF" stroke="#E5DACA" strokeWidth="1" />
          <Path d="M20 34h2M26 32h2M24 37h2M30 36h2" stroke="#E5DACA" strokeWidth="1.2" strokeLinecap="round" />
          <CurryBowl x={46} y={30} r={11} {...curry} />
        </G>
      )}
    </Svg>
  );
};
