const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'user');
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

const cacheFile = path.join(userProfile, '.gemini', 'antigravity-cli', 'quota_cache.txt');
const agyPath = path.join(localAppData, 'agy', 'bin', 'agy.exe');

function readCache() {
  try {
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile, 'utf8').trim();
    }
  } catch (e) {}
  return '';
}

function updateCache() {
  exec(`"${agyPath}" -p /quota`, { timeout: 15000 }, (err, stdout) => {
    if (!err && stdout) {
      let fiveHour = '';
      let weekly = '';
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('Five Hour Limit Remaining') && !fiveHour) {
          const match = line.match(/(\d+)%/);
          if (match) fiveHour = match[1] + '%';
        }
        if (line.includes('Weekly Limit Remaining') && !weekly) {
          const match = line.match(/(\d+)%/);
          if (match) weekly = match[1] + '%';
        }
      }
      if (fiveHour || weekly) {
        const text = `[5h: ${fiveHour || '100%'} | Wk: ${weekly || '100%'}]`;
        fs.writeFileSync(cacheFile, text, 'utf8');
      }
    }
  });
}

const current = readCache();
if (!current) {
  const initial = '[5h: 91% | Wk: 92%]';
  try { fs.writeFileSync(cacheFile, initial, 'utf8'); } catch(e) {}
  updateCache();
  process.stdout.write(initial);
} else {
  try {
    const stats = fs.statSync(cacheFile);
    if (Date.now() - stats.mtimeMs > 180000) { // 3분 주기 갱신
      updateCache();
    }
  } catch (e) {
    updateCache();
  }
  process.stdout.write(current);
}
