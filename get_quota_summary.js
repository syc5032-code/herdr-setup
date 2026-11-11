const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'user');
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

const configDir = path.join(userProfile, '.gemini', 'antigravity-cli');
const cacheFile = path.join(configDir, 'quota_cache.txt');
const dataFile = path.join(configDir, 'quota_data.json');
const agyPath = path.join(localAppData, 'agy', 'bin', 'agy.exe');

function formatTimeRemaining(resetIso) {
  if (!resetIso) return '';
  const resetTime = new Date(resetIso).getTime();
  const diffMs = resetTime - Date.now();
  if (diffMs <= 0 || isNaN(diffMs)) return '';

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days >= 1) {
    return `${days}d ${remainingHours}h`;
  } else if (hours >= 1) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function buildSummaryText(fiveHour, fiveReset, weekly, weeklyReset) {
  const t5 = formatTimeRemaining(fiveReset);
  const tw = formatTimeRemaining(weeklyReset);

  const s5 = fiveHour ? (t5 && fiveHour !== '100%' ? `${fiveHour} (${t5})` : fiveHour) : '100%';
  const sw = weekly ? (tw && weekly !== '100%' ? `${weekly} (${tw})` : weekly) : '100%';

  return `[5h: ${s5} | Wk: ${sw}]`;
}

// Background updater mode
if (process.argv.includes('--update')) {
  exec(`"${agyPath}" -p /quota`, { timeout: 45000 }, (err, stdout) => {
    if (!err && stdout) {
      let fiveHour = '', fiveReset = '';
      let weekly = '', weeklyReset = '';
      const lines = stdout.split('\n');

      // 1. Try Gemini Models first
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3 && parts[0].includes('Gemini Models')) {
          if (parts[1].includes('Five Hour Limit Remaining')) {
            const m = parts[2].match(/(\d+)%/);
            if (m) fiveHour = m[1] + '%';
            if (parts[3]) fiveReset = parts[3].trim();
          }
          if (parts[1].includes('Weekly Limit Remaining')) {
            const m = parts[2].match(/(\d+)%/);
            if (m) weekly = m[1] + '%';
            if (parts[3]) weeklyReset = parts[3].trim();
          }
        }
      }

      // 2. Fallback to any model if Gemini Models not found
      if (!fiveHour || !weekly) {
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            if (parts[1].includes('Five Hour Limit Remaining') && !fiveHour) {
              const m = parts[2].match(/(\d+)%/);
              if (m) fiveHour = m[1] + '%';
              if (parts[3]) fiveReset = parts[3].trim();
            }
            if (parts[1].includes('Weekly Limit Remaining') && !weekly) {
              const m = parts[2].match(/(\d+)%/);
              if (m) weekly = m[1] + '%';
              if (parts[3]) weeklyReset = parts[3].trim();
            }
          }
        }
      }

      if (fiveHour || weekly) {
        const payload = {
          updatedAt: Date.now(),
          fiveHour: fiveHour || '100%',
          fiveReset: fiveReset || '',
          weekly: weekly || '100%',
          weeklyReset: weeklyReset || ''
        };
        try { fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2), 'utf8'); } catch (e) {}

        const text = buildSummaryText(payload.fiveHour, payload.fiveReset, payload.weekly, payload.weeklyReset);
        try { fs.writeFileSync(cacheFile, text, 'utf8'); } catch (e) {}
      }
    }
    process.exit(0);
  });
  return;
}

function triggerBackgroundUpdate() {
  try {
    const child = spawn(process.execPath, [__filename, '--update'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch (e) {}
}

let data = null;
try {
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  }
} catch (e) {}

if (data && data.fiveHour) {
  // If cache is older than 2 minutes, trigger background update
  if (Date.now() - (data.updatedAt || 0) > 120000) {
    data.updatedAt = Date.now(); // throttle spawns
    try { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
    triggerBackgroundUpdate();
  }

  // Calculate live countdown
  const text = buildSummaryText(data.fiveHour, data.fiveReset, data.weekly, data.weeklyReset);
  try { fs.writeFileSync(cacheFile, text, 'utf8'); } catch (e) {}
  process.stdout.write(text);
} else {
  // Initial fallback
  let fallback = '[5h: 100% | Wk: 100%]';
  try {
    if (fs.existsSync(cacheFile)) {
      fallback = fs.readFileSync(cacheFile, 'utf8').trim();
    }
  } catch (e) {}
  triggerBackgroundUpdate();
  process.stdout.write(fallback);
}
