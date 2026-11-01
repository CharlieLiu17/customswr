/**
 * Generates champion templates as center-cropped RGB pixel data.
 * Uses color (not grayscale) for better discrimination.
 *
 * Usage: npx tsx scripts/generate-champion-templates.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';

const ICONS_DIR = path.join(process.cwd(), 'public', 'champions');
const OUT_FILE = path.join(process.cwd(), 'data', 'champion-templates.json');

// Template size - inner square inscribed in circular portrait
const TEMPLATE_SIZE = 27;

// Crop percentage - inscribed square in circle = 1/√2 ≈ 0.707
const CROP_PERCENT = 1 / Math.sqrt(2);

async function main() {
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Processing ${files.length} icons at ${TEMPLATE_SIZE}x${TEMPLATE_SIZE}...`);

  const canvas = createCanvas(TEMPLATE_SIZE, TEMPLATE_SIZE);
  const ctx = canvas.getContext('2d');

  const templates: Record<string, { name: string; rgb: number[] }> = {};

  for (const file of files) {
    const champId = file.replace('.png', '');
    const img = await loadImage(path.join(ICONS_DIR, file));

    // Calculate center crop region
    const cropSize = Math.floor(img.width * CROP_PERCENT);
    const offset = Math.floor((img.width - cropSize) / 2);

    // Draw center-cropped region scaled to TEMPLATE_SIZE
    ctx.drawImage(
      img,
      offset, offset, cropSize, cropSize,
      0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE
    );

    const imgData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data;

    // Store RGB values (skip alpha)
    const rgb: number[] = [];
    for (let i = 0; i < imgData.length; i += 4) {
      rgb.push(imgData[i], imgData[i + 1], imgData[i + 2]);
    }

    templates[champId] = { name: champId, rgb };
    process.stdout.write('.');
  }

  console.log('\n');

  fs.writeFileSync(OUT_FILE, JSON.stringify(templates));
  console.log(`Wrote ${Object.keys(templates).length} RGB templates to ${OUT_FILE}`);
  console.log(`Each template: ${TEMPLATE_SIZE}x${TEMPLATE_SIZE} = ${TEMPLATE_SIZE * TEMPLATE_SIZE * 3} RGB values`);
}

main().catch(console.error);
