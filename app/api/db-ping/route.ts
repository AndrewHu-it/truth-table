import { Pool } from "pg";

// ⚠️ CHANGED: reads the env var you set in Vercel/.env.local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const r = await pool.query("SELECT 1 as ok;");
  return Response.json({ ok: r.rows[0].ok === 1 });
}
