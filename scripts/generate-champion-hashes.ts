/**
 * Pre-computes perceptual hashes for champion icons using CENTER CROP.
 * Uses 16x16 (256 bits) for better discrimination than 8x8.
 *
 * Usage: npx tsx scripts/generate-champion-hashes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';

const ICONS_DIR = path.join(process.cwd(), 'public', 'champions');
const OUT_FILE = path.join(process.cwd(), 'data', 'champion-hashes.json');

// Hash size - 16x16 = 256 bits for better discrimination
const HASH_SIZE = 16;

// Crop percentage - inscribed square in circle = 1/√2 ≈ 0.707
const CROP_PERCENT = 1 / Math.sqrt(2);

function computeHash(imgData: Uint8ClampedArray): string {
  const grays: number[] = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    grays.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const avg = grays.reduce((a, b) => a + b, 0) / grays.length;

  let hash = '';
  for (const g of grays) {
    hash += g > avg ? '1' : '0';
  }

  // Convert binary to hex (4 bits at a time)
  let hex = '';
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
  }

  return hex;
}

async function main() {
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Processing ${files.length} icons at ${HASH_SIZE}x${HASH_SIZE} with ${(CROP_PERCENT * 100).toFixed(1)}% center crop...`);

  const hashCanvas = createCanvas(HASH_SIZE, HASH_SIZE);
  const hashCtx = hashCanvas.getContext('2d');

  const hashes: Record<string, { name: string; hash: string }> = {};

  for (const file of files) {
    const champId = file.replace('.png', '');
    const img = await loadImage(path.join(ICONS_DIR, file));

    // Calculate center crop region
    const cropSize = Math.floor(img.width * CROP_PERCENT);
    const offset = Math.floor((img.width - cropSize) / 2);

    // Draw center-cropped region scaled to HASH_SIZE x HASH_SIZE
    hashCtx.drawImage(
      img,
      offset, offset, cropSize, cropSize,
      0, 0, HASH_SIZE, HASH_SIZE
    );

    const imgData = hashCtx.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data;
    const hash = computeHash(imgData);
    hashes[champId] = { name: champId, hash };

    process.stdout.write('.');
  }

  console.log('\n');

  fs.writeFileSync(OUT_FILE, JSON.stringify(hashes, null, 2));
  console.log(`Wrote ${Object.keys(hashes).length} hashes (${HASH_SIZE}x${HASH_SIZE} = ${HASH_SIZE * HASH_SIZE} bits) to ${OUT_FILE}`);
}

main().catch(console.error);
