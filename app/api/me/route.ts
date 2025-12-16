import { auth } from "@clerk/nextjs/server";
import { pool } from "@/lib/db";

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const created = await client.query(
      `INSERT INTO profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id`,
      [userId]
    );

    if (created.rowCount === 1) {
      await client.query(
        `INSERT INTO ledger (user_id, delta, reason)
         VALUES ($1, $2, $3)`,
        [userId, 100, "signup_bonus"]
      );
    }

    const balRes = await client.query(
      `SELECT COALESCE(SUM(delta), 0) AS balance
       FROM ledger
       WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    const balance = Number(balRes.rows[0].balance);
    return Response.json({ userId, balance });
  } catch (e) {
    await client.query("ROLLBACK");
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
