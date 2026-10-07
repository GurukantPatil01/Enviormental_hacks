import { pool } from './index.js';

async function checkDatabaseConnection() {
  console.log('🔍 Testing PostgreSQL connection...');
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT 
          version() AS pg_version,
          current_database() AS db_name,
          current_user AS db_user
      `);
      const { pg_version, db_name, db_user } = res.rows[0];

      console.log('✅ Successfully connected to database!');
      console.log(`   • Database: ${db_name}`);
      console.log(`   • User:     ${db_user}`);
      console.log(`   • Engine:   ${pg_version.split(' on ')[0]}`);

      // Count existing public tables
      const tablesRes = await client.query(`
        SELECT count(*)::int AS count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log(`   • Tables:   ${tablesRes.rows[0].count} in 'public' schema`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Database connection failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabaseConnection();
