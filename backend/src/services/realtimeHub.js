/**
 * Hub Realtime Server-Sent Events (SSE) untuk sinkronisasi instan lintas akun,
 * unit PIC KPI, Otoritas IKU, dan Pusat Kendali Superadmin PRP.
 */
import crypto from 'node:crypto';
import { doesBroadcastMatchUser } from './database.js';
import { filterKpiWorkflowForCaller } from '../modules/kpi/kpiAccessPolicy.js';

const clients = new Map();
const MAX_CLIENTS_PER_IP = 25;

let heartbeatInterval = null;

function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [clientId, client] of clients.entries()) {
      try {
        client.res.write(`: heartbeat ${now}\n\n`);
      } catch {
        clients.delete(clientId);
      }
    }
    if (clients.size === 0 && heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }, 15000);
  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }
}

export function registerSseClient(req, res, user, ip) {
  const ipCount = [...clients.values()].filter((c) => c.ip === ip).length;
  if (ipCount >= MAX_CLIENTS_PER_IP) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Batas koneksi realtime per IP tercapai.' }));
    return null;
  }

  const clientId = `sse_${crypto.randomUUID()}`;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const client = {
    id: clientId,
    res,
    user: user || null,
    ip,
    connectedAt: new Date().toISOString(),
  };
  clients.set(clientId, client);
  ensureHeartbeat();

  sendSseEvent(client, 'connected', {
    clientId,
    user: user ? { email: user.email, role: user.role, picCodes: user.picCodes || [] } : null,
    connectedAt: client.connectedAt,
  });

  const cleanup = () => {
    clients.delete(clientId);
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
  return client;
}

function sendSseEvent(client, eventName, data) {
  try {
    const payload = JSON.stringify(data);
    client.res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
  } catch {
    clients.delete(client.id);
  }
}

export function publishRealtimeEvent(eventName, payload, filterFn = null) {
  let delivered = 0;
  for (const client of clients.values()) {
    if (typeof filterFn === 'function' && !filterFn(client)) {
      continue;
    }
    let clientPayload = payload;
    if (payload?.stores?.prp_kpi_distribution_v1 && client.user?.role === 'kpi_only') {
      clientPayload = {
        ...payload,
        stores: {
          ...payload.stores,
          prp_kpi_distribution_v1: filterKpiWorkflowForCaller(payload.stores.prp_kpi_distribution_v1, client.user),
        },
      };
    }
    sendSseEvent(client, eventName, clientPayload);
    delivered += 1;
  }
  return delivered;
}

export function publishTargetedBroadcastEvent(eventName, broadcast) {
  return publishRealtimeEvent(eventName, { broadcast, at: new Date().toISOString() }, (client) => {
    if (!client.user) return broadcast.targetType === 'ALL';
    return doesBroadcastMatchUser(broadcast, client.user);
  });
}

export function getRealtimeStats() {
  return {
    connectedClients: clients.size,
    authenticatedClients: [...clients.values()].filter((c) => Boolean(c.user)).length,
  };
}
