#!/usr/bin/env node
/**
 * Watch mode — rebuild on template/data/asset changes.
 */
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
let building = false;
let pending = false;

function runBuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  console.log('\n[dev] Rebuilding...\n');
  const proc = spawn('node', ['build.js'], { cwd: ROOT, stdio: 'inherit', shell: true });
  proc.on('close', code => {
    building = false;
    if (code === 0) console.log('[dev] Build OK\n');
    else console.log(`[dev] Build failed (exit ${code})\n`);
    if (pending) {
      pending = false;
      runBuild();
    }
  });
}

async function main() {
  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch {
    console.error('chokidar required. Run: npm install');
    process.exit(1);
  }

  const watchPaths = [
    path.join(ROOT, 'templates'),
    path.join(ROOT, 'data'),
    path.join(ROOT, 'assets'),
    path.join(ROOT, 'lib'),
    path.join(ROOT, 'scripts'),
    path.join(ROOT, 'build.js'),
  ];

  console.log('[dev] Watching for changes...');
  console.log('[dev] Paths:', watchPaths.map(p => path.relative(ROOT, p)).join(', '));

  const watcher = chokidar.watch(watchPaths, {
    ignored: [/node_modules/, /generated/, /dist/],
    ignoreInitial: true,
  });

  const trigger = (filePath) => {
    console.log(`[dev] Changed: ${path.relative(ROOT, filePath)}`);
    runBuild();
  };

  watcher.on('change', trigger);
  watcher.on('add', trigger);
  watcher.on('unlink', trigger);

  runBuild();
}

main();
