import pool from './database';

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS messages CASCADE');
    await client.query('DROP TABLE IF EXISTS connections CASCADE');
    await client.query('DROP TABLE IF EXISTS user_vibes CASCADE');
    await client.query('DROP TABLE IF EXISTS user_skills CASCADE');
    await client.query('DROP TABLE IF EXISTS vibes CASCADE');
    await client.query('DROP TABLE IF EXISTS skills CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS _migrations CASCADE');
    
    console.log('Database reset successfully');
  } catch (error) {
    console.error('Reset failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
