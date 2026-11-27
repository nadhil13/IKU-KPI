import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './routes/apiRouter.js';
import { getDatabase, closeDatabase } from './services/database.js';
import { closeAllSseClients } from './services/realtimeHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../../dist');
const VERCEL_JSON_PATH = path.resolve(__dirname, '../../vercel.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveSafeDistPath(urlPath) {
  const rel = String(urlPath || '/').replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(DIST_DIR, rel);
  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

export function createViteApiPlugin() {
  const attachMiddleware = (server) => {
    getDatabase();
    server.middlewares.use(async (req, res, next) => {
      try {
        if (req.url && req.url.startsWith('/api/v1')) {
          const handled = await handleApiRequest(req, res);
          if (handled) return;
        }
        next();
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: err?.message || 'Terjadi kesalahan internal pada server.' }));
          return;
        }
        next(err);
      }
    });
  };
  return {
    name: 'performa-itpln-realtime-backend',
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  };
}

export function createAppServer({ serveStaticDist = true, enableAccessLog = false } = {}) {
  getDatabase();
  let vercelRewrites = [];
  try {
    vercelRewrites = JSON.parse(fs.readFileSync(VERCEL_JSON_PATH, 'utf8')).rewrites || [];
  } catch {
    vercelRewrites = [];
  }

  return http.createServer(async (req, res) => {
    const startedAt = Date.now();
    if (enableAccessLog && req.url && req.url.startsWith('/api/v1')) {
      res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(
          JSON.stringify({
            level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
            at: new Date().toISOString(),
            method: req.method || 'GET',
            url: req.url,
            status: res.statusCode,
            durationMs,
          }),
        );
      });
    }
    try {
      if (req.url && req.url.startsWith('/api/v1')) {
        const handled = await handleApiRequest(req, res);
        if (handled) return;
      }

      if (!serveStaticDist || !fs.existsSync(DIST_DIR)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Route not found' }));
        return;
      }

      let rawPath;
      try {
        rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 BAD_REQUEST');
        return;
      }

      let candidate = resolveSafeDistPath(rawPath === '/' ? 'index.html' : rawPath);
      if (!candidate) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 FORBIDDEN');
        return;
      }

      if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        let rewritten = rawPath;
        for (const rule of vercelRewrites) {
          const regex = new RegExp(`^${rule.source}$`);
          if (regex.test(rawPath)) {
            rewritten = rule.destination;
            break;
          }
        }
        candidate = resolveSafeDistPath(rewritten === '/' ? 'index.html' : rewritten);
      }

      if (!candidate || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 NOT_FOUND');
        return;
      }

      const ext = path.extname(candidate).toLowerCase();
      const baseName = path.basename(candidate).toLowerCase();
      const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
      if (baseName === 'version.json' || baseName === 'sw.js' || baseName === 'index.html') {
        headers['Cache-Control'] = 'no-store, max-age=0';
      }
      res.writeHead(200, headers);
      const stream = fs.createReadStream(candidate);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end();
      });
      stream.pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err?.message || 'Terjadi kesalahan internal pada server.' }));
      } else {
        res.end();
      }
    }
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const port = Number(process.env.PORT || 8000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createAppServer({
    serveStaticDist: true,
    enableAccessLog: process.env.PERFORMA_SILENT_LOGS !== '1',
  });
  server.listen(port, host, () => {
    console.log(`[PERFORMA-BACKEND] Server aktif di http://${host}:${port} (SQLite WAL + SSE Realtime aktif)`);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[PERFORMA-BACKEND] Menerima sinyal ${signal}, menutup server dan melakukan checkpoint SQLite WAL...`);
    closeAllSseClients();
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
    setTimeout(() => {
      closeDatabase();
      process.exit(0);
    }, 5000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
