/**
 * server.ts — Full-Stack Command Center Backend (Render + Neon AWS)
 * Features: Polsia-Style Autonomous Operator Engine + Administrative Secrets Vault & Auto-Healing
 */
import express from 'express';
import path from 'path';
import net from 'net';
import pg from 'pg';
import { AutonomousEngine } from './autonomous-engine.js';
import { AdminVault } from './admin-vault.js';

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 10000;
const SCHEMA_NAME = 'vault_app_angelburgosrosado';

let dbPool: pg.Pool | null = null;
let dbOnline = false;

const adminVault = new AdminVault(null);
const autonomousEngine = new AutonomousEngine(null, adminVault);

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
  const connStr = (process.env.DATABASE_URL || '').replace(/['"]/g, '').trim();
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
      autonomousEngine.updatePool(dbPool);
      adminVault.updatePool(dbPool);
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
  { name: 'Story.Menu App', url: 'https://story.menu', provider: 'Render / Supabase' },
  { name: 'AB Global Consulting', url: 'https://abglco.com', provider: 'Production Web' },
  { name: 'SendPut (SignalForge 2.4)', url: 'https://sendput.com', provider: 'Production Web' }
];

// --- TELEMETRY & HEALTH CHECKS ---
const SERVER_BUILD_TIME = Date.now().toString();

app.get('/api/version', (_req, res) => {
  res.json({ version: SERVER_BUILD_TIME, timestamp: new Date().toISOString() });
});

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      poolConnected: dbOnline,
      isolatedSchema: SCHEMA_NAME,
      neonEndpoint: (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'ep-summer-block-b5fdfrpo-pooler.c-7.us-east-2.aws.neon.tech',
      provider: 'Neon Serverless PostgreSQL (AWS)'
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

// ============================================================================
// POLSIA-INSPIRED AUTONOMOUS OPERATOR & TASK MANAGEMENT ROUTES
// ============================================================================

// 1. Goals (Macro Objectives / Roadmaps)
app.get('/api/autonomous/goals', async (_req, res) => {
  try {
    const goals = await autonomousEngine.getGoals();
    res.json(goals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/autonomous/goals', async (req, res) => {
  try {
    const result = await autonomousEngine.createGoal(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/autonomous/goals/:id', async (req, res) => {
  try {
    const updated = await autonomousEngine.updateGoal(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Goal not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Tasks
app.get('/api/autonomous/tasks', async (req, res) => {
  try {
    const goalId = req.query.goal_id ? String(req.query.goal_id) : undefined;
    const tasks = await autonomousEngine.getTasks(goalId);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/autonomous/tasks', async (req, res) => {
  try {
    const task = await autonomousEngine.createTask(req.body);
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/autonomous/tasks/:id', async (req, res) => {
  try {
    const updated = await autonomousEngine.updateTask(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/autonomous/tasks/:id/execute', async (req, res) => {
  try {
    const executed = await autonomousEngine.executeTask(req.params.id);
    res.json(executed);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/autonomous/tasks/:id/approve', async (req, res) => {
  try {
    const approved = await autonomousEngine.approveTask(req.params.id, req.body.approver);
    if (!approved) return res.status(404).json({ error: 'Task not found' });
    res.json(approved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Live Activity Stream (Feed)
app.get('/api/autonomous/feed', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logs = await autonomousEngine.getLogs(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/autonomous/feed/log', async (req, res) => {
  try {
    const log = await autonomousEngine.logEvent(req.body);
    res.status(201).json(log);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Artifacts & Deliverables
app.get('/api/autonomous/artifacts', async (_req, res) => {
  try {
    const artifacts = await autonomousEngine.getArtifacts();
    res.json(artifacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Daily Morning Briefings / Recaps
app.get('/api/autonomous/recaps', async (_req, res) => {
  try {
    const recaps = await autonomousEngine.getRecaps();
    res.json(recaps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/autonomous/recaps/generate', async (_req, res) => {
  try {
    const recap = await autonomousEngine.generateDailyRecap();
    res.status(201).json(recap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. 24/7 Autonomous Cycle ("God Mode" Loop Trigger)
app.post('/api/autonomous/cycle', async (_req, res) => {
  try {
    const result = await autonomousEngine.runAutonomousCycle();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMINISTRATIVE SECRETS VAULT & TOOL AUTOMATION ENDPOINTS
// ============================================================================

// 1. Get Sanitized Vault Keys (for settings UI)
app.get('/api/admin/vault', (_req, res) => {
  try {
    const keys = adminVault.getAllKeysSanitized();
    res.json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save Key / Setting
app.post('/api/admin/vault', async (req, res) => {
  try {
    const { key_name, key_value, description } = req.body;
    if (!key_name) return res.status(400).json({ error: 'key_name is required' });
    const saved = await adminVault.setKey(key_name, key_value || '', description);
    res.json({ success: true, item: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Test Integration (Gemini, Render, GitHub, Telegram, VPS)
app.post('/api/admin/vault/test', async (req, res) => {
  try {
    const { key_name } = req.body;
    if (!key_name) return res.status(400).json({ error: 'key_name is required' });
    const testResult = await adminVault.testIntegration(key_name);
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Action: Self-Healing Render Service Restart
app.post('/api/admin/actions/restart-render', async (req, res) => {
  try {
    const result = await adminVault.triggerRenderServiceRestart(req.body.service_id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4b. Action: Sync Render Environment Variables & Deploy
app.post('/api/admin/actions/sync-render-env', async (req, res) => {
  try {
    const { service_id, env_vars } = req.body;
    if (!service_id || !Array.isArray(env_vars)) {
      return res.status(400).json({ error: 'service_id and env_vars array required' });
    }
    const result = await adminVault.syncRenderEnvVars(service_id, env_vars);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4c. Action: Automated 3-Step IPTV Remediation Sync
app.post('/api/admin/actions/remediate-iptv', async (req, res) => {
  try {
    const databaseUrl = req.body.database_url || req.body.databaseUrl;
    if (!databaseUrl) {
      return res.status(400).json({ error: 'database_url is required' });
    }
    const result = await adminVault.syncIptvRemediation(databaseUrl, req.body.jwt_secret);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4d. Action: List Render Services
app.get('/api/admin/render/services', async (_req, res) => {
  try {
    const services = await adminVault.listRenderServices();
    res.json(services);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4e. Action: Unified 1-Click Autonomous Self-Healing & Remediation
app.post('/api/admin/actions/quick-remediate', async (req, res) => {
  try {
    const { action_type, service_id } = req.body;
    
    if (action_type === 'restart_render_services') {
      const restart = await adminVault.triggerRenderServiceRestart(service_id);
      return res.json({
        success: restart.success,
        action: 'restart_render_services',
        message: restart.message,
        timestamp: new Date().toISOString()
      });
    }

    if (action_type === 'sync_and_deploy_iptv') {
      const dbUrl = adminVault.getRawKey('DATABASE_URL') || process.env.DATABASE_URL || '';
      const jwtSecret = adminVault.getRawKey('JWT_SECRET') || process.env.JWT_SECRET || '';
      const result = await adminVault.syncIptvRemediation(dbUrl, jwtSecret);
      return res.json({
        success: result.success,
        action: 'sync_and_deploy_iptv',
        message: result.success ? 'Successfully synced credentials and triggered deploy on Render' : 'Sync encountered issues',
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }

    if (action_type === 'test_neon_pool') {
      const probe = await adminVault.testIntegration('DATABASE_URL');
      return res.json({
        success: probe.success,
        action: 'test_neon_pool',
        message: probe.message,
        timestamp: new Date().toISOString()
      });
    }

    if (action_type === 'run_polsia_cycle') {
      const cycle = await autonomousEngine.runAutonomousCycle();
      return res.json({
        success: true,
        action: 'run_polsia_cycle',
        message: `Polsia ReAct Cycle complete: Executed ${cycle.executedCount} task(s)`,
        messages: cycle.messages,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ error: `Unknown action_type: ${action_type}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Action: Push Telegram Alert or Digest
app.post('/api/admin/actions/push-telegram', async (req, res) => {
  try {
    const text = req.body.text || '🔔 Test ping from MyIAD & AB Global Command Center';
    const result = await adminVault.pushTelegramDigest(text);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Action: Create GitHub Pull Request
app.post('/api/admin/actions/create-pr', async (req, res) => {
  try {
    const { branch, title, body, filePath, fileContent } = req.body;
    const result = await adminVault.createGitHubPR({
      branch: branch || `agent/patch-${Date.now().toString(36)}`,
      title: title || 'Autonomous Code Update',
      body: body || 'Generated autonomously by MyIAD Command Center',
      filePath: filePath || 'llms.txt',
      fileContent: fileContent || '# LLMs.txt for MyIAD Ecosystem\n'
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Action: SendPut Autonomous Prospect Audit
app.post('/api/admin/actions/audit-prospect', async (req, res) => {
  try {
    const { businessName, websiteUrl } = req.body;
    if (!businessName || !websiteUrl) {
      return res.status(400).json({ error: 'businessName and websiteUrl required' });
    }
    const result = await adminVault.generateSendputAuditProposal(businessName, websiteUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- STATIC ASSETS & SPA ROUTING (CACHE-BUSTED) ---
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '../public'), { etag: false, maxAge: 0 }));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize DB and start server
initDbPool().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MyIAD Command Center, Polsia Engine & Admin Vault listening on 0.0.0.0:${PORT}`);

    // --- 24/7 AUTONOMOUS OPERATOR LOOP (HEARTBEAT EVERY 60s) ---
    let isRunningCycle = false;
    setInterval(async () => {
      if (isRunningCycle) return;
      isRunningCycle = true;
      try {
        const cycle = await autonomousEngine.runAutonomousCycle();
        if (cycle.executedCount > 0) {
          console.log(`[Autonomous Heartbeat] Executed ${cycle.executedCount} autonomous God Mode tasks:`, cycle.messages);
        }
      } catch (err: any) {
        console.warn('[Autonomous Heartbeat Error]:', err.message);
      } finally {
        isRunningCycle = false;
      }
    }, 60000);

    // --- SCHEDULED 8:00 AM MORNING BRIEFING TIMER ---
    let lastRecapDate = '';
    setInterval(async () => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const hour = now.getHours();
      if (hour === 8 && lastRecapDate !== dateStr) {
        lastRecapDate = dateStr;
        try {
          console.log('[Autonomous Engine] Compiling scheduled 8:00 AM Morning Briefing...');
          await autonomousEngine.generateDailyRecap();
        } catch (e: any) {
          console.warn('[Scheduled Briefing Error]:', e.message);
        }
      }
    }, 300000); // Check every 5 minutes
  });
});

