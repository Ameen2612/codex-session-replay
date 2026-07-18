const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;
const SESSIONS_ROOT = path.join(os.homedir(), '.codex', 'sessions');

app.use(express.static(path.join(__dirname, 'public')));

function findJsonlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonlFiles(fullPath));
    } else if (entry.name.endsWith('.jsonl')) {
      results.push(fullPath);
    }
  }
  return results;
}

function isSessionFile(filePath) {
  const root = path.resolve(SESSIONS_ROOT);
  const resolved = path.resolve(filePath);
  return resolved.startsWith(root + path.sep) && path.extname(resolved) === '.jsonl';
}

function getSessionMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n').find(l => l.trim());
    const parsed = JSON.parse(firstLine);
    const meta = parsed.payload || {};
    const stats = fs.statSync(filePath);
    return {
      id: encodeURIComponent(filePath),
      filename: path.basename(filePath),
      cwd: meta.cwd || 'unknown',
      timestamp: meta.timestamp || parsed.timestamp || null,
      sizeBytes: stats.size
    };
  } catch (e) {
    return null;
  }
}

app.get('/api/sessions', (req, res) => {
  const files = findJsonlFiles(SESSIONS_ROOT);
  const sessions = files.map(getSessionMeta).filter(Boolean);
  sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(sessions);
});

app.get('/api/sessions/:id', (req, res) => {
  let filePath;
  try {
    filePath = decodeURIComponent(req.params.id);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid session path' });
  }
  if (!isSessionFile(filePath)) {
    return res.status(400).json({ error: 'Invalid session path' });
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const events = lines.map(l => {
      try { return JSON.parse(l); } catch (e) { return null; }
    }).filter(Boolean);
    res.json(events);
  } catch (e) {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.listen(PORT, () => {
  console.log('Codex Session Replay running at http://localhost:' + PORT);
});
