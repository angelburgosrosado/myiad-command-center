/**
 * server.ts — Full-Stack Command Center Backend (Render + Neon + VPS 34.148.244.49:5432)
 * Uses Angel Burgos's Self-Healing TCP Probe & Multi-Tenant Schema Architecture
 */
import express from 'express';
import path from 'path';
import net from 'net';
import pg from 'pg';

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 10000;
const SCHEMA_NAME = 'vault_app_angelburgosrosado';

let dbPool: pg.Pool | null = null;
let dbOnline = false;

function testTcpPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function initDbPool() {
  const connStr = (process.env.DATABASE_URL || process.env.VPS_POSTGRES_URL || '').replace(/['"]/g, '').trim();
  if (!connStr || connStr.includes('placeholder')) {
    console.warn('[Self-Healing DB] No active DATABASE_URL provided; operating in stateful memory + localStorage sync mode.');
    return;
  }
  try {
    dbPool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000
    });
    const client = await dbPool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};`);
      await client.query(`SET search_path TO ${SCHEMA_NAME}, public;`);
      dbOnline = true;
      console.log(`[Self-Healing DB] Connected to PostgreSQL (${SCHEMA_NAME})`);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Self-Healing DB] Fallback activated:', err.message);
    dbOnline = false;
  }
}

const MONITORED_ENDPOINTS = [
  { name: 'MyIAD PR SaaS', url: 'https://saas.myiad.net', provider: 'Vercel / GitHub' },
  { name: 'MyIAD US CRM', url: 'https://crm.myiad.net', provider: 'Vercel / Supabase' },
  { name: 'MyIAD Solo Agent', url: 'https://agent.myiad.net', provider: 'Vercel / GitHub' },
  { name: 'IPTV.Menu Web', url: 'https://iptv.menu', provider: 'Render / Neon' },
  { name: 'Story.Menu App', url: 'https://story.menu', provider: 'Cloud Run / Supabase' },
  { name: 'AB Global Consulting', url: 'https://abglco.com', provider: 'Production Web' },
  { name: 'SendPut (SignalForge 2.4)', url: 'https://sendput.com', provider: 'Production Web' }
];

app.get('/api/health', async (_req, res) => {
  const vpsReachable = await testTcpPort('34.148.244.49', 5432, 2000);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      poolConnected: dbOnline,
      isolatedSchema: SCHEMA_NAME,
      neonEndpoint: 'ep-winter-poetry-ae51hoth.us-east-2.aws.neon.tech',
      vpsPostgresTcp5432: vpsReachable ? 'OPEN (34.148.244.49:5432)' : 'FILTERED / OFFLINE'
    },
    renderServices: [
      { id: 'srv-daffgtf40ujc73b38jog', name: 'iptv-api', type: 'web' },
      { id: 'srv-daffgtf40ujc73b38jo0', name: 'iptv-worker', type: 'worker' },
      { id: 'srv-daebvt9t0dsc739kcfh0', name: 'iptv-menu-app', type: 'worker' }
    ]
  });
});

app.get('/api/probe-ecosystem', async (_req, res) => {
  const results = await Promise.all(
    MONITORED_ENDPOINTS.map(async (ep) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(ep.url, { signal: controller.signal });
        clearTimeout(timer);
        const llmsResp = await fetch(`${ep.url}/llms.txt`, { method: 'HEAD' }).catch(() => null);
        return {
          ...ep,
          status: resp.status,
          ok: resp.ok,
          latencyMs: Date.now() - start,
          llmsTxt: Boolean(llmsResp && llmsResp.ok)
        };
      } catch (e: any) {
        return { ...ep, status: 0, ok: false, latencyMs: Date.now() - start, error: e.message, llmsTxt: false };
      }
    })
  );
  res.json({ checkedAt: new Date().toISOString(), results });
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

initDbPool().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MyIAD & AB Global Full-Stack Command Center listening on 0.0.0.0:${PORT}`);
  });
});
