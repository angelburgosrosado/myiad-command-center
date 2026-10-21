/**
 * src/health-worker.ts — Scheduled 10-Minute Ecosystem Health Prober
 * Runs via Render Cron Job (myiad-ecosystem-health-monitor) and logs to PostgreSQL
 */
import pg from 'pg';

const { Pool } = pg;
const SCHEMA_NAME = 'vault_app_angelburgosrosado';

const ENDPOINTS = [
  { name: 'MyIAD PR SaaS', url: 'https://saas.myiad.net', provider: 'Vercel' },
  { name: 'MyIAD US CRM', url: 'https://crm.myiad.net', provider: 'Vercel' },
  { name: 'MyIAD Solo Agent', url: 'https://agent.myiad.net', provider: 'Vercel' },
  { name: 'IPTV.Menu Web', url: 'https://iptv.menu', provider: 'Render' },
  { name: 'Story.Menu App', url: 'https://story.menu', provider: 'CloudRun' },
  { name: 'AB Global Consulting', url: 'https://abglco.com', provider: 'Web' },
  { name: 'SendPut', url: 'https://sendput.com', provider: 'Web' }
];

async function runHealthCheck() {
  console.log('[Health Worker] Starting 7-domain ecosystem probe...');
  const connStr = (process.env.DATABASE_URL || process.env.VPS_POSTGRES_URL || '').replace(/['"]/g, '').trim();
  const pool = connStr ? new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } }) : null;

  for (const ep of ENDPOINTS) {
    const start = Date.now();
    let status = 0;
    let errText: string | null = null;
    let llmsOk = false;
    try {
      const resp = await fetch(ep.url);
      status = resp.status;
      const llms = await fetch(`${ep.url}/llms.txt`, { method: 'HEAD' }).catch(() => null);
      llmsOk = Boolean(llms && llms.ok);
    } catch (e: any) {
      errText = e.message;
    }
    const latency = Date.now() - start;
    console.log(`[Health Worker] ${ep.name} (${ep.url}) -> HTTP ${status} in ${latency}ms | llms.txt: ${llmsOk}`);

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO ${SCHEMA_NAME}.infra_health_telemetry (service_name, endpoint_url, provider, http_status, latency_ms, llms_txt_detected, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ep.name, ep.url, ep.provider, status, latency, llmsOk, errText]
        );
      } catch (dbErr: any) {
        console.warn('[Health Worker] DB insert skipped:', dbErr.message);
      }
    }
  }

  if (pool) await pool.end();
  console.log('[Health Worker] Probe complete.');
}

runHealthCheck().catch(console.error);
