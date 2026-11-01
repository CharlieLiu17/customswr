/**
 * Scrapes lolalytics.com for champion role percentages.
 * Outputs roles with >10% playrate to data/champion-roles.json
 *
 * Usage: npx tsx scripts/scrape-champion-roles.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const LOLALYTICS_ROLES = ['top', 'jungle', 'middle', 'bottom', 'support'] as const;

const ROLE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  middle: 'mid',
  bottom: 'bot',
  support: 'support'
};

async function getChampionList(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('https://ddragon.leagueoflegends.com/cdn/14.22.1/data/en_US/champion.json');
  const data = await res.json();
  return Object.entries(data.data).map(([id, info]: [string, any]) => ({
    id: id.toLowerCase(),
    name: info.name
  }));
}

async function getChampionRoles(championId: string): Promise<string[]> {
  const url = `https://lolalytics.com/lol/${championId}/build/`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.error(`  Failed: ${res.status}`);
      return [];
    }

    const html = await res.text();
    const roleData: { role: string; pct: number }[] = [];

    for (const role of LOLALYTICS_ROLES) {
      const regex = new RegExp(`alt="${role} lane"[^%]*?([\\d.]+)%`, 'i');
      const match = html.match(regex);

      if (match) {
        const percentage = parseFloat(match[1]);
        if (percentage >= 10) {
          roleData.push({ role: ROLE_MAP[role], pct: percentage });
        }
      }
    }

    // Sort by percentage descending (most popular first)
    roleData.sort((a, b) => b.pct - a.pct);
    return roleData.map(r => r.role);
  } catch (err) {
    console.error(`  Error:`, err);
    return [];
  }
}

async function main() {
  console.log('Fetching champion list from Data Dragon...');
  const champions = await getChampionList();
  console.log(`Found ${champions.length} champions\n`);

  const mapping: Record<string, { name: string; roles: string[] }> = {};

  for (let i = 0; i < champions.length; i++) {
    const { id, name } = champions[i];
    process.stdout.write(`[${i + 1}/${champions.length}] ${name}... `);

    const roles = await getChampionRoles(id);
    if (roles.length > 0) {
      mapping[id] = { name, roles };
      console.log(roles.join(', '));
    } else {
      mapping[id] = { name, roles: ['top', 'jungle', 'mid', 'bot', 'support'] };
      console.log('(defaulting to all roles)');
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const outPath = path.join(process.cwd(), 'data', 'champion-roles.json');
  fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2));
  console.log(`\nWrote ${Object.keys(mapping).length} champions to ${outPath}`);
}

main().catch(console.error);
