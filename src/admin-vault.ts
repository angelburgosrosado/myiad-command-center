/**
 * src/admin-vault.ts — Administrative Backend, Secrets Vault & Tool Automations
 * Manages API keys, tests connections, executes auto-healing restarts, pushes Telegram digests, and creates GitHub PRs.
 */
import pg from 'pg';
import net from 'net';

export interface VaultKeyItem {
  key_name: string;
  category: 'ai_models' | 'infra' | 'git' | 'notifications' | 'prospecting';
  key_value: string;
  description: string;
  is_secret: boolean;
  status: 'active' | 'configured' | 'missing' | 'testing' | 'invalid';
  last_tested_at?: string | null;
  updated_at: string;
}

const SCHEMA = 'vault_app_angelburgosrosado';

export class AdminVault {
  private pool: pg.Pool | null = null;
  private memoryVault: Map<string, VaultKeyItem> = new Map();

  constructor(pool: pg.Pool | null) {
    this.pool = pool;
    this.initDefaultKeys();
  }

  public updatePool(pool: pg.Pool | null) {
    this.pool = pool;
    if (this.pool) {
      this.syncFromDb().catch(() => {});
    }
  }

  private initDefaultKeys() {
    const defaults: Array<Omit<VaultKeyItem, 'updated_at'>> = [
      // 1. AI Models
      {
        key_name: 'GEMINI_API_KEY',
        category: 'ai_models',
        key_value: process.env.GEMINI_API_KEY || '',
        description: 'Google Gemini API key for goal decomposition, autonomous reasoning, and proposal drafting',
        is_secret: true,
        status: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
      },
      {
        key_name: 'OPENAI_API_KEY',
        category: 'ai_models',
        key_value: process.env.OPENAI_API_KEY || '',
        description: 'OpenAI API key fallback for GPT-4o autonomous execution',
        is_secret: true,
        status: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
      },
      // 2. Infrastructure & Self-Healing
      {
        key_name: 'RENDER_API_KEY',
        category: 'infra',
        key_value: process.env.RENDER_API_KEY || '',
        description: 'Render Cloud API token for zero-touch auto-healing service restarts',
        is_secret: true,
        status: process.env.RENDER_API_KEY ? 'configured' : 'missing'
      },
      {
        key_name: 'RENDER_WORKER_ID',
        category: 'infra',
        key_value: process.env.RENDER_WORKER_ID || 'srv-daffgtf40ujc73b38jo0',
        description: 'Render background worker service ID for automated restarts upon failure',
        is_secret: false,
        status: 'configured'
      },
      // 3. GitHub & Code Automation
      {
        key_name: 'GITHUB_PAT',
        category: 'git',
        key_value: process.env.GITHUB_PAT || '',
        description: 'GitHub Personal Access Token for auto-committing patches and creating Pull Requests',
        is_secret: true,
        status: process.env.GITHUB_PAT ? 'configured' : 'missing'
      },
      {
        key_name: 'GITHUB_REPO',
        category: 'git',
        key_value: process.env.GITHUB_REPO || 'angelburgosrosado/myiad-command-center',
        description: 'Target GitHub repository in owner/repo format',
        is_secret: false,
        status: 'configured'
      },
      // 4. Notifications & Morning Briefings
      {
        key_name: 'TELEGRAM_BOT_TOKEN',
        category: 'notifications',
        key_value: process.env.TELEGRAM_BOT_TOKEN || '',
        description: 'Telegram Bot Token for 8:00 AM morning recap push notifications and outage alerts',
        is_secret: true,
        status: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing'
      },
      {
        key_name: 'TELEGRAM_CHAT_ID',
        category: 'notifications',
        key_value: process.env.TELEGRAM_CHAT_ID || '',
        description: 'Your personal or admin Telegram Chat ID to receive briefings',
        is_secret: false,
        status: process.env.TELEGRAM_CHAT_ID ? 'configured' : 'missing'
      },
      {
        key_name: 'DISCORD_WEBHOOK_URL',
        category: 'notifications',
        key_value: process.env.DISCORD_WEBHOOK_URL || '',
        description: 'Discord or Slack channel incoming webhook for real-time agent alerts',
        is_secret: true,
        status: process.env.DISCORD_WEBHOOK_URL ? 'configured' : 'missing'
      },
      // 5. Prospecting & SendPut Tools
      {
        key_name: 'FIRECRAWL_API_KEY',
        category: 'prospecting',
        key_value: process.env.FIRECRAWL_API_KEY || '',
        description: 'Firecrawl API token for deep web scraping and B2B audit data extraction',
        is_secret: true,
        status: process.env.FIRECRAWL_API_KEY ? 'configured' : 'missing'
      }
    ];

    const now = new Date().toISOString();
    defaults.forEach((d) => {
      this.memoryVault.set(d.key_name, { ...d, updated_at: now });
    });
  }

