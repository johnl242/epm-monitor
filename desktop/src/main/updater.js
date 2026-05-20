const { app, dialog, shell } = require('electron');
const log = require('electron-log');
const https = require('https');

const RTDB_URL = 'https://website-bf923-default-rtdb.asia-southeast1.firebasedatabase.app/epm_releases/latest';
const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

let sseRequest = null;
let updateDialogShown = false;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function promptUpdate(version, downloadUrl) {
  if (updateDialogShown) return;
  updateDialogShown = true;

  const current = app.getVersion();
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `EPM Monitor v${version} is available`,
    detail: `You have v${current}.\n\nDownload the new version, extract the zip, and replace your current EPM Monitor folder.`,
    buttons: ['Download Now', 'Later'],
    defaultId: 0,
  });

  if (result.response === 0) shell.openExternal(downloadUrl);
  // Reset after 1 hour so user can be reminded again
  setTimeout(() => { updateDialogShown = false; }, 60 * 60 * 1000);
}

function handleReleaseData(data) {
  if (!data || !data.version) return;
  const current = app.getVersion();
  log.info(`RTDB update signal: current=${current}, latest=${data.version}`);
  if (compareVersions(data.version, current) > 0) {
    promptUpdate(data.version, data.downloadUrl);
  }
}

// ── Real-time RTDB SSE listener ──────────────────────────────────────────────
function startRTDBListener() {
  if (sseRequest) {
    try { sseRequest.destroy(); } catch (_) {}
  }

  log.info('Starting RTDB update listener...');

  const url = new URL(RTDB_URL + '.json');
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
  };

  sseRequest = https.get(options, (res) => {
    let buffer = '';

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep incomplete last chunk

      for (const block of parts) {
        const lines = block.split('\n');
        let event = null;
        let dataStr = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
        }
        if (event === 'put' && dataStr) {
          try {
            const payload = JSON.parse(dataStr);
            // Initial load: payload.path === '/' payload.data === {...}
            // Update: same structure
            handleReleaseData(payload.data);
          } catch (e) {
            log.warn('RTDB parse error:', e.message);
          }
        }
      }
    });

    res.on('end', () => {
      log.warn('RTDB SSE stream ended, reconnecting in 10s...');
      setTimeout(startRTDBListener, 10 * 1000);
    });

    res.on('error', (err) => {
      log.warn('RTDB SSE stream error:', err.message);
      setTimeout(startRTDBListener, 10 * 1000);
    });
  });

  sseRequest.on('error', (err) => {
    log.warn('RTDB connection error:', err.message);
    // Fall back to Supabase polling
    setTimeout(pollSupabase, 10 * 1000);
  });

  sseRequest.setTimeout(0); // no timeout — keep alive
}

// ── Supabase polling fallback ────────────────────────────────────────────────
function fetchFromSupabase() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/download_releases?platform=eq.windows&is_latest=eq.true&order=created_at.desc&limit=1`;
    https.get(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function pollSupabase() {
  try {
    const releases = await fetchFromSupabase();
    if (releases && releases.length > 0) {
      handleReleaseData({ version: releases[0].version, downloadUrl: releases[0].download_url });
    }
  } catch (err) {
    log.warn('Supabase update poll failed:', err.message);
  }
}

// ── Manual check (called from tray menu) ────────────────────────────────────
async function checkForUpdates(silent = false) {
  try {
    const releases = await fetchFromSupabase();
    if (!releases || releases.length === 0) {
      if (!silent) dialog.showMessageBox({ type: 'info', title: 'No Updates', message: 'Could not reach update server.', buttons: ['OK'] });
      return;
    }

    const latest = releases[0];
    const current = app.getVersion();

    if (compareVersions(latest.version, current) <= 0) {
      if (!silent) dialog.showMessageBox({ type: 'info', title: 'Up to Date', message: `EPM Monitor v${current} is the latest version.`, buttons: ['OK'] });
      return;
    }

    updateDialogShown = false; // allow dialog even if already shown
    await promptUpdate(latest.version, latest.download_url);
  } catch (err) {
    log.warn('Manual update check failed:', err.message);
    if (!silent) dialog.showMessageBox({ type: 'warning', title: 'Update Check Failed', message: 'Could not check for updates. Please try again later.', buttons: ['OK'] });
  }
}

// ── Startup ──────────────────────────────────────────────────────────────────
function scheduleUpdateCheck() {
  // Start real-time RTDB listener after 10s (let app fully load)
  setTimeout(startRTDBListener, 10 * 1000);
  // Supabase poll every 6 hours as a safety net
  setInterval(pollSupabase, 6 * 60 * 60 * 1000);
}

module.exports = { checkForUpdates, scheduleUpdateCheck };
