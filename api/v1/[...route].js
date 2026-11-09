/**
 * Vercel Serverless API Gateway untuk PERFORMA ITPLN (/api/v1/*).
 * Meneruskan seluruh permintaan API ke mesin router backend terpusat (handleApiRequest).
 */
import { handleApiRequest } from '../../backend/src/routes/apiRouter.js';
import { getDatabase } from '../../backend/src/services/database.js';

export default async function handler(req, res) {
  getDatabase();
  const handled = await handleApiRequest(req, res);
  if (!handled && !res.writableEnded) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Endpoint API tidak ditemukan.' }));
  }
}
