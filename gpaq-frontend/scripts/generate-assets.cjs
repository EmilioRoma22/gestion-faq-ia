const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate favicon.svg and pwa-icon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#darkBg)"/>
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="url(#brand)" stroke-width="6" stroke-opacity="0.6"/>
  
  <!-- Chat Bubble Base -->
  <path d="M120 160 C120 115 165 80 256 80 C347 80 392 115 392 160 C392 205 347 240 256 240 C234 240 213 234 195 224 L130 252 L148 200 C130 189 120 175 120 160 Z" fill="url(#brand)" filter="url(#glow)"/>
  
  <!-- Inner Chat icon cutouts -->
  <circle cx="196" cy="160" r="16" fill="#09090b"/>
  <circle cx="256" cy="160" r="16" fill="#09090b"/>
  <circle cx="316" cy="160" r="16" fill="#09090b"/>

  <!-- AI Sparkle Star -->
  <g transform="translate(310, 270)">
    <path d="M60 0 Q60 50 110 50 Q60 50 60 100 Q60 50 10 50 Q60 50 60 0 Z" fill="url(#brand)" filter="url(#glow)"/>
    <circle cx="60" cy="50" r="6" fill="#ffffff"/>
  </g>

  <!-- Typography GPAQ -->
  <text x="180" y="380" font-family="system-ui, -apple-system, sans-serif" font-size="76" font-weight="900" fill="#f4f4f5" letter-spacing="4">GPAQ</text>
  <text x="195" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="#818cf8" letter-spacing="3">FAQ · IA</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'favicon.svg'), svg, 'utf-8');
fs.writeFileSync(path.join(outDir, 'pwa-icon.svg'), svg, 'utf-8');
console.log('Saved favicon.svg and pwa-icon.svg');

// PNG generator functions
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = createChunk('IHDR', ihdrData);

  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowLength);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Draw nice icon with rounded rect and brand colors
function iconPixelRenderer(isMaskable) {
  return function(x, y, w, h) {
    const nx = x / w;
    const ny = y / h;
    const cx = 0.5;
    const cy = 0.5;

    // Corner radius for non-maskable
    if (!isMaskable) {
      const r = 0.22;
      let dx = Math.max(0, Math.max(r - nx, nx - (1 - r)));
      let dy = Math.max(0, Math.max(r - ny, ny - (1 - r)));
      if (dx * dx + dy * dy > r * r) {
        return [0, 0, 0, 0]; // Transparent outside rounded corner
      }
    }

    // Background gradient: zinc-950 (#09090b) to zinc-900 (#18181b)
    let bgR = Math.round(24 - ny * 15);
    let bgG = Math.round(24 - ny * 15);
    let bgB = Math.round(27 - ny * 16);

    // Inner icon graphics:
    // Speech bubble center around (0.5, 0.42)
    const bubbleCx = 0.5;
    const bubbleCy = 0.40;
    const bubbleRx = isMaskable ? 0.28 : 0.32;
    const bubbleRy = isMaskable ? 0.20 : 0.23;

    const bDist = Math.pow((nx - bubbleCx) / bubbleRx, 2) + Math.pow((ny - bubbleCy) / bubbleRy, 2);

    // Brand gradient: Indigo (#6366f1) to Purple (#a855f7)
    const gradFactor = Math.min(1, Math.max(0, (nx + ny) * 0.7));
    const brandR = Math.round(99 + gradFactor * (168 - 99));
    const brandG = Math.round(102 + gradFactor * (85 - 102));
    const brandB = Math.round(241 + gradFactor * (247 - 241));

    // Tail of speech bubble (triangle around nx ~ 0.32, ny ~ 0.56)
    const inTail = (nx >= 0.28 && nx <= 0.40 && ny >= 0.50 && ny <= 0.62 && (nx - 0.28) * 1.2 > (ny - 0.50));

    if (bDist <= 1.0 || inTail) {
      // 3 dots inside speech bubble
      const dotCy = 0.40;
      const dotRadius = isMaskable ? 0.035 : 0.04;
      const dot1 = Math.hypot(nx - (bubbleCx - 0.14), ny - dotCy);
      const dot2 = Math.hypot(nx - bubbleCx, ny - dotCy);
      const dot3 = Math.hypot(nx - (bubbleCx + 0.14), ny - dotCy);

      if (dot1 < dotRadius || dot2 < dotRadius || dot3 < dotRadius) {
        return [9, 9, 11, 255]; // Cutout to bg
      }
      return [brandR, brandG, brandB, 255];
    }

    // Sparkle star at (0.72, 0.65)
    const starCx = isMaskable ? 0.68 : 0.72;
    const starCy = isMaskable ? 0.62 : 0.66;
    const starR = isMaskable ? 0.10 : 0.12;
    const sDx = Math.abs(nx - starCx);
    const sDy = Math.abs(ny - starCy);

    // 4-pointed star curve: (sDx / r)^0.5 + (sDy / r)^0.5 <= 1
    if (sDx <= starR && sDy <= starR) {
      const starEq = Math.sqrt(sDx / starR) + Math.sqrt(sDy / starR);
      if (starEq <= 1.0) {
        if (sDx < 0.02 && sDy < 0.02) {
          return [255, 255, 255, 255]; // bright center
        }
        return [brandR, brandG, brandB, 255];
      }
    }

    // Small glow/border ring
    const borderDist = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5));
    if (!isMaskable && borderDist > 0.46 && borderDist < 0.485) {
      return [brandR, brandG, brandB, 180];
    }

    return [bgR, bgG, bgB, 255];
  };
}

// Generate PNGs
console.log('Generating 192x192 PNG...');
const png192 = makePng(192, 192, iconPixelRenderer(false));
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), png192);

console.log('Generating 512x512 PNG...');
const png512 = makePng(512, 512, iconPixelRenderer(false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), png512);

console.log('Generating 512x512 Maskable PNG...');
const png512Maskable = makePng(512, 512, iconPixelRenderer(true));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), png512Maskable);

console.log('Generating apple-touch-icon 180x180 PNG...');
const appleIcon = makePng(180, 180, iconPixelRenderer(false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleIcon);

// Favicon ICO (16x16 / 32x32 mini PNG packaged as ICO)
const icoPng = makePng(32, 32, iconPixelRenderer(false));
// Simple ICO wrapper for a single PNG
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // icon type
icoHeader.writeUInt16LE(1, 4); // 1 image

const icoDirEntry = Buffer.alloc(16);
icoDirEntry.writeUInt8(32, 0); // width
icoDirEntry.writeUInt8(32, 1); // height
icoDirEntry.writeUInt8(0, 2);  // color palette
icoDirEntry.writeUInt8(0, 3);  // reserved
icoDirEntry.writeUInt16LE(1, 4); // color planes
icoDirEntry.writeUInt16LE(32, 6); // bpp
icoDirEntry.writeUInt32LE(icoPng.length, 8); // size
icoDirEntry.writeUInt32LE(22, 12); // offset (6 + 16)

fs.writeFileSync(path.join(outDir, 'favicon.ico'), Buffer.concat([icoHeader, icoDirEntry, icoPng]));

console.log('All assets generated successfully!');
