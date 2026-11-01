/**
 * Tests champion template matching on all debug crops.
 * Usage: npx tsx scripts/test-champion-matching.ts
 */

import { loadImage, createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_SIZE = 27;
const DEBUG_CROPS_DIR = path.join(process.cwd(), 'public', 'debug-crops');
const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'champion-templates.json');

function isGoldPixel(r: number, g: number, b: number): boolean {
  return r > 150 && r < 255 && g > 85 && g < 195 && b < 125 && r > g;
}

function isOuterBorder(pixelIdx: number): boolean {
  const x = pixelIdx % TEMPLATE_SIZE;
  const y = Math.floor(pixelIdx / TEMPLATE_SIZE);
  return x < 3 || x >= TEMPLATE_SIZE - 3 || y < 3 || y >= TEMPLATE_SIZE - 3;
}

function computeScore(imgData: Uint8ClampedArray, templateRgb: number[]): { mse: number; avgRgbDist: number; score: number } {
  let mseSum = 0;
  let count = 0;
  let imgR = 0, imgG = 0, imgB = 0;
  let tplR = 0, tplG = 0, tplB = 0;

  for (let i = 0; i < imgData.length; i += 4) {
    const pixelIdx = i / 4;
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    if (isOuterBorder(pixelIdx) && isGoldPixel(r, g, b)) {
      continue;
    }

    const ri = pixelIdx * 3;
    const tr = templateRgb[ri];
    const tg = templateRgb[ri + 1];
    const tb = templateRgb[ri + 2];

    mseSum += (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    imgR += r; imgG += g; imgB += b;
    tplR += tr; tplG += tg; tplB += tb;
    count++;
  }

  const mse = mseSum / (count * 3);
  const avgDr = (imgR - tplR) / count;
  const avgDg = (imgG - tplG) / count;
  const avgDb = (imgB - tplB) / count;
  const avgRgbDist = Math.sqrt(avgDr ** 2 + avgDg ** 2 + avgDb ** 2);
  const score = mse + avgRgbDist * avgRgbDist * 2;

  return { mse, avgRgbDist, score };
}

async function main() {
  const templates: Record<string, { name: string; rgb: number[] }> = JSON.parse(
    fs.readFileSync(TEMPLATES_FILE, 'utf-8')
  );

  const crops = fs.readdirSync(DEBUG_CROPS_DIR).filter(f => f.endsWith('.png'));

  if (crops.length === 0) {
    console.log('No debug crops found in', DEBUG_CROPS_DIR);
    return;
  }

  console.log(`Testing ${crops.length} crops against ${Object.keys(templates).length} champions\n`);
  console.log('Player'.padEnd(20) + 'Match'.padEnd(15) + 'Score'.padEnd(10) + '2nd Best'.padEnd(15) + 'Margin');
  console.log('-'.repeat(75));

  const canvas = createCanvas(TEMPLATE_SIZE, TEMPLATE_SIZE);
  const ctx = canvas.getContext('2d');

  for (const file of crops) {
    const playerName = file.replace('.png', '');
    const img = await loadImage(path.join(DEBUG_CROPS_DIR, file));
    ctx.drawImage(img, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    const imgData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data;

    const results: { id: string; name: string; score: number; mse: number; avgRgbDist: number }[] = [];

    for (const [id, { name, rgb }] of Object.entries(templates)) {
      const { mse, avgRgbDist, score } = computeScore(imgData, rgb);
      results.push({ id, name, score, mse, avgRgbDist });
    }

    results.sort((a, b) => a.score - b.score);

    const best = results[0];
    const second = results[1];
    const margin = ((second.score - best.score) / best.score * 100).toFixed(1);

    console.log(
      playerName.padEnd(20) +
      best.name.padEnd(15) +
      best.score.toFixed(0).padEnd(10) +
      second.name.padEnd(15) +
      margin + '%'
    );
  }

  console.log('\n' + '-'.repeat(75));
  console.log('Detailed breakdown:\n');

  for (const file of crops) {
    const playerName = file.replace('.png', '');
    const img = await loadImage(path.join(DEBUG_CROPS_DIR, file));
    ctx.drawImage(img, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    const imgData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data;

    const results: { id: string; name: string; score: number; mse: number; avgRgbDist: number }[] = [];

    for (const [id, { name, rgb }] of Object.entries(templates)) {
      const { mse, avgRgbDist, score } = computeScore(imgData, rgb);
      results.push({ id, name, score, mse, avgRgbDist });
    }

    results.sort((a, b) => a.score - b.score);

    console.log(`${playerName}:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name.padEnd(15)} score=${r.score.toFixed(0).padStart(5)}  (MSE=${r.mse.toFixed(0).padStart(5)}, avgRGB=${r.avgRgbDist.toFixed(1).padStart(5)})`);
    });
    console.log();
  }
}

main().catch(console.error);
