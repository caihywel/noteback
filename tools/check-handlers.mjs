// Static handler name-diff check for the monolith split.
//
// Guarantees every function an inline handler invokes at click/input/drag time
// is present in the global surface. Two modes:
//   pre-split  (default):        globals = all functions defined in <script>
//   post-split (--globals-from): globals = names assigned to window in a JS file
// Exits 1 (red) if any handler target is missing from globals.
//
// Cai never runs this — it is Claude's pre-merge gate. Zero dependencies.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const htmlPath = args.find(a => !a.startsWith('--')) || 'index.html';
const globalsFrom = (args.find(a => a.startsWith('--globals-from=')) || '').split('=')[1];
const listOnly = args.includes('--list');
const html = readFileSync(htmlPath, 'utf8');

// --- handler targets ---
const handlerRe = /\son(?:click|input|change|dragover|dragleave|drop)\s*=\s*"([^"]*)"/g;
const KEYWORDS = new Set(['if','for','while','switch','catch','return','function',
  'typeof','new','void','delete','in','of','do','else','var','let','const','await']);
const handlers = new Set();
let m;
while ((m = handlerRe.exec(html))) {
  const code = m[1].replace(/\$\{[^}]*\}/g, '');          // drop render-time ${...}
  let c; const callRe = /(?<![.\w])([A-Za-z_]\w*)\s*\(/g; // ident "(" not after "."
  while ((c = callRe.exec(code))) if (!KEYWORDS.has(c[1])) handlers.add(c[1]);
}
if (listOnly) { console.log([...handlers].sort().join('\n')); process.exit(0); }

// --- global surface ---
const globals = new Set();
let mode;
if (globalsFrom) {
  mode = `post-split (window bridge in ${globalsFrom})`;
  const js = readFileSync(globalsFrom, 'utf8');
  for (const g of js.matchAll(/window\.([A-Za-z_]\w*)\s*=/g)) globals.add(g[1]);
  for (const blk of js.matchAll(/Object\.assign\s*\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g))
    for (const nm of blk[1].matchAll(/([A-Za-z_]\w*)\s*(?:[:,]|$)/g)) globals.add(nm[1]);
} else {
  mode = 'pre-split (all defined functions)';
  const body = (html.match(/<script>([\s\S]*?)<\/script>/) || [,''])[1];
  for (const g of body.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_]\w*)/g)) globals.add(g[1]);
  for (const g of body.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:function|\()/g)) globals.add(g[1]);
}

const missing = [...handlers].filter(h => !globals.has(h)).sort();
console.log(`mode: ${mode}`);
console.log(`handler targets: ${handlers.size} | globals: ${globals.size}`);
if (missing.length === 0) { console.log('✅ none missing — every handler target is reachable'); process.exit(0); }
console.log('❌ DEAD BUTTONS — handler targets missing from globals: ' + missing.join(', '));
process.exit(1);
