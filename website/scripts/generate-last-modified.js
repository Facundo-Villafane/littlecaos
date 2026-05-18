const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const docsDir = path.join(repoRoot, 'design');
const outputPath = path.join(__dirname, '..', 'src', 'data', 'last-modified.json');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();

function collectMdFiles(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'registry') {
      result.push(...collectMdFiles(full, base));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      entry.name !== 'CLAUDE.md'
    ) {
      result.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return result;
}

const files = collectMdFiles(docsDir);
const data = {};

for (const file of files) {
  const fullPath = path.join(docsDir, file).replace(/\\/g, '/');
  try {
    const ts = execSync(`git log -1 --format=%at -- "${fullPath}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();

    if (ts) {
      const docId = file.replace(/\.md$/, '');
      const timestamp = parseInt(ts, 10) * 1000;
      data[docId] = {
        timestamp,
        isNew: now - timestamp < SEVEN_DAYS_MS,
      };
    }
  } catch (_) {
    // git not available or file not tracked — skip
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`[last-modified] ${Object.keys(data).length} docs procesados`);
