/**
 * Downloads champion square icons from Data Dragon.
 * Usage: npx tsx scripts/download-champion-icons.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const VERSION = '14.22.1';
const OUT_DIR = path.join(process.cwd(), 'public', 'champions');

async function main() {
  // Get champion list
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/en_US/champion.json`);
  const data = await res.json();
  const champions = Object.keys(data.data);

  console.log(`Downloading ${champions.length} champion icons...`);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (let i = 0; i < champions.length; i++) {
    const champ = champions[i];
    const url = `https://ddragon.leagueoflegends.com/cdn/${VERSION}/img/champion/${champ}.png`;

    process.stdout.write(`[${i + 1}/${champions.length}] ${champ}... `);

    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        console.log('FAILED');
        continue;
      }

      const buffer = await imgRes.arrayBuffer();
      const outPath = path.join(OUT_DIR, `${champ.toLowerCase()}.png`);
      fs.writeFileSync(outPath, Buffer.from(buffer));
      console.log('OK');
    } catch (err) {
      console.log('ERROR:', err);
    }

    // Small delay to be nice to the CDN
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDone. Icons saved to ${OUT_DIR}`);
}

main().catch(console.error);
