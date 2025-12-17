import { auth } from "@clerk/nextjs/server";
import { pool } from "@/lib/db";
import { yesPrice } from "@/lib/lmsr";

type TradeRow = {
  market_id: string;
  side: "YES" | "NO";
  shares: number | string;
  cost: number | string;
  b: number;
  q_yes: number;
  q_no: number;
};

export async function GET() {
  const { userId } = await auth();
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

    await client.query("COMMIT");

    const r = await client.query(
      `
      SELECT t.market_id, t.side, t.shares, t.cost,
             m.b, m.q_yes, m.q_no
      FROM trades t
      JOIN markets m ON t.market_id = m.id
      WHERE t.who = $1
      `,
      [userId]
    );

    const posMap = new Map<string, { yes: number; no: number; cost: number; priceYes: number }>();
    for (const row of r.rows as TradeRow[]) {
      const b = Number(row.b);
      const qYes = Number(row.q_yes);
      const qNo = Number(row.q_no);
      const pYes = yesPrice(qYes, qNo, b);
      const key = row.market_id;
      const entry = posMap.get(key) ?? { yes: 0, no: 0, cost: 0, priceYes: pYes };
      const shares = Number(row.shares);
      const cost = Number(row.cost);
      if (row.side === "YES") {
        entry.yes += shares;
        entry.priceYes = pYes;
      } else {
        entry.no += shares;
        entry.priceYes = pYes;
      }
      entry.cost += cost;
      posMap.set(key, entry);
    }

    let portfolioValue = 0;
    for (const p of posMap.values()) {
      const pYes = p.priceYes;
      const pNo = 1 - pYes;
      portfolioValue += p.yes * pYes + p.no * pNo;
    }

    const balRes = await client.query(
      `SELECT COALESCE(SUM(delta), 0) AS balance
       FROM ledger
       WHERE user_id = $1`,
      [userId]
    );
    const balance = Number(balRes.rows[0].balance);

    return Response.json({ balance, portfolio_value: portfolioValue });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
