import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type 2 = Truecolor (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk (raw RGB data with filter byte 0 for each scanline)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      // Draw a rounded heart / pill motif in center
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const innerRadius = width * 0.38;

      let pr = r, pg = g, pb = b;

      // Draw pill / emblem in center with white/light teal
      if (dist < innerRadius) {
        if (x < cx) {
          pr = 20; pg = 184; pb = 166; // teal-500
        } else {
          pr = 255; pg = 255; pb = 255; // white
        }
      }

      rawData[offset + 1 + x * 3] = pr;
      rawData[offset + 1 + x * 3 + 1] = pg;
      rawData[offset + 1 + x * 3 + 2] = pb;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crc = crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate CareSync Teal Icons (#0f766e = R:15, G:118, B:110)
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, 15, 118, 110));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, 15, 118, 110));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, 15, 118, 110));
fs.writeFileSync(path.join(publicDir, 'maskable-icon-512x512.png'), createPNG(512, 512, 15, 118, 110));

console.log('✅ Generated CareSync PWA icons in public/ directory!');
