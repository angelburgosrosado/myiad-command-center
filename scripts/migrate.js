/**
 * scripts/migrate.js — Native Node/PG migration runner
 * Runs sql/schema.sql without requiring the external `psql` binary.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  const connStr = (process.env.DATABASE_URL || process.env.VPS_POSTGRES_URL || '').replace(/['"]/g, '').trim();
  if (!connStr || connStr.includes('placeholder')) {
    console.error('❌ Error: No valid DATABASE_URL or VPS_POSTGRES_URL provided.');
    process.exit(1);
  }

  console.log('🔄 Connecting to PostgreSQL...');
  const client = new Client({
    connectionString: connStr,
    ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully.');

    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing sql/schema.sql...');
    await client.query(sql);

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'vault_app_angelburgosrosado'
      ORDER BY table_name;
    `);

    console.log('✅ Migration complete. Tables verified in vault_app_angelburgosrosado:');
    res.rows.forEach(r => console.log(`   • ${r.table_name}`));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
