const { app, dialog, shell } = require('electron');
const log = require('electron-log');
const https = require('https');

const SUPABASE_URL = 'https://fcfezhoaxqroubphzzfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDc1NzAsImV4cCI6MjA5MzYyMzU3MH0.GXjaEpjuRCM39qMkpSCPHyhEoC1nxRg-1BpQ_39q4pc';

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/download_releases?platform=eq.windows&is_latest=eq.true&order=created_at.desc&limit=1`;
    const options = {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function checkForUpdates(silent = false) {
  try {
    const releases = await fetchLatestRelease();
    if (!releases || releases.length === 0) return;

    const latest = releases[0];
    const current = app.getVersion();

    log.info(`Update check: current=${current}, latest=${latest.version}`);

    if (compareVersions(latest.version, current) <= 0) {
      if (!silent) {
        dialog.showMessageBox({
          type: 'info',
          title: 'No Updates',
          message: `EPM Monitor v${current} is up to date.`,
          buttons: ['OK'],
        });
      }
      return;
    }

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `EPM Monitor v${latest.version} is available`,
      detail: `You have v${current}. Download the latest version now?\n\nExtract the zip and replace your current EPM Monitor folder.`,
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
    });

    if (result.response === 0) {
      shell.openExternal(latest.download_url);
    }
  } catch (err) {
    log.warn('Update check failed:', err.message);
  }
}

// Check on startup (silently — only show dialog if update is available)
function scheduleUpdateCheck() {
  // First check after 30 seconds (let app fully load)
  setTimeout(() => checkForUpdates(true), 30 * 1000);
  // Then every 4 hours
  setInterval(() => checkForUpdates(true), 4 * 60 * 60 * 1000);
}

module.exports = { checkForUpdates, scheduleUpdateCheck };
