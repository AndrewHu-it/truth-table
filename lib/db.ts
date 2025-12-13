import { Pool } from "pg";

// ⚠️ CHANGED: one pool for the whole server runtime
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
