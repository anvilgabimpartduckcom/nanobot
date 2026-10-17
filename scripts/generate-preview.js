// {Created preview generator converting exact nanobot UI SVG into public/preview.png} [Commented by: Google AI Studio on 13/10/2026 10:41 AM]

import sharp from 'sharp';
import fs from 'fs';

const width = 1600;
const height = 900;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep Neon Green Aura Blur Filters -->
    <filter id="deepAura" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="55" result="blurWide" />
      <feColorMatrix type="matrix" values="
        0 0 0 0 0.15
        0 0 0 0 0.95
        0 0 0 0 0.08
        0 0 0 0.55 0" />
    </filter>
    <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="22" result="blurCore" />
      <feColorMatrix type="matrix" values="
        0 0 0 0 0.22
        0 0 0 0 1.0
        0 0 0 0 0.10
        0 0 0 0.85 0" />
    </filter>
  </defs>

  <!-- Pitch Black Canvas -->
  <rect width="${width}" height="${height}" fill="#000000" />

  <!-- Top Left Controls -->
  <!-- History Button -->
  <g transform="translate(36, 32)">
    <rect width="44" height="44" rx="10" fill="#0d0d0d" stroke="#262626" stroke-width="1.2" />
    <!-- Clock icon -->
    <circle cx="22" cy="22" r="9" fill="none" stroke="#e0e0e0" stroke-width="1.8" />
    <polyline points="22,17 22,22 25,24" fill="none" stroke="#e0e0e0" stroke-width="1.8" stroke-linecap="round" />
  </g>

  <!-- New Chat Button -->
  <g transform="translate(90, 32)">
    <rect width="44" height="44" rx="10" fill="#0d0d0d" stroke="#262626" stroke-width="1.2" />
    <!-- Chat bubble icon -->
    <path d="M15,16 C15,14 17,13 22,13 C27,13 29,14 29,16 C29,20 27,21 22,21 C20,21 19,21.5 17,23 L17.5,21 C15.5,20.5 15,19 15,16 Z" fill="#e0e0e0" />
    <circle cx="19" cy="17" r="1" fill="#0d0d0d" />
    <circle cx="22" cy="17" r="1" fill="#0d0d0d" />
    <circle cx="25" cy="17" r="1" fill="#0d0d0d" />
  </g>

  <!-- Title: nanobot -->
  <text x="800" y="240" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="64" font-weight="bold" fill="#ffffff" letter-spacing="-0.5">
    nanobot
  </text>

  <!-- Composer Neon Aura Backing (Wide Diffuse Glow) -->
  <rect x="470" y="285" width="660" height="160" rx="28" fill="#39ff14" filter="url(#deepAura)" />
  
  <!-- Composer Neon Aura Core (Intense Edge Glow) -->
  <rect x="475" y="290" width="650" height="150" rx="26" fill="#39ff14" filter="url(#coreGlow)" />

  <!-- Composer Main Body -->
  <rect x="480" y="295" width="640" height="140" rx="24" fill="#111111" stroke="#2a2a2a" stroke-width="1" />

  <!-- Placeholder Text: Ask Anything... -->
  <text x="506" y="342" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" fill="#666666">
    Ask Anything...
  </text>

  <!-- Upload Button Plus Icon (+) -->
  <g transform="translate(506, 396)">
    <path d="M 0,7 L 14,7 M 7,0 L 7,14" stroke="#777777" stroke-width="3.5" stroke-linecap="round" />
  </g>

  <!-- Circular Send Button with '?' -->
  <g transform="translate(1072, 385)">
    <circle cx="18" cy="18" r="18" fill="#000080" />
    <text x="18" y="23" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">
      ?
    </text>
  </g>
</svg>
`;

async function generate() {
  const buffer = Buffer.from(svg);
  await sharp(buffer)
    .png()
    .toFile('./public/preview.png');
  console.log('Successfully generated public/preview.png');
}

generate().catch(console.error);
