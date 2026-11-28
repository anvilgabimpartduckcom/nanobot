// Theme and dynamic accent colour system replacing hardcoded green accents app-wide with lightest-to-darkest shade palettes [Commented by: Google AI Studio on 28/11/2026 06:46]

export type AppTheme = 'Neon Black' | 'Minimalist Light';

export type AccentFamilyId =
  | 'neutral'
  | 'violet'
  | 'indigo'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red';

export interface AccentShade {
  label: string;
  hex: string;
  bgClass: string;
}

export interface AccentColorFamily {
  id: AccentFamilyId;
  label: string;
  previewHex: string;
  previewBgClass: string;
  shades: AccentShade[]; // Ordered strictly lightest to darkest
}

export interface AccentPreference {
  family: AccentFamilyId;
  color: string;
}

export const DEFAULT_ACCENT_PREFERENCE: AccentPreference = {
  family: 'green',
  color: '#10b981',
};

// Ordered side-by-side color families starting with White/Black followed by Violet, Indigo, Blue, Green, Yellow, Orange, Red [Commented by: Google AI Studio on 28/11/2026 06:49]
export const ACCENT_COLOR_FAMILIES: AccentColorFamily[] = [
  {
    id: 'neutral',
    label: 'White / Black',
    previewHex: '#ffffff',
    previewBgClass: 'bg-[#ffffff]',
    shades: [
      { label: 'Pure White', hex: '#ffffff', bgClass: 'bg-[#ffffff]' },
      { label: 'Snow', hex: '#f5f5f5', bgClass: 'bg-[#f5f5f5]' },
      { label: 'Silver Light', hex: '#e5e5e5', bgClass: 'bg-[#e5e5e5]' },
      { label: 'Ash', hex: '#d4d4d4', bgClass: 'bg-[#d4d4d4]' },
      { label: 'Slate', hex: '#a3a3a3', bgClass: 'bg-[#a3a3a3]' },
      { label: 'Graphite', hex: '#737373', bgClass: 'bg-[#737373]' },
      { label: 'Charcoal', hex: '#525252', bgClass: 'bg-[#525252]' },
      { label: 'Iron', hex: '#404040', bgClass: 'bg-[#404040]' },
      { label: 'Onyx', hex: '#262626', bgClass: 'bg-[#262626]' },
      { label: 'Pure Black', hex: '#171717', bgClass: 'bg-[#171717]' },
    ],
  },
  {
    id: 'violet',
    label: 'Violet',
    previewHex: '#8b5cf6',
    previewBgClass: 'bg-[#8b5cf6]',
    shades: [
      { label: 'Violet 50', hex: '#f5f3ff', bgClass: 'bg-[#f5f3ff]' },
      { label: 'Violet 100', hex: '#ede9fe', bgClass: 'bg-[#ede9fe]' },
      { label: 'Violet 200', hex: '#ddd6fe', bgClass: 'bg-[#ddd6fe]' },
      { label: 'Violet 300', hex: '#c4b5fd', bgClass: 'bg-[#c4b5fd]' },
      { label: 'Violet 400', hex: '#a78bfa', bgClass: 'bg-[#a78bfa]' },
      { label: 'Violet 500', hex: '#8b5cf6', bgClass: 'bg-[#8b5cf6]' },
      { label: 'Violet 600', hex: '#7c3aed', bgClass: 'bg-[#7c3aed]' },
      { label: 'Violet 700', hex: '#6d28d9', bgClass: 'bg-[#6d28d9]' },
      { label: 'Violet 800', hex: '#5b21b6', bgClass: 'bg-[#5b21b6]' },
      { label: 'Violet 900', hex: '#4c1d95', bgClass: 'bg-[#4c1d95]' },
    ],
  },
  {
    id: 'indigo',
    label: 'Indigo',
    previewHex: '#6366f1',
    previewBgClass: 'bg-[#6366f1]',
    shades: [
      { label: 'Indigo 50', hex: '#eef2ff', bgClass: 'bg-[#eef2ff]' },
      { label: 'Indigo 100', hex: '#e0e7ff', bgClass: 'bg-[#e0e7ff]' },
      { label: 'Indigo 200', hex: '#c7d2fe', bgClass: 'bg-[#c7d2fe]' },
      { label: 'Indigo 300', hex: '#a5b4fc', bgClass: 'bg-[#a5b4fc]' },
      { label: 'Indigo 400', hex: '#818cf8', bgClass: 'bg-[#818cf8]' },
      { label: 'Indigo 500', hex: '#6366f1', bgClass: 'bg-[#6366f1]' },
      { label: 'Indigo 600', hex: '#4f46e5', bgClass: 'bg-[#4f46e5]' },
      { label: 'Indigo 700', hex: '#4338ca', bgClass: 'bg-[#4338ca]' },
      { label: 'Indigo 800', hex: '#3730a3', bgClass: 'bg-[#3730a3]' },
      { label: 'Indigo 900', hex: '#312e81', bgClass: 'bg-[#312e81]' },
    ],
  },
  {
    id: 'blue',
    label: 'Blue',
    previewHex: '#3b82f6',
    previewBgClass: 'bg-[#3b82f6]',
    shades: [
      { label: 'Blue 50', hex: '#eff6ff', bgClass: 'bg-[#eff6ff]' },
      { label: 'Blue 100', hex: '#dbeafe', bgClass: 'bg-[#dbeafe]' },
      { label: 'Blue 200', hex: '#bfdbfe', bgClass: 'bg-[#bfdbfe]' },
      { label: 'Blue 300', hex: '#93c5fd', bgClass: 'bg-[#93c5fd]' },
      { label: 'Blue 400', hex: '#60a5fa', bgClass: 'bg-[#60a5fa]' },
      { label: 'Blue 500', hex: '#3b82f6', bgClass: 'bg-[#3b82f6]' },
      { label: 'Blue 600', hex: '#2563eb', bgClass: 'bg-[#2563eb]' },
      { label: 'Blue 700', hex: '#1d4ed8', bgClass: 'bg-[#1d4ed8]' },
      { label: 'Blue 800', hex: '#1e40af', bgClass: 'bg-[#1e40af]' },
      { label: 'Blue 900', hex: '#1e3a8a', bgClass: 'bg-[#1e3a8a]' },
    ],
  },
  {
    id: 'green',
    label: 'Green',
    previewHex: '#10b981',
    previewBgClass: 'bg-[#10b981]',
    shades: [
      { label: 'Green 50', hex: '#ecfdf5', bgClass: 'bg-[#ecfdf5]' },
      { label: 'Green 100', hex: '#d1fae5', bgClass: 'bg-[#d1fae5]' },
      { label: 'Green 200', hex: '#a7f3d0', bgClass: 'bg-[#a7f3d0]' },
      { label: 'Green 300', hex: '#6ee7b7', bgClass: 'bg-[#6ee7b7]' },
      { label: 'Green 400', hex: '#34d399', bgClass: 'bg-[#34d399]' },
      { label: 'Green 500', hex: '#10b981', bgClass: 'bg-[#10b981]' },
      { label: 'Green 600', hex: '#059669', bgClass: 'bg-[#059669]' },
      { label: 'Green 700', hex: '#047857', bgClass: 'bg-[#047857]' },
      { label: 'Green 800', hex: '#065f46', bgClass: 'bg-[#065f46]' },
      { label: 'Green 900', hex: '#064e3b', bgClass: 'bg-[#064e3b]' },
    ],
  },
  {
    id: 'yellow',
    label: 'Yellow',
    previewHex: '#eab308',
    previewBgClass: 'bg-[#eab308]',
    shades: [
      { label: 'Yellow 50', hex: '#fefce8', bgClass: 'bg-[#fefce8]' },
      { label: 'Yellow 100', hex: '#fef9c3', bgClass: 'bg-[#fef9c3]' },
      { label: 'Yellow 200', hex: '#fef08a', bgClass: 'bg-[#fef08a]' },
      { label: 'Yellow 300', hex: '#fde047', bgClass: 'bg-[#fde047]' },
      { label: 'Yellow 400', hex: '#facc15', bgClass: 'bg-[#facc15]' },
      { label: 'Yellow 500', hex: '#eab308', bgClass: 'bg-[#eab308]' },
      { label: 'Yellow 600', hex: '#ca8a04', bgClass: 'bg-[#ca8a04]' },
      { label: 'Yellow 700', hex: '#a16207', bgClass: 'bg-[#a16207]' },
      { label: 'Yellow 800', hex: '#854d0e', bgClass: 'bg-[#854d0e]' },
      { label: 'Yellow 900', hex: '#713f12', bgClass: 'bg-[#713f12]' },
    ],
  },
  {
    id: 'orange',
    label: 'Orange',
    previewHex: '#f97316',
    previewBgClass: 'bg-[#f97316]',
    shades: [
      { label: 'Orange 50', hex: '#fff7ed', bgClass: 'bg-[#fff7ed]' },
      { label: 'Orange 100', hex: '#ffedd5', bgClass: 'bg-[#ffedd5]' },
      { label: 'Orange 200', hex: '#fed7aa', bgClass: 'bg-[#fed7aa]' },
      { label: 'Orange 300', hex: '#fdba74', bgClass: 'bg-[#fdba74]' },
      { label: 'Orange 400', hex: '#fb923c', bgClass: 'bg-[#fb923c]' },
      { label: 'Orange 500', hex: '#f97316', bgClass: 'bg-[#f97316]' },
      { label: 'Orange 600', hex: '#ea580c', bgClass: 'bg-[#ea580c]' },
      { label: 'Orange 700', hex: '#c2410c', bgClass: 'bg-[#c2410c]' },
      { label: 'Orange 800', hex: '#9a3412', bgClass: 'bg-[#9a3412]' },
      { label: 'Orange 900', hex: '#7c2d12', bgClass: 'bg-[#7c2d12]' },
    ],
  },
  {
    id: 'red',
    label: 'Red',
    previewHex: '#ef4444',
    previewBgClass: 'bg-[#ef4444]',
    shades: [
      { label: 'Red 50', hex: '#fef2f2', bgClass: 'bg-[#fef2f2]' },
      { label: 'Red 100', hex: '#fee2e2', bgClass: 'bg-[#fee2e2]' },
      { label: 'Red 200', hex: '#fecaca', bgClass: 'bg-[#fecaca]' },
      { label: 'Red 300', hex: '#fca5a5', bgClass: 'bg-[#fca5a5]' },
      { label: 'Red 400', hex: '#f87171', bgClass: 'bg-[#f87171]' },
      { label: 'Red 500', hex: '#ef4444', bgClass: 'bg-[#ef4444]' },
      { label: 'Red 600', hex: '#dc2626', bgClass: 'bg-[#dc2626]' },
      { label: 'Red 700', hex: '#b91c1c', bgClass: 'bg-[#b91c1c]' },
      { label: 'Red 800', hex: '#991b1b', bgClass: 'bg-[#991b1b]' },
      { label: 'Red 900', hex: '#7f1d1d', bgClass: 'bg-[#7f1d1d]' },
    ],
  },
];

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function isValidAccentFamily(value: string): value is AccentFamilyId {
  return ACCENT_COLOR_FAMILIES.some((f) => f.id === value);
}

