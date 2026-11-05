// Fix SWC native binding on systems detected as musl but running glibc
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@swc', 'core', 'swc.linux-x64-musl.node');
const source = path.join(__dirname, '..', 'node_modules', '@swc', 'core-linux-x64-gnu', 'swc.linux-x64-gnu.node');

if (!fs.existsSync(target) && fs.existsSync(source)) {
  fs.copyFileSync(source, target);
  console.log('[fix-swc] Copied GNU binding as musl fallback');
}
