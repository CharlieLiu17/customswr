import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(req: Request) {
  try {
    const { playerName, dataUrl } = await req.json();

    // Extract base64 data from data URL
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to public/debug-crops
    const fileName = `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    const filePath = path.join(process.cwd(), 'public', 'debug-crops', fileName);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ ok: true, path: `/debug-crops/${fileName}` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
