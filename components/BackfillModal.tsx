'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { ROLES, type Role } from '@/lib/types';
import championRolesData from '@/data/champion-roles.json';
import championTemplatesData from '@/data/champion-templates.json';

interface Props {
  playerNames: string[]; // Current players in the form [team0...team1]
  onExtract: (champs: string[]) => void;
  onClose: () => void;
}

const TEMPLATE_SIZE = 27;
const ICON_OFFSET_X = -45;
const ICON_OFFSET_Y = -8;

const championRoles = championRolesData as Record<string, { name: string; roles: string[] }>;
const championTemplates = championTemplatesData as Record<string, { name: string; rgb: number[] }>;

function isGoldPixel(r: number, g: number, b: number): boolean {
  return r > 150 && r < 255 && g > 85 && g < 195 && b < 125 && r > g;
}

function isOuterBorder(pixelIdx: number, size: number = TEMPLATE_SIZE): boolean {
  const x = pixelIdx % size;
  const y = Math.floor(pixelIdx / size);
  return x < 3 || x >= size - 3 || y < 3 || y >= size - 3;
}

function computeMatchScore(imgData: Uint8ClampedArray, templateRgb: number[]): number {
  let mseSum = 0, count = 0;
  let imgR = 0, imgG = 0, imgB = 0, tplR = 0, tplG = 0, tplB = 0;

  for (let i = 0; i < imgData.length; i += 4) {
    const pixelIdx = i / 4;
    const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
    if (isOuterBorder(pixelIdx) && isGoldPixel(r, g, b)) continue;
    const ri = pixelIdx * 3;
    const tr = templateRgb[ri], tg = templateRgb[ri + 1], tb = templateRgb[ri + 2];
    const dr = r - tr, dg = g - tg, db = b - tb;
    mseSum += dr * dr + dg * dg + db * db;
    imgR += r; imgG += g; imgB += b;
    tplR += tr; tplG += tg; tplB += tb;
    count++;
  }
  if (count === 0) return Infinity;
  const mse = mseSum / (count * 3);
  const avgDr = (imgR - tplR) / count, avgDg = (imgG - tplG) / count, avgDb = (imgB - tplB) / count;
  const avgRgbDist = Math.sqrt(avgDr * avgDr + avgDg * avgDg + avgDb * avgDb);
  return mse + avgRgbDist * avgRgbDist * 2;
}

export default function BackfillModal({ playerNames, onExtract, onClose }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  }, [handleFile]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const findChampionAtPosition = async (
    ctx: CanvasRenderingContext2D,
    nameX: number,
    nameY: number
  ): Promise<string | null> => {
    const templateEntries = Object.entries(championTemplates);
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = TEMPLATE_SIZE;
    smallCanvas.height = TEMPLATE_SIZE;
    const smallCtx = smallCanvas.getContext('2d')!;

    let bestMatch: { name: string; mse: number } | null = null;
    const iconX = nameX + ICON_OFFSET_X;
    const iconY = nameY + ICON_OFFSET_Y;
    if (iconX < 0 || iconY < 0) return null;

    try {
      smallCtx.drawImage(ctx.canvas, iconX, iconY, TEMPLATE_SIZE, TEMPLATE_SIZE, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
      const imgData = smallCtx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data;

      for (const [, { name, rgb }] of templateEntries) {
        const mse = computeMatchScore(imgData, rgb);
        if (!bestMatch || mse < bestMatch.mse) {
          bestMatch = { name, mse };
        }
      }
    } catch {
      return null;
    }

    return bestMatch?.name ?? null;
  };

  const runExtraction = async () => {
    if (!image) return;
    setProcessing(true);
    setError('');

    try {
      setStatus('Loading image...');
      const img = new Image();
      img.src = image;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      setStatus('Running OCR...');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(img, {}, { blocks: true });
      await worker.terminate();

      const words: Array<{ text: string; bbox: { x0: number; y0: number } }> = [];
      for (const block of data.blocks || []) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            for (const word of line.words || []) {
              words.push(word);
            }
          }
        }
      }

      // Match words to the known player names in the form
      const fuzzyMatch = (ocrText: string, targetName: string): boolean => {
        const clean = ocrText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const target = targetName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (clean.includes(target) || target.includes(clean)) return clean.length >= target.length * 0.4;
        if (Math.abs(clean.length - target.length) > 3) return false;
        const minLen = Math.min(clean.length, target.length);
        let matches = 0;
        for (let i = 0; i < minLen; i++) if (clean[i] === target[i]) matches++;
        const maxErrors = clean.length >= 10 ? 3 : clean.length >= 6 ? 2 : 1;
        return minLen - matches <= maxErrors && matches >= 4;
      };

      interface DetectedPlayer { name: string; bbox: { x0: number; y0: number }; champion: string | null }
      const detectedPlayers: DetectedPlayer[] = [];
      const usedNames = new Set<string>();

      for (const word of words) {
        const text = word.text.replace(/[^a-zA-Z0-9]/g, '');
        if (text.length < 3) continue;
        for (const name of playerNames) {
          if (!name || usedNames.has(name)) continue;
          if (fuzzyMatch(text, name)) {
            usedNames.add(name);
            detectedPlayers.push({ name, bbox: word.bbox, champion: null });
            break;
          }
        }
      }

      // Sort by Y to get order
      detectedPlayers.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // Calculate median X for alignment correction
      const xValues = detectedPlayers.map(p => p.bbox.x0);
      const medianX = xValues.slice().sort((a, b) => a - b)[Math.floor(xValues.length / 2)] || 0;

      setStatus('Detecting champions...');
      for (const player of detectedPlayers) {
        const x0 = Math.abs(player.bbox.x0 - medianX) > 2 ? medianX : player.bbox.x0;
        const champ = await findChampionAtPosition(ctx, x0, player.bbox.y0);
        if (champ) player.champion = champ;
      }

      // Map back to original order (match by player name)
      const result: string[] = playerNames.map(name => {
        const found = detectedPlayers.find(p => p.name === name);
        return found?.champion || '';
      });

      setStatus(`Found ${detectedPlayers.filter(p => p.champion).length} champions`);
      onExtract(result);
    } catch (err) {
      setError('Extraction failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="row" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Backfill Champions</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <p className="muted small" style={{ marginBottom: 12 }}>
          Upload or paste a post-game screenshot to extract champion data for this game.
        </p>

        <div
          className="card"
          style={{ border: '2px dashed var(--line)', textAlign: 'center', padding: 30, cursor: 'pointer', marginBottom: 12 }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {image ? (
            <img src={image} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
          ) : (
            <div>
              <p style={{ marginBottom: 4 }}>Drop or paste a screenshot</p>
              <p className="muted small">Or click to select</p>
            </div>
          )}
        </div>

        {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="row">
          <button onClick={runExtraction} disabled={!image || processing} className="primary">
            {processing ? status : 'Extract Champions'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
