import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'node_modules', 'sql.js', 'dist');
const targetDir = path.join(root, 'public');
const target = path.join(targetDir, 'sql-wasm.wasm');

fs.mkdirSync(targetDir, { recursive: true });

// sql.js 1.13.0 ships sql-wasm.wasm. This fallback makes the
// setup resilient if npm resolves a compatible package with a
// slightly different WASM filename.
const candidates = [
  'sql-wasm.wasm',
  'sql-wasm-browser.wasm',
  'sql-wasm-debug.wasm'
];

const source = candidates
  .map(name => path.join(dist, name))
  .find(file => fs.existsSync(file));

if (!source) {
  console.error(`Could not find a sql.js WASM file in ${dist}`);
  console.error('Try deleting node_modules and package-lock.json, then run npm install again.');
  process.exit(1);
}

fs.copyFileSync(source, target);
console.log(`Copied ${path.basename(source)} to public/sql-wasm.wasm.`);
