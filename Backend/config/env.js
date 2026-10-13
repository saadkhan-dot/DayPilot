const path = require('path');

// Load .env without adding a dependency. Existing shell environment values win.
function loadEnv() {
  try {
    const fs = require('fs');
    const contents = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = loadEnv;
