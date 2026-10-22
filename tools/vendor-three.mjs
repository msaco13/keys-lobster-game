// Bundles the parts of three.js listed in tools/three-entry.js into js/vendor/three.min.js (window.THREE), with its license.
// The output is committed, so playing the game never needs this step. Re-run it after changing the entry list:
//   npm install && npm run vendor
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { build } from 'esbuild';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/three/package.json'), 'utf8'));
const license = fs.readFileSync(path.join(root, 'node_modules/three/LICENSE'), 'utf8').trim();
const out = path.join(root, 'js/vendor/three.min.js');
await build({
  entryPoints: [path.join(root, 'tools/three-entry.js')], bundle: true, minify: true, format: 'iife', globalName: 'THREE',
  target: ['es2019'], legalComments: 'none', outfile: out,
  banner: { js: `/* three.js ${pkg.version} (a subset, see tools/three-entry.js) · https://threejs.org\n${license}\n*/` }
});
const js = fs.readFileSync(out, 'utf8');
if (/<\/script/i.test(js)) throw new Error('bundle contains a closing script tag and cannot be inlined');
console.log('vendored three.js', pkg.version, (js.length / 1024).toFixed(0) + ' KB');