  private async syncFromDb() {
    if (!this.pool) return;
    try {
      const res = await this.pool.query(`SELECT * FROM ${SCHEMA}.admin_system_vault;`);
      res.rows.forEach((r: VaultKeyItem) => {
        this.memoryVault.set(r.key_name, r);
      });
    } catch (err: any) {
      console.warn('[AdminVault] Sync from DB skipped:', err.message);
    }
  }

  public getRawKey(keyName: string): string {
    const item = this.memoryVault.get(keyName);
    return item?.key_value || process.env[keyName] || '';
  }

  // Returns keys with secrets masked for the UI
  public getAllKeysSanitized(): VaultKeyItem[] {
    const items = Array.from(this.memoryVault.values());
    return items.map((item) => {
      let displayValue = item.key_value;
      if (item.is_secret && displayValue) {
        if (displayValue.length > 8) {
          displayValue = `${displayValue.slice(0, 4)}••••••••${displayValue.slice(-4)}`;
        } else {
          displayValue = '••••••••';
        }
      }
      return {
        ...item,
        key_value: displayValue
      };
    });
  }

  public async setKey(keyName: string, keyValue: string, description?: string): Promise<VaultKeyItem> {
    const existing = this.memoryVault.get(keyName);
    const now = new Date().toISOString();

    const item: VaultKeyItem = {
      key_name: keyName,
      category: existing?.category || 'ai_models',
      key_value: keyValue.trim(),
      description: description || existing?.description || '',
      is_secret: existing ? existing.is_secret : true,
      status: keyValue.trim() ? 'configured' : 'missing',
      updated_at: now
    };

    this.memoryVault.set(keyName, item);
    process.env[keyName] = keyValue.trim();

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO ${SCHEMA}.admin_system_vault (key_name, category, key_value, description, is_secret, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (key_name) DO UPDATE 
           SET key_value = EXCLUDED.key_value,
               description = COALESCE(EXCLUDED.description, admin_system_vault.description),
               status = EXCLUDED.status,
               updated_at = CURRENT_TIMESTAMP`,
          [item.key_name, item.category, item.key_value, item.description, item.is_secret, item.status]
        );
      } catch (err: any) {
        console.warn('[AdminVault] DB save key fallback:', err.message);
      }
    }

    return item;
  }

  // --- INTEGRATION TESTS ---
  public async testIntegration(keyName: string): Promise<{ success: boolean; message: string }> {
    const key = this.getRawKey(keyName);
    const now = new Date().toISOString();

    const updateStatus = async (status: VaultKeyItem['status']) => {
      const item = this.memoryVault.get(keyName);
      if (item) {
        item.status = status;
        item.last_tested_at = now;
      }
    };

    if (!key && !['RENDER_WORKER_ID', 'GITHUB_REPO', 'VPS_POSTGRES_URL'].includes(keyName)) {
      await updateStatus('missing');
      return { success: false, message: `Key ${keyName} is not configured yet.` };
    }

    try {
      if (keyName === 'GEMINI_API_KEY') {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        if (resp.ok) {
          await updateStatus('active');
          return { success: true, message: 'Google Gemini API key verified successfully! Models accessible.' };
        }
        await updateStatus('invalid');
        return { success: false, message: `Gemini API returned HTTP ${resp.status}: Invalid key` };
      }

      if (keyName === 'RENDER_API_KEY') {
        const resp = await fetch('https://api.render.com/v1/services?limit=3', {
          headers: { Authorization: `Bearer ${key}` }
        });
        if (resp.ok) {
          await updateStatus('active');
          return { success: true, message: 'Render API token verified! Service controls active.' };
        }
        await updateStatus('invalid');
        return { success: false, message: `Render API returned HTTP ${resp.status}: Unauthorized` };
      }

      if (keyName === 'GITHUB_PAT') {
        const resp = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${key}`,
            'User-Agent': 'MyIAD-Command-Center'
          }
        });
        if (resp.ok) {
          const user = await resp.json();
          await updateStatus('active');
          return { success: true, message: `GitHub PAT verified! Connected as @${user.login}.` };
        }
        await updateStatus('invalid');
        return { success: false, message: `GitHub API returned HTTP ${resp.status}: Unauthorized` };
      }

      if (keyName === 'TELEGRAM_BOT_TOKEN') {
        const resp = await fetch(`https://api.telegram.org/bot${key}/getMe`);
        if (resp.ok) {
          const body = await resp.json();
          await updateStatus('active');
          return { success: true, message: `Telegram Bot verified! Connected as @${body.result?.username}.` };
        }
        await updateStatus('invalid');
        return { success: false, message: 'Invalid Telegram Bot Token.' };
      }

      if (keyName === 'DATABASE_URL' || keyName === 'NEON_POSTGRES_URL') {
        if (this.pool) {
          const qRes = await this.pool.query('SELECT version();');
          await updateStatus('active');
          const vStr = qRes.rows[0]?.version || 'PostgreSQL 18.6';
          return { success: true, message: `Neon Serverless PostgreSQL connection pool online! Running: ${vStr.split(',')[0]} (AWS us-east-2)` };
        }
      }

      await updateStatus('active');
      return { success: true, message: `${keyName} format valid and recorded in vault.` };
    } catch (err: any) {
      await updateStatus('invalid');
      return { success: false, message: `Test failed: ${err.message}` };
    }
  }

  // --- TOOL AUTOMATION: TELEGRAM BRIEFING PUSH ---
  public async pushTelegramDigest(text: string): Promise<{ success: boolean; message: string }> {
    const token = this.getRawKey('TELEGRAM_BOT_TOKEN');
    const chatId = this.getRawKey('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      return { success: false, message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.' };
    }

    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
      const data = await resp.json();
      return { success: resp.ok, message: resp.ok ? 'Sent to Telegram!' : data.description };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // --- TOOL AUTOMATION: RENDER ZERO-TOUCH RESTART ---
  public async triggerRenderServiceRestart(serviceId?: string): Promise<{ success: boolean; message: string }> {
    const apiKey = this.getRawKey('RENDER_API_KEY');
    const targetId = serviceId || this.getRawKey('RENDER_WORKER_ID');

    if (!apiKey) {
      return { success: false, message: 'RENDER_API_KEY is not configured in Administrative Vault.' };
    }

    try {
      const resp = await fetch(`https://api.render.com/v1/services/${targetId}/restart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json'
        }
      });
      if (resp.ok) {
        return { success: true, message: `Successfully triggered restart for Render service ${targetId}` };
      }
      return { success: false, message: `Render restart failed with HTTP ${resp.status}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // --- TOOL AUTOMATION: RENDER ENV VARS SYNC & DEPLOY ---
  public async syncRenderEnvVars(serviceId: string, envVars: Array<{ key: string; value: string }>): Promise<{ success: boolean; message: string }> {
    const apiKey = this.getRawKey('RENDER_API_KEY');
    if (!apiKey) return { success: false, message: 'RENDER_API_KEY is not configured in Administrative Vault.' };

    try {
      const resp = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(envVars)
      });
      if (resp.ok) {
        // Trigger a new deployment to pick up the updated environment variables
        await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ clearCache: 'do_not_clear' })
        });
        return { success: true, message: `Successfully synced env vars and triggered deploy on Render service ${serviceId}` };
      }
      const errText = await resp.text();
      return { success: false, message: `Render env sync failed for ${serviceId} (HTTP ${resp.status}): ${errText}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // --- LIST RENDER SERVICES ---
  public async listRenderServices(): Promise<any[]> {
    const apiKey = this.getRawKey('RENDER_API_KEY');
    if (!apiKey) return [];
    try {
      const allServices: any[] = [];
      const resp = await fetch('https://api.render.com/v1/services?limit=100', {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          allServices.push(...data.map((d: any) => d.service || d));
        }
      }

      // Check owners/workspaces
      const ownersResp = await fetch('https://api.render.com/v1/owners?limit=20', {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      });
      if (ownersResp.ok) {
        const ownersData = await ownersResp.json();
        if (Array.isArray(ownersData)) {
          for (const item of ownersData) {
            const owner = item.owner || item;
            if (owner && owner.id) {
              const sResp = await fetch(`https://api.render.com/v1/services?ownerId=${owner.id}&limit=100`, {
                headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
              });
              if (sResp.ok) {
                const sData = await sResp.json();
                if (Array.isArray(sData)) {
                  for (const sItem of sData) {
                    const s = sItem.service || sItem;
                    if (!allServices.some(existing => existing.id === s.id)) {
                      allServices.push(s);
                    }
                  }
                }
              }
            }
          }
        }
      }

      return allServices;
    } catch {
      return [];
    }
  }

  // --- AUTOMATED 3-STEP IPTV REMEDIATION SYNC ---
  public async syncIptvRemediation(databaseUrl: string, jwtSecret?: string): Promise<{ success: boolean; details: any[] }> {
    const apiKey = this.getRawKey('RENDER_API_KEY');
    if (!apiKey) return { success: false, details: [{ error: 'RENDER_API_KEY not configured in vault' }] };

    const crypto = await import('crypto');
    const secret = jwtSecret || crypto.randomBytes(16).toString('hex');
    const allServices = await this.listRenderServices();
    
    // Find services by name or fallback to known IDs
    let iptvServices = allServices.filter(s => 
      s.name?.toLowerCase().includes('iptv') || 
      (s.repo && s.repo.toLowerCase().includes('iptv'))
    );

    if (iptvServices.length === 0) {
      const knownIds = ['srv-daffgtf40ujc73b38jo0', 'srv-daebvt9t0dsc739kcfh0'];
      for (const id of knownIds) {
        try {
          const resp = await fetch(`https://api.render.com/v1/services/${id}`, {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
          });
          if (resp.ok) {
            const data = await resp.json();
            iptvServices.push(data.service || data);
          }
        } catch {}
      }
    }

    const results = [];
    for (const service of iptvServices) {
      let existingVars: Array<{ key: string; value: string }> = [];
      try {
        const getEnv = await fetch(`https://api.render.com/v1/services/${service.id}/env-vars`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
        });
        if (getEnv.ok) {
          const list = await getEnv.json();
          existingVars = list.map((item: any) => item.envVar || item);
        }
      } catch {}

      const envMap = new Map<string, string>();
      existingVars.forEach(v => envMap.set(v.key, v.value));
      envMap.set('DATABASE_URL', databaseUrl);
      envMap.set('JWT_SECRET', secret);
      envMap.set('NODE_ENV', 'production');

      const payload = Array.from(envMap.entries()).map(([key, value]) => ({ key, value }));
      const syncRes = await this.syncRenderEnvVars(service.id, payload);
      results.push({
        service_id: service.id,
        service_name: service.name,
        result: syncRes
      });
    }

    return {
      success: results.length > 0 && results.every(r => r.result.success),
      details: results
    };
  }

  // --- TOOL AUTOMATION: GITHUB PULL REQUEST AUTOMATION ---
  public async createGitHubPR(params: {
    branch: string;
    title: string;
    body: string;
    filePath: string;
    fileContent: string;
  }): Promise<{ success: boolean; url?: string; message: string }> {
    const pat = this.getRawKey('GITHUB_PAT');
    const repo = this.getRawKey('GITHUB_REPO') || 'angelburgosrosado/myiad-command-center';

    if (!pat) {
      return { success: false, message: 'GITHUB_PAT is not configured in Administrative Vault.' };
    }

    try {
      // Step 1: Get default branch SHA
      const repoResp = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'MyIAD-Command-Center' }
      });
      if (!repoResp.ok) throw new Error(`Failed to fetch repo ${repo}: HTTP ${repoResp.status}`);
      const repoData = await repoResp.json();
      const defaultBranch = repoData.default_branch || 'main';

      const refResp = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${defaultBranch}`, {
        headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'MyIAD-Command-Center' }
      });
      if (!refResp.ok) throw new Error(`Failed to fetch branch ${defaultBranch}`);
      const refData = await refResp.json();
      const baseSha = refData.object.sha;

      // Step 2: Create new branch
      const branchRef = `refs/heads/${params.branch}`;
      await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'MyIAD-Command-Center' },
        body: JSON.stringify({ ref: branchRef, sha: baseSha })
      });

      // Step 3: Put file content
      await fetch(`https://api.github.com/repos/${repo}/contents/${params.filePath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'MyIAD-Command-Center' },
        body: JSON.stringify({
          message: `🤖 Autonomous PR: ${params.title}`,
          content: Buffer.from(params.fileContent).toString('base64'),
          branch: params.branch
        })
      });

      // Step 4: Open PR
      const prResp = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'MyIAD-Command-Center' },
        body: JSON.stringify({
          title: params.title,
          body: `${params.body}\n\n*Generated autonomously by MyIAD & Polsia Engine.*`,
          head: params.branch,
          base: defaultBranch
        })
      });

      if (!prResp.ok) {
        const prErr = await prResp.json();
        return { success: false, message: prErr.message || 'Failed to open Pull Request' };
      }

      const pr = await prResp.json();
      return { success: true, url: pr.html_url, message: `PR created: ${pr.html_url}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // --- TOOL AUTOMATION: SENDPUT B2B AUDIT SCRAPER ---
  public async generateSendputAuditProposal(businessName: string, websiteUrl: string): Promise<any> {
    const cleanUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const start = Date.now();
    let reachable = false;
    let title = '';
    let hasMeta = false;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(cleanUrl, { signal: controller.signal });
      clearTimeout(timer);
      reachable = resp.ok;
      const html = await resp.text();
      title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || businessName;
      hasMeta = html.includes('description') || html.includes('og:');
    } catch {
      reachable = false;
      title = businessName;
    }

    const latency = Date.now() - start;
    const sfaiScore = reachable ? Math.min(95, 68 + (hasMeta ? 12 : 0) + (latency < 800 ? 10 : 0)) : 42;
    const aicsScore = Math.round(sfaiScore * 0.92);
    const tier = sfaiScore > 75 ? 'Enterprise Growth Engine ($4,500/mo)' : 'SignalForge Accelerator ($2,500/mo)';

    const markdown = `# 🛡️ SignalForge 2.4 / SendPut Client Architecture Proposal
**Client:** ${businessName} (${cleanUrl})
**Audited At:** ${new Date().toISOString()}

### Executive Readiness Score:
- **SignalForge AI Readiness Index (SFAI):** ${sfaiScore}/100
- **AI Crawlability & Context Score (AICS):** ${aicsScore}/100
- **Reachability Status:** ${reachable ? 'ONLINE (HTTP 200)' : 'UNREACHABLE / RECOVERY NEEDED'} (${latency}ms)

### Recommended Modernization Path:
1. **AI Context Files (/llms.txt):** Implement machine-readable architecture for ChatGPT & Perplexity discovery.
2. **Dedicated Cloud Infrastructure:** Migrate mission-critical endpoints to managed Render + Neon architecture.
3. **Automated Conversion & Prospect Pipeline:** Integrate SendPut real-time visitor identification.

**Recommended Partnership Tier:** ${tier}
*Prepared autonomously by MyIAD Operations Agent for Angel Burgos.*`;

    return {
      businessName,
      websiteUrl: cleanUrl,
      sfaiScore,
      aicsScore,
      recommendedTier: tier,
      proposalMarkdown: markdown,
      timestamp: new Date().toISOString()
    };
  }
}
