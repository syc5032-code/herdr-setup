const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'user');
const configDir = path.join(userProfile, '.gemini', 'antigravity-cli');
const cacheFile = path.join(configDir, 'quota_cache.txt');
const dataFile = path.join(configDir, 'quota_data.json');

const pill = (text) => `\x1b[48;2;220;224;232m\x1b[38;2;56;58;66m ${text} \x1b[0m`;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    let data = {};
    try { data = JSON.parse(input); } catch(e) {}

    // 1. Model & effort
    let modelStr = 'Gemini 4 Hydrogen';
    if (data.model && data.model.display_name) {
      modelStr = data.model.display_name;
    }
    if (data.effort && data.effort.level) {
      modelStr += ' ' + data.effort.level;
    } else if (!modelStr.includes('(')) {
      modelStr += ' medium';
    }

    // 2. User identifier
    let userStr = process.env.USERNAME || 'user';
    if (data.email) {
      userStr = data.email.split('@')[0];
    }

    // 3. Quota / Rate limits
    let quotaStr = '';
    if (data.rate_limits) {
      const parts = [];
      if (data.rate_limits.seven_day || data.rate_limits.weekly) {
        const r = data.rate_limits.seven_day || data.rate_limits.weekly;
        const used = r.used_percentage != null ? Math.round(r.used_percentage) : (r.remaining_percentage != null ? (100 - Math.round(r.remaining_percentage)) : null);
        if (used != null) parts.push(`7d ${used}%`);
      }
      if (data.rate_limits.five_hour) {
        const r = data.rate_limits.five_hour;
        const used = r.used_percentage != null ? Math.round(r.used_percentage) : (r.remaining_percentage != null ? (100 - Math.round(r.remaining_percentage)) : null);
        if (used != null) parts.push(`5h ${used}%`);
      }
      if (parts.length > 0) {
        quotaStr = pill(parts.join(' '));
      }
    }

    // Fallback quota from cache if not in stdin
    if (!quotaStr) {
      try {
        const cache = fs.readFileSync(cacheFile, 'utf8').replace(/^\uFEFF/, '');
        const m5 = cache.match(/5h:\s*(\d+)%/);
        const mw = cache.match(/Wk:\s*(\d+)%/);
        const parts = [];
        if (mw) parts.push(`7d ${100 - parseInt(mw[1], 10)}%`);
        if (m5) parts.push(`5h ${100 - parseInt(m5[1], 10)}%`);
        if (parts.length > 0) {
          quotaStr = pill(parts.join(' '));
        }
      } catch(e) {}
    }

    // Auto-refresh quota cache in background if older than 2 minutes
    try {
      let lastTry = 0;
      if (fs.existsSync(dataFile)) {
        const qData = JSON.parse(fs.readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
        lastTry = Math.max(qData.updatedAt || 0, qData.attemptedAt || 0);
      } else if (fs.existsSync(cacheFile)) {
        lastTry = fs.statSync(cacheFile).mtimeMs;
      }
      if (Date.now() - lastTry > 120000) {
        const updater = path.join(configDir, 'get_quota_summary.js');
        const child = require('child_process').spawn(process.execPath, [updater, '--update'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.unref();
      }
    } catch(e) {}

    // 4. Context window
    let ctxStr = '';
    if (data.context_window) {
      const total = data.context_window.total_tokens || 0;
      const size = data.context_window.context_window_size || 1000000;
      const pct = data.context_window.used_percentage != null ? Math.round(data.context_window.used_percentage) : Math.round((total / size) * 100);
      const kTotal = Math.round(total / 1000);
      const kSize = Math.round(size / 1000);
      ctxStr = pill(`ctx ${kTotal}k/${kSize}k ${pct}%`);
    } else {
      ctxStr = pill('ctx 0k/1000k 0%');
    }

    // ANSI styled output:
    const cyan = '\x1b[36m';
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';

    let line = `${cyan}${modelStr}${reset} \u00b7 ${blue}${userStr}${reset}`;
    if (quotaStr) line += `  ${quotaStr}`;
    if (ctxStr) line += ` \u00b7 ${ctxStr}`;

    process.stdout.write(line);
  } catch (err) {
    process.stdout.write('Gemini 4 Hydrogen medium');
  }
});