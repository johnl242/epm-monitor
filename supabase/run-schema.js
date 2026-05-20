/**
 * EPM Commercial - Database Schema Installer
 * Runs the schema.sql against your Supabase PostgreSQL database
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Supabase connection settings
const client = new Client({
  host: 'db.fcfezhoaxqroubphzzfz.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'YOUR_SUPABASE_SERVICE_KEY',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runSchema() {
  console.log('🔌 Connecting to Supabase PostgreSQL...');

  try {
    await client.connect();
    console.log('✅ Connected to Supabase!');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Running schema SQL...');
    console.log('This may take a few seconds...\n');

    // Execute schema (Supabase manages RLS, so we execute as-is)
    await client.query(schemaSql);

    console.log('\n✅ Schema installed successfully!');
    console.log('\n📋 Tables created:');
    console.log('   - companies');
    console.log('   - users');
    console.log('   - licenses');
    console.log('   - computers');
    console.log('   - employees');
    console.log('   - activity_logs');
    console.log('   - daily_stats');
    console.log('   - idle_logs');
    console.log('   - productivity_rules');
    console.log('   - audit_logs');
    console.log('   - api_keys');
    console.log('\n🔒 Row Level Security (RLS) policies enabled');
    console.log('\n🎉 Your EPM database is ready!');

  } catch (error) {
    console.error('❌ Error installing schema:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n💡 Note: Some tables already exist. This is OK - the schema uses IF NOT EXISTS.');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

runSchema();