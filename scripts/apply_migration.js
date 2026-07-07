#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { Client } from "pg";

const MIGRATION = path.resolve(
  process.cwd(),
  "supabase",
  "migrations",
  "20260521120000_create_regenerate_feedback.sql"
);
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Set DATABASE_URL (Postgres) environment variable to your Supabase DB URL.");
  process.exit(2);
}

async function run() {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log("Applying migration:", MIGRATION);
    await client.query(sql);
    console.log("Migration applied successfully");
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
