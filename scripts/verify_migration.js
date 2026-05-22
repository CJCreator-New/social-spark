#!/usr/bin/env node
import { Client } from 'pg';
import path from 'path';
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Set DATABASE_URL (Postgres) environment variable to your Supabase DB URL.');
  process.exit(2);
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // Check table exists
    const res = await client.query(`select to_regclass('public.regenerate_feedback') as tbl`);
    if (!res.rows[0].tbl) {
      console.error('regenerate_feedback table not found');
      process.exit(1);
    }
    console.log('regenerate_feedback table exists');

    // Insert a sample row and delete it
    const insert = await client.query(
      `insert into public.regenerate_feedback (user_id, calendar_id, day, dow, platform, category, rating, feedback, tweak)
       values (null, null, 1, 'Mon', 'LinkedIn', 'example', 5, 'test feedback', 'tweak') returning id`);
    const id = insert.rows[0].id;
    console.log('Inserted test feedback id=', id);
    const del = await client.query('delete from public.regenerate_feedback where id = $1', [id]);
    console.log('Deleted test feedback');
    console.log('Migration verification succeeded');
  } catch (err) {
    console.error('Verification failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
