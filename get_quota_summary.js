const fs = require('fs');
const path = require('path');
const { execFile, spawn, spawnSync } = require('child_process');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'user');
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

const configDir = path.join(userProfile, '.gemini', 'antigravity-cli');
const cacheFile = path.join(configDir, 'quota_cache.txt');
const dataFile = path.join(configDir, 'quota_data.json');
const agyPath = path.join(localAppData, 'agy', 'bin', 'agy.exe');

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeFileIfChanged(filePath, content) {
  try {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) {
      return;
    }
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {}
}

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
  execFile(agyPath, ['-p', '/quota'], { timeout: 90000, windowsHide: true }, (err, stdout) => {
    if (!err && stdout) {
      let fiveHour = '', fiveReset = '';
      let weekly = '', weeklyReset = '';
      const lines = stdout.split(/\r?\n/);

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
        const now = Date.now();
        const payload = {
          updatedAt: now,
          attemptedAt: now,
          fiveHour: fiveHour || '100%',
          fiveReset: fiveReset || '',
          weekly: weekly || '100%',
          weeklyReset: weeklyReset || ''
        };
        try { fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2), 'utf8'); } catch (e) {}

        const text = buildSummaryText(payload.fiveHour, payload.fiveReset, payload.weekly, payload.weeklyReset);
        writeFileIfChanged(cacheFile, text);
      }
    }
    process.exit(0);
  });
  return;
}

function triggerBackgroundUpdate() {
  if (process.platform === 'win32') {
    try {
      const cmdLine = `"${process.execPath}" "${__filename}" --update`;
      const psScript = [
        '$s = New-CimInstance -ClassName Win32_ProcessStartup -Property @{ ShowWindow = [uint16]0 } -ClientOnly',
        `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmdLine.replace(/'/g, "''")}'; ProcessStartupInformation = $s } | Out-Null`
      ].join('; ');
      const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript], {
        timeout: 4000,
        stdio: 'ignore',
        windowsHide: true
      });
      if (res.status === 0) return;
    } catch (e) {}
  }

  try {
    const child = spawn(process.execPath, [__filename, '--update'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch (e) {}
}

const data = readJsonSafe(dataFile);
const now = Date.now();

if (data && data.fiveHour) {
  const lastTry = Math.max(data.updatedAt || 0, data.attemptedAt || 0);
  const fiveResetMs = data.fiveReset ? new Date(data.fiveReset).getTime() : 0;
  const resetExpired = fiveResetMs > 0 && !isNaN(fiveResetMs) && fiveResetMs <= now;
  const interval = resetExpired ? 30000 : 120000;

  if (now - lastTry > interval) {
    data.attemptedAt = now; // throttle spawns without overwriting updatedAt
    try { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
    triggerBackgroundUpdate();
  }

  // Calculate live countdown
  const text = buildSummaryText(data.fiveHour, data.fiveReset, data.weekly, data.weeklyReset);
  writeFileIfChanged(cacheFile, text);
  process.stdout.write(text);
} else {
  // Initial fallback
  let fallback = '[5h: 100% | Wk: 100%]';
  try {
    if (fs.existsSync(cacheFile)) {
      fallback = fs.readFileSync(cacheFile, 'utf8').replace(/^\uFEFF/, '').trim();
    }
  } catch (e) {}
  triggerBackgroundUpdate();
  process.stdout.write(fallback);
}