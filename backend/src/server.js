import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './routes/apiRouter.js';
import { getDatabase } from './services/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../../dist');
const VERCEL_JSON_PATH = path.resolve(__dirname, '../../vercel.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

export function createViteApiPlugin() {
  return {
    name: 'performa-itpln-realtime-backend',
    configureServer(server) {
      getDatabase();
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/v1')) {
          const handled = await handleApiRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      getDatabase();
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/v1')) {
          const handled = await handleApiRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
  };
}

export function createAppServer({ serveStaticDist = true } = {}) {
  getDatabase();
  let vercelRewrites = [];
  try {
    vercelRewrites = JSON.parse(fs.readFileSync(VERCEL_JSON_PATH, 'utf8')).rewrites || [];
  } catch {
    vercelRewrites = [];
  }

  return http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith('/api/v1')) {
      const handled = await handleApiRequest(req, res);
      if (handled) return;
    }

    if (!serveStaticDist || !fs.existsSync(DIST_DIR)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Route not found' }));
      return;
    }

    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let candidate = path.join(DIST_DIR, rawPath === '/' ? 'index.html' : rawPath);
    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
      let rewritten = rawPath;
      for (const rule of vercelRewrites) {
        const regex = new RegExp(`^${rule.source}$`);
        if (regex.test(rawPath)) {
          rewritten = rule.destination;
          break;
        }
      }
      candidate = path.join(DIST_DIR, rewritten === '/' ? 'index.html' : rewritten);
    }

    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 NOT_FOUND');
      return;
    }

    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(candidate).pipe(res);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const port = Number(process.env.PORT || 8000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createAppServer({ serveStaticDist: true });
  server.listen(port, host, () => {
    console.log(`[PERFORMA-BACKEND] Server aktif di http://${host}:${port} (SQLite WAL + SSE Realtime aktif)`);
  });
}
