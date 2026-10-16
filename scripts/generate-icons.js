import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4361EE" />
      <stop offset="50%" stop-color="#3A0CA3" />
      <stop offset="100%" stop-color="#7209B7" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4CC9F0" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#F72585" stop-opacity="0.8" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.35" />
    </filter>
  </defs>
  
  <!-- Rounded Background -->
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)" />
  
  <!-- Outer Glow Ring -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="url(#glowGrad)" stroke-width="6" opacity="0.4" />
  
  <!-- Central Bell & Voice Pulse -->
  <g filter="url(#shadow)" transform="translate(136, 120)">
    <!-- Bell Shape -->
    <path d="M120 20 C80 20 50 60 50 120 L40 180 L200 180 L190 120 C190 60 160 20 120 20 Z" fill="#FFFFFF" />
    <!-- Bell Top Knob -->
    <circle cx="120" cy="12" r="10" fill="#FFFFFF" />
    <!-- Bell Clapper -->
    <circle cx="120" cy="200" r="18" fill="#4CC9F0" />
    <!-- Audio Wave Waves -->
    <path d="M-15 100 C-35 80 -35 140 -15 120" stroke="#4CC9F0" stroke-width="12" stroke-linecap="round" fill="none" />
    <path d="M255 100 C275 80 275 140 255 120" stroke="#4CC9F0" stroke-width="12" stroke-linecap="round" fill="none" />
    <!-- Checkmark accent -->
    <path d="M95 110 L115 130 L155 85" fill="none" stroke="#3A0CA3" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

// Function to generate PNG
function createPngBuffer(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const rawRows = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.5 : 0.44);

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradient background
      const gradFactor = (x + y) / (width + height);
      let r = Math.round(67 * (1 - gradFactor) + 114 * gradFactor);
      let g = Math.round(97 * (1 - gradFactor) + 9 * gradFactor);
      let b = Math.round(238 * (1 - gradFactor) + 183 * gradFactor);
      let a = 255;

      if (!isMaskable) {
        // Rounded corner squircle
        const cornerR = width * 0.22;
        const qx = Math.max(0, Math.abs(dx) - (cx - cornerR));
        const qy = Math.max(0, Math.abs(dy) - (cy - cornerR));
        if (qx > 0 && qy > 0 && Math.sqrt(qx * qx + qy * qy) > cornerR) {
          a = 0;
        }
      }

      // Draw Bell Symbol in the center
      const ndx = dx / (width * 0.3);
      const ndy = dy / (height * 0.3);
      const bellDist = Math.sqrt(ndx * ndx + ndy * ndy);

      // Bell Body
      if (a > 0) {
        const inBellDome = ndy >= -0.7 && ndy <= 0.4 && Math.abs(ndx) <= (0.2 + 0.5 * ((ndy + 0.7) / 1.1));
        const inBellRim = ndy >= 0.4 && ndy <= 0.58 && Math.abs(ndx) <= 0.75;
        const inBellClapper = Math.sqrt(ndx * ndx + (ndy - 0.75) * (ndy - 0.75)) <= 0.22;
        const inTopRing = Math.sqrt(ndx * ndx + (ndy + 0.85) * (ndy + 0.85)) <= 0.14;

        if (inBellDome || inBellRim || inTopRing) {
          r = 255;
          g = 255;
          b = 255;
        } else if (inBellClapper) {
          r = 76;
          g = 201;
          b = 240; // Cyan clapper
        }
      }

      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rawRows.push(row);
  }

  const idatData = zlib.deflateSync(Buffer.concat(rawRows));
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Generate the required PNGs
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPngBuffer(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(64, 64, false));

console.log('Successfully generated all PWA icons in /public!');
