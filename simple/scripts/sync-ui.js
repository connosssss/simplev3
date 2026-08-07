
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_CHROME = path.join(__dirname, '..', 'chrome');
const ENGINE_DIR = path.join(__dirname, '..', '..', 'firefox');
const ENGINE_CHROME = path.join(ENGINE_DIR, 'browser', 'chrome');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } 
  
  else {
    fs.copyFileSync(src, dest);
  }
}

function applyManifestPatches() {
}

console.log('syncing custom ui');
copyRecursiveSync(SOURCE_CHROME, ENGINE_CHROME);

console.log('applying build manifest patches');
applyManifestPatches();

console.log('UI assets & manifests synced successfully');

const mode = process.argv[2];
const env = { ...process.env, MOZBUILD_STATE_PATH: process.env.MOZBUILD_STATE_PATH || 'C:\\Users\\conno\\.mozbuild_clean' };

if (mode === 'build') {
  console.log('building Firefox engine');
  execSync('python mach build', { cwd: ENGINE_DIR, stdio: 'inherit', env });
} 

else if (mode === 'build:ui') {
  console.log(' building Firefox UI layer');
  execSync('python mach build browser', { cwd: ENGINE_DIR, stdio: 'inherit', env });
}

else if (mode === 'run' || mode === 'start') {
  console.log('launching Firefox engine');
  execSync('python mach run', { cwd: ENGINE_DIR, stdio: 'inherit', env });
}
