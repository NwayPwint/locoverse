import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './database';

async function seed() {
  const client = await pool.connect();
  try {
    const seedPath = join(__dirname, '../../seeds/skills_vibes.sql');
    const seedSQL = readFileSync(seedPath, 'utf-8');
    
    await client.query(seedSQL);
    console.log('Seed data inserted successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
