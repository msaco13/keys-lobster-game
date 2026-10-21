// Bundles index.html + js/*.js into single files:
//   dist/keys-crew.html            standalone page (open it straight from disk, no server needed)
//   dist/keys-crew-artifact.html   same page without the <html>/<head>/<body> wrapper, for claude.ai artifacts
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n?/g)];
const bundle = scripts.map((m) => `/* ---- ${m[1]} ---- */\n` + fs.readFileSync(path.join(root, m[1]), 'utf8')).join('\n');
html = html.replace(scripts.map((m) => m[0]).join(''), `<script>\n${bundle}\n</script>\n`);
if (html.includes('src="js/')) throw new Error('script tags were not all inlined');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/keys-crew.html'), html);
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head.split('\n').filter((l) => !/<meta charset|<meta name="viewport"/.test(l)).join('\n');
fs.writeFileSync(path.join(root, 'dist/keys-crew-artifact.html'), keep.trim() + '\n' + body.trim() + '\n');
console.log('built', (fs.statSync(path.join(root, 'dist/keys-crew.html')).size / 1024).toFixed(0) + ' KB');
