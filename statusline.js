const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'user');
const cacheFile = path.join(userProfile, '.gemini', 'antigravity-cli', 'quota_cache.txt');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    let data = {};
    try { data = JSON.parse(input); } catch(e) {}
    
    // 1. Model & effort
    let modelStr = 'Gemini 3.8 Flash';
    if (data.model && data.model.display_name) {
      modelStr = data.model.display_name;
    }
    if (data.effort && data.effort.level) {
      modelStr += ' ' + data.effort.level;
    } else {
      modelStr += ' high';
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
        quotaStr = `\x1b[48;5;236m\x1b[37m ${parts.join(' ')} \x1b[0m`;
      }
    }
    
    // Fallback quota from cache if not in stdin
    if (!quotaStr) {
      try {
        const cache = fs.readFileSync(cacheFile, 'utf8');
        const m5 = cache.match(/5h:\s*(\d+)%/);
        const mw = cache.match(/Wk:\s*(\d+)%/);
        const parts = [];
        if (mw) parts.push(`7d ${100 - parseInt(mw[1])}%`);
        if (m5) parts.push(`5h ${100 - parseInt(m5[1])}%`);
        if (parts.length > 0) {
          quotaStr = `\x1b[48;5;236m\x1b[37m ${parts.join(' ')} \x1b[0m`;
        }
      } catch(e) {}
    }

    // Auto-refresh quota cache in background if older than 2 minutes
    try {
      const stats = fs.statSync(cacheFile);
      if (Date.now() - stats.mtimeMs > 120000) {
        const updater = path.join(userProfile, '.gemini', 'antigravity-cli', 'get_quota_summary.js');
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
      ctxStr = `\x1b[48;5;236m\x1b[37m ctx ${kTotal}k/${kSize}k ${pct}% \x1b[0m`;
    } else {
      ctxStr = `\x1b[48;5;236m\x1b[37m ctx 0k/1000k 0% \x1b[0m`;
    }
    
    // ANSI styled output:
    const cyan = '\x1b[36m';
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    
    let line = `${cyan}${modelStr}${reset} · ${blue}${userStr}${reset}`;
    if (quotaStr) line += `  ${quotaStr}`;
    if (ctxStr) line += ` · ${ctxStr}`;
    
    process.stdout.write(line);
  } catch (err) {
    process.stdout.write('Gemini 3.8 Flash high');
  }
});
