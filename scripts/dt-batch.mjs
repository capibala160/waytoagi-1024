#!/usr/bin/env node
/**
 * Save every image Draw Things returns for a batch.
 *
 * The project MCP server saves only result.images[0]. Draw Things is set to
 * generate two images per request, so this runner posts to the same local API
 * and writes all returned images plus generation metadata.
 *
 * Usage:
 *   node scripts/dt-batch.mjs <manifest.json> [asset-name ...]
 *
 * The manifest keeps the Draw Things app settings untouched: only prompt,
 * negative_prompt, width, and height are sent. Steps, guidance, sampler, and
 * model stay exactly as configured in the app.
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.DRAWTHINGS_URL || 'http://localhost:7860';
const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node scripts/dt-batch.mjs <manifest.json> [asset-name ...]');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const only = new Set(process.argv.slice(3));
const outDir = manifest.outputDir || path.dirname(manifestPath);
fs.mkdirSync(outDir, { recursive: true });

// Record whichever model/settings the app is actually using, so a later
// reader never has to guess which checkpoint produced a raw render.
let appSettings = {};
try {
  const res = await fetch(`${BASE_URL}/sdapi/v1/options`, { signal: AbortSignal.timeout(5000) });
  if (res.ok) {
    const j = await res.json();
    appSettings = {
      model: j.model,
      steps: j.steps,
      guidance_scale: j.guidance_scale,
      sampler: j.sampler,
    };
  }
} catch (err) {
  console.warn('  (could not read app settings)');
}

const assets = manifest.assets.filter((a) => !only.size || only.has(a.name));
if (!assets.length) {
  console.error('No matching assets in manifest.');
  process.exit(1);
}

for (const asset of assets) {
  const body = {
    prompt: asset.prompt,
    width: asset.width || 1024,
    height: asset.height || 1024,
  };
  if (asset.negative_prompt) body.negative_prompt = asset.negative_prompt;
  if (asset.batch_count) body.batch_count = asset.batch_count;

  console.log(`\n→ ${asset.name}  ${body.width}×${body.height}`);
  const started = Date.now();

  const response = await fetch(`${BASE_URL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${asset.name}: ${response.status} ${text}`);
  }

  const result = await response.json();
  const images = result.images || [];
  if (!images.length) throw new Error(`${asset.name}: no images returned`);

  images.forEach((base64, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const file = path.join(outDir, `${asset.name}-${suffix}.png`);
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    console.log(`  saved ${path.relative(process.cwd(), file)}`);
  });

  const meta = {
    name: asset.name,
    model: appSettings.model || 'current Draw Things model',
    settings: appSettings,
    requested: body,
    count: images.length,
    seconds: Math.round((Date.now() - started) / 1000),
    info: result.info || null,
  };
  fs.writeFileSync(path.join(outDir, `${asset.name}.json`), JSON.stringify(meta, null, 2));
  console.log(`  ${images.length} image(s) in ${meta.seconds}s`);
}