export function getFamilyDisplayLabel(familyId: AccentFamilyId, theme: AppTheme): string {
  if (familyId === 'neutral') {
    return theme === 'Neon Black' ? 'White' : 'Black';
  }
  return ACCENT_COLOR_FAMILIES.find((f) => f.id === familyId)?.label || 'Green';
}

export function getNeutralDefaultHex(theme: AppTheme): string {
  return theme === 'Neon Black' ? '#ffffff' : '#171717';
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = isValidHexColor(hex) ? hex.replace('#', '') : '10b981';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function mixHex(hexA: string, hexB: string, ratioB: number): string {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  const r = Math.round(a.r * (1 - ratioB) + b.r * ratioB);
  const g = Math.round(a.g * (1 - ratioB) + b.g * ratioB);
  const bl = Math.round(a.b * (1 - ratioB) + b.b * ratioB);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexRgb(hex);
  const normalize = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

// Compute full CSS custom properties ensuring readable contrast across both Neon Black and Minimalist Light [Commented by: Google AI Studio on 28/11/2026 06:46]
export function applyAccentCssVariables(accent: AccentPreference, theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const baseHex = isValidHexColor(accent.color) ? accent.color : DEFAULT_ACCENT_PREFERENCE.color;
  const { r, g, b } = parseHexRgb(baseHex);
  const lum = getRelativeLuminance(baseHex);

  const contrast = lum > 0.36 ? '#0a0a0a' : '#ffffff';
  const hover = lum > 0.5 ? mixHex(baseHex, '#000000', 0.14) : mixHex(baseHex, '#ffffff', 0.16);
  const borderStrong = lum > 0.5 ? mixHex(baseHex, '#000000', 0.35) : mixHex(baseHex, '#000000', 0.28);

  // Ensure text links & highlights remain legible against both dark canvas (#000) and light canvas (#f8f9fa)
  let textColor = baseHex;
  if (theme === 'Neon Black' && lum < 0.16) {
    textColor = mixHex(baseHex, '#ffffff', 0.45);
  } else if (theme === 'Minimalist Light' && lum > 0.42) {
    textColor = mixHex(baseHex, '#000000', 0.42);
  }

  // Aura glow defaults to crisp neon brightness for default green in Neon Black mode
  const isDefaultGreen = accent.family === 'green' && baseHex.toLowerCase() === '#10b981';
  const auraColor = isDefaultGreen
    ? theme === 'Minimalist Light'
      ? '#059669'
      : '#39ff14'
    : baseHex;

  root.style.setProperty('--accent-color', baseHex);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-contrast', contrast);
  root.style.setProperty('--accent-text', textColor);
  root.style.setProperty('--accent-border', `rgba(${r}, ${g}, ${b}, ${theme === 'Minimalist Light' ? 0.5 : 0.45})`);
  root.style.setProperty('--accent-border-strong', borderStrong);
  root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, ${theme === 'Minimalist Light' ? 0.12 : 0.16})`);
  root.style.setProperty('--accent-soft-strong', `rgba(${r}, ${g}, ${b}, ${theme === 'Minimalist Light' ? 0.2 : 0.28})`);
  root.style.setProperty('--aura-color', auraColor);
}
