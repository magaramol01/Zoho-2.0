const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps/web/.next/standalone');
const destDir = path.join(__dirname, 'apps/web/.deploy');

if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(srcDir, destDir, { recursive: true });

// Copy public and static
fs.cpSync(path.join(__dirname, 'apps/web/.next/static'), path.join(destDir, 'apps/web/.next/static'), { recursive: true });
fs.cpSync(path.join(__dirname, 'apps/web/public'), path.join(destDir, 'apps/web/public'), { recursive: true });

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isSymbolicLink()) {
      let target = fs.readlinkSync(fullPath);
      if (target.includes('node_modules')) {
        target = target.replace(/node_modules/g, '_modules');
        fs.unlinkSync(fullPath);
        fs.symlinkSync(target, fullPath);
      }
    } else if (entry.isDirectory()) {
      processDirectory(fullPath);
    }
  }
}

// Fix symlinks first
processDirectory(destDir);

// Now rename the actual node_modules directories
function renameModules(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      const fullPath = path.join(dir, entry.name);
      fs.renameSync(fullPath, path.join(dir, '_modules'));
    }
    if (entry.isDirectory()) {
      // Need to process the newly renamed or existing directory
      const newPath = entry.name === 'node_modules' ? path.join(dir, '_modules') : path.join(dir, entry.name);
      renameModules(newPath);
    }
  }
}

renameModules(destDir);
console.log('Done fixing web standalone!');
