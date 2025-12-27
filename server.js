// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();

// Config
const VIDEO_DIR = path.join(process.cwd(), 'videos');
const DELAY_MS_PER_SECOND_JUMP = 500; // 500 ms delay per second jumped
const MAX_DELAY_MS = 10_000; // cap delay to keep UX tolerable
const AUTH_REQUIRED = true;

// Simple token validator (replace with JWT/HMAC/etc.)
function validateAuth(req) {
  // Option A: Authorization header
  const auth = req.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    // TODO: validate token (signature, expiry, audience)
    return Boolean(token);
  }

  // Option B: signed token in query
  const st = req.query.st;
  if (st && typeof st === 'string') {
    // TODO: validate signed token
    return true;
  }

  return !AUTH_REQUIRED; // allow if auth not required
}

// Track last served byte offset per client (by token or IP)
const clientState = new Map();
/**
 * getClientKey: derive a stable key per client session
 */
function getClientKey(req) {
  const auth = req.get('Authorization') || '';
  if (auth) return crypto.createHash('sha256').update(auth).digest('hex');
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * computeDelay: delay based on jump in seconds
 * - lastOffset: last byte offset served
 * - requestedStart: requested Range start byte
 * - bitrate: approximate bytes per second (derived from file size/duration if available)
 */
function computeDelay(lastOffset, requestedStart, bitrate) {
  if (!Number.isFinite(lastOffset) || !Number.isFinite(requestedStart) || !Number.isFinite(bitrate) || bitrate <= 0) {
    return 0;
  }
  const byteJump = Math.max(0, requestedStart - lastOffset);
  const secondsJump = byteJump / bitrate;
  const delay = Math.min(MAX_DELAY_MS, Math.ceil(secondsJump * DELAY_MS_PER_SECOND_JUMP));
  return delay;
}

// Optional: naive bitrate estimate cache (replace with real metadata)
const bitrateCache = new Map(); // key: filename -> bytes/sec

function estimateBitrate(filePath) {
  // If you know duration, use size/duration. Without duration, use a fallback.
  // For demo, assume ~1 MB/s (adjust to your content).
  const fallbackBytesPerSec = 1_000_000;
  return bitrateCache.get(filePath) || fallbackBytesPerSec;
}

// Security headers to discourage easy downloads
function setAntiDownloadHeaders(res) {
  res.set({
    'Content-Disposition': 'inline', // avoid attachment
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
  });
}

app.get('/video/:name', async (req, res) => {
  try {
    if (!validateAuth(req)) {
      return res.status(401).send('Unauthorized');
    }

    const fileName = req.params.name;
    const filePath = path.join(VIDEO_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    setAntiDownloadHeaders(res);

    const clientKey = getClientKey(req);
    const state = clientState.get(clientKey) || { lastOffset: 0 };

    if (!rangeHeader) {
      // Serve from start with throttling based on jump from lastOffset
      const start = 0;
      const end = fileSize - 1;
      const chunkSize = end - start + 1;

      const bitrate = estimateBitrate(filePath);
      const delayMs = computeDelay(state.lastOffset, start, bitrate);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

      res.status(200).set({
        'Content-Type': 'video/mp4',
        'Content-Length': chunkSize,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      stream.on('close', () => {
        state.lastOffset = end;
        clientState.set(clientKey, state);
      });
      stream.on('error', (err) => {
        console.error(err);
        res.destroy(err);
      });
      return;
    }

    // Parse Range: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end >= fileSize) {
      return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
    }

    const chunkSize = end - start + 1;

    // Throttle if user seeks far ahead
    const bitrate = estimateBitrate(filePath);
    const delayMs = computeDelay(state.lastOffset, start, bitrate);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
    stream.on('close', () => {
      state.lastOffset = end;
      clientState.set(clientKey, state);
    });
    stream.on('error', (err) => {
      console.error(err);
      res.destroy(err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video server listening on http://localhost:${PORT}`);
});