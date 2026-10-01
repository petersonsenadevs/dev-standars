#!/usr/bin/env node
/**
 * Senzu · image-gen: generador de imágenes multi-proveedor, sin dependencias (Node 18+).
 *
 * Uso:
 *   node generate.mjs "<prompt>" [opciones]
 *   --provider openai|gemini|fal   (default: openai — usa la OPENAI_API_KEY que ya tienes por Codex)
 *   --model <id>                   (default por proveedor: gpt-image-1 / gemini-3-pro-image-preview / fal-ai/flux-pro/v1.1)
 *   --size 1024x1024|1536x1024|1024x1536  (default: 1024x1024; en gemini/fal se convierte a aspect)
 *   --quality low|medium|high      (solo openai; default medium)
 *   --background transparent       (solo openai: PNG con fondo transparente)
 *   --n 1..4                       (variantes; default 1)
 *   --out imagen.png               (default: gen-<timestamp>.png; con --n>1 añade -1, -2…)
 *
 * Claves por entorno: OPENAI_API_KEY | GEMINI_API_KEY | FAL_KEY
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Uso: node generate.mjs "<prompt>" [--provider openai|gemini|fal] [--model id] [--size WxH] [--quality low|medium|high] [--background transparent] [--n N] [--out file.png]');
  process.exit(args.length ? 0 : 2);
}
const prompt = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i !== -1 && args[i + 1] ? args[i + 1] : def; };
const provider = opt('provider', 'openai');
const size = opt('size', '1024x1024');
const n = Math.min(4, parseInt(opt('n', '1'), 10) || 1);
const outBase = opt('out', `gen-${Date.now()}.png`);
const transparent = args.includes('--background') && opt('background', '') === 'transparent';

const need = (env) => {
  const v = process.env[env];
  if (!v) { console.error(`[image-gen] Falta ${env} en el entorno. Exporta la clave y reintenta.`); process.exit(2); }
  return v;
};
const save = (i, buf) => {
  const file = n > 1 ? outBase.replace(/(\.\w+)?$/, (m) => `-${i + 1}${m || '.png'}`) : outBase;
  writeFileSync(file, buf);
  console.log(`guardada: ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
};
const aspect = { '1024x1024': '1:1', '1536x1024': '3:2', '1024x1536': '2:3' }[size] || '1:1';

async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) { console.error(`[image-gen] ${res.status} ${url}\n${text.slice(0, 500)}`); process.exit(1); }
  return JSON.parse(text);
}

if (provider === 'openai') {
  const key = need('OPENAI_API_KEY');
  const body = {
    model: opt('model', 'gpt-image-1'),
    prompt, n, size,
    quality: opt('quality', 'medium'),
  };
  if (transparent) { body.background = 'transparent'; body.output_format = 'png'; }
  const d = await jsonFetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  d.data.forEach((img, i) => save(i, Buffer.from(img.b64_json, 'base64')));
} else if (provider === 'gemini') {
  const key = need('GEMINI_API_KEY');
  const tryModels = [opt('model', 'gemini-3-pro-image-preview'), 'gemini-2.5-flash-image'];
  let done = false;
  for (const model of tryModels) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nAspect ratio: ${aspect}.` }] }],
      }),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`[image-gen] ${model}: ${res.status} — pruebo siguiente si hay`); continue; }
    const d = JSON.parse(text);
    const parts = d.candidates?.[0]?.content?.parts || [];
    const imgs = parts.filter((p) => p.inlineData?.data);
    if (!imgs.length) { console.error(`[image-gen] ${model} no devolvió imagen (¿prompt bloqueado?)`); continue; }
    imgs.slice(0, n).forEach((p, i) => save(i, Buffer.from(p.inlineData.data, 'base64')));
    done = true; break;
  }
  if (!done) process.exit(1);
} else if (provider === 'fal') {
  const key = need('FAL_KEY');
  const model = opt('model', 'fal-ai/flux-pro/v1.1');
  const d = await jsonFetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: { width: +size.split('x')[0], height: +size.split('x')[1] }, num_images: n }),
  });
  const images = d.images || [];
  if (!images.length) { console.error('[image-gen] fal no devolvió imágenes'); process.exit(1); }
  let i = 0;
  for (const img of images.slice(0, n)) {
    const res = await fetch(img.url);
    save(i++, Buffer.from(await res.arrayBuffer()));
  }
} else {
  console.error(`[image-gen] proveedor desconocido: ${provider}`);
  process.exit(2);
}
console.log('[image-gen] Recuerda: post-proceso (WebP/AVIF, dimensiones del hueco, alt) antes de usarla.');
