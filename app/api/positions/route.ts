import { auth } from "@clerk/nextjs/server";
import { pool } from "@/lib/db";
import { yesPrice } from "@/lib/lmsr";

type TradeRow = {
  id: string;
  market_id: string;
  question: string;
  side: "YES" | "NO";
  shares: number | string;
  cost: number | string;
  created_at: string;
  b: number;
  q_yes: number;
  q_no: number;
};

const RANGE_TO_INTERVAL: Record<string, string> = {
  "1D": "1 day",
  "1W": "7 days",
  "1M": "1 month",
};

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") ?? "ALL").toUpperCase();
    const interval = RANGE_TO_INTERVAL[range];

    const params: any[] = [userId];
    let timeClause = "";
    if (interval) {
      params.push(interval);
      timeClause = `AND t.created_at >= NOW() - ($2 :: interval)`;
    }

    const r = await client.query(
      `
      SELECT t.id, t.market_id, t.side, t.shares, t.cost, t.created_at,
             m.question, m.b, m.q_yes, m.q_no
      FROM trades t
      JOIN markets m ON t.market_id = m.id
      WHERE t.who = $1
        ${timeClause}
      ORDER BY t.created_at DESC
      `,
      params
    );

  const trades = r.rows.map((t: TradeRow) => {
    const b = Number(t.b);
    const qYes = Number(t.q_yes);
    const qNo = Number(t.q_no);
    const pYes = yesPrice(qYes, qNo, b);
    const priceNow = t.side === "YES" ? pYes : 1 - pYes;
    const shares = Number(t.shares);
    const cost = Number(t.cost);
    const value = shares * priceNow;
    const pnl = value - cost;
    const pct = cost > 0 ? pnl / cost : 0;

    return {
      id: t.id,
      market_id: t.market_id,
      question: t.question,
      side: t.side,
      shares,
      cost,
      created_at: t.created_at,
      price_now: priceNow,
      value,
      pnl,
      pct,
    };
  });

  // Aggregate positions per market
  const posMap = new Map<string, any>();
  for (const t of trades) {
    const key = t.market_id;
    const existing = posMap.get(key) ?? {
      market_id: t.market_id,
      question: t.question,
      shares_yes: 0,
      shares_no: 0,
      cost: 0,
      price_yes: t.side === "YES" ? t.price_now : 1 - t.price_now,
    };

    if (t.side === "YES") {
      existing.shares_yes += t.shares;
    } else {
      existing.shares_no += t.shares;
    }
    existing.cost += t.cost;
    existing.price_yes = t.side === "YES" ? t.price_now : existing.price_yes;

    posMap.set(key, existing);
  }

  const positions = Array.from(posMap.values()).map((p) => {
    const priceYes = p.price_yes;
    const priceNo = 1 - priceYes;
    const value = p.shares_yes * priceYes + p.shares_no * priceNo;
    const pnl = value - p.cost;
    const pct = p.cost > 0 ? pnl / p.cost : 0;
    return { ...p, value, pnl, pct };
  });

  // PnL over time (step series using current prices)
  const points: { t: string; pnl: number }[] = [];
  const tradesAsc = [...trades].reverse();
  let totalCost = 0;
  const holdings = new Map<string, { yes: number; no: number; priceYes: number }>();

  for (const t of tradesAsc) {
    const m = holdings.get(t.market_id) ?? { yes: 0, no: 0, priceYes: t.side === "YES" ? t.price_now : 1 - t.price_now };
    if (t.side === "YES") {
      m.yes += t.shares;
      m.priceYes = t.price_now;
    } else {
      m.no += t.shares;
      if (m.priceYes === undefined) {
        m.priceYes = 1 - t.price_now;
      }
    }
    holdings.set(t.market_id, m);
    totalCost += t.cost;

    let mark = 0;
    for (const h of holdings.values()) {
      const pYes = h.priceYes;
      const pNo = 1 - pYes;
      mark += h.yes * pYes + h.no * pNo;
    }
    points.push({ t: t.created_at, pnl: mark - totalCost });
  }

  // latest totals
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

    const balRes = await client.query(
      `SELECT COALESCE(SUM(delta), 0) AS balance
       FROM ledger
       WHERE user_id = $1`,
      [userId]
    );
    const balance = Number(balRes.rows[0].balance);

    return Response.json({
      range,
      balance,
      trades,
      positions,
      pnl: {
        total: totalPnl,
        points,
      },
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
