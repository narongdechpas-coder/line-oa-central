// Builds the Jacky Central deck from presentation/deck.html.
// - {{IMG:name}}  → presentation/img/name.webp as a data URI (artifacts cannot load other images)
// - {{AI:name}}   → presentation/img/ai-name.webp if present, else a "waiting for image" placeholder
// - {{APP_LINK}}  → "เปิดแอป" button in the app build only
// Outputs: public/presentation/index.html (served at /presentation/) and
//          presentation/dist/artifact.html (fragment published as a claude.ai artifact).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const img = (name) => join(here, 'img', `${name}.webp`);
const dataUri = (file) => `data:image/webp;base64,${readFileSync(file).toString('base64')}`;

const AI_LABEL = {
  cover: 'ภาพ AI #1 · ปก',
  problem: 'ภาพ AI #2 · ปัญหา',
  plan: 'ภาพ AI #3 · แผน 3 ระยะ',
};

function render(target) {
  let html = readFileSync(join(here, 'deck.html'), 'utf8');
  html = html.replace(/\{\{IMG:([a-z0-9-]+)\}\}/g, (_, name) => {
    if (!existsSync(img(name))) throw new Error(`missing image presentation/img/${name}.webp`);
    return dataUri(img(name));
  });
  html = html.replace(/\{\{AI:([a-z0-9-]+)\}\}/g, (_, name) => {
    const file = img(`ai-${name}`);
    if (existsSync(file)) return `<img src="${dataUri(file)}" alt=""><span class="ai-tag">ภาพสร้างด้วย AI</span>`;
    return `<div class="ai-ph" role="img" aria-label="${AI_LABEL[name] ?? name} (รอภาพ)"><b>${AI_LABEL[name] ?? name}</b><span>รอภาพจาก ChatGPT</span></div>`;
  });
  html = html.replace('{{APP_LINK}}', target === 'app' ? '<a class="deck-app" href="/dashboard">เปิดแอป ›</a>' : '');
  return html;
}

// App build: a full document.
const appHtml = render('app');
const cut = appHtml.indexOf('</style>') + '</style>'.length;
const full = `<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n<link rel="icon" type="image/png" href="/brand/favicon-64.png">\n${appHtml.slice(0, cut)}\n</head>\n<body>\n${appHtml.slice(cut)}\n</body>\n</html>\n`;
mkdirSync(join(here, '..', 'public', 'presentation'), { recursive: true });
writeFileSync(join(here, '..', 'public', 'presentation', 'index.html'), full);

// Artifact: the publish step adds its own document skeleton.
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'artifact.html'), render('artifact'));

const ai = Object.keys(AI_LABEL).map((n) => `${n}:${existsSync(img(`ai-${n}`)) ? 'image' : 'placeholder'}`).join(' ');
console.log(`deck built (${(full.length / 1024).toFixed(0)} KB) — AI slots ${ai}`);
