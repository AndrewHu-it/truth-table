import { pool } from "@/lib/db";
import { B_STATIC, yesPrice } from "@/lib/lmsr";

export async function GET() {
  const r = await pool.query(
    `SELECT m.id, m.question, m.b, m.q_yes, m.q_no, m.created_at, m.image,
            COALESCE(v.volume, 0) AS volume
     FROM markets m
     LEFT JOIN (
       SELECT market_id, SUM(cost) AS volume
       FROM trades
       GROUP BY market_id
     ) v ON v.market_id = m.id
     ORDER BY m.created_at DESC`
  );

  const markets = r.rows.map((m: any) => ({
    ...m,
    p_yes: yesPrice(m.q_yes, m.q_no, m.b),
    volume: Number(m.volume ?? 0),
  }));

  return Response.json({ markets });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim();
  const image = String(body.image ?? "").trim();

  if (!question) {
    return Response.json({ error: "question required" }, { status: 400 });
  }
  if (question.length > 120) {
    return Response.json({ error: "question too long" }, { status: 400 });
  }
  if (image && image.length > 500) {
    return Response.json({ error: "image URL too long" }, { status: 400 });
  }

  // ⚠️ CHANGED: do market insert + initial snapshot in one transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `INSERT INTO markets (question, b, image)
       VALUES ($1, $2, $3)
       RETURNING id, question, b, q_yes, q_no, created_at, image`,
      [question, B_STATIC, image || null]
    );

    const m = r.rows[0];
    const p = yesPrice(m.q_yes, m.q_no, m.b);

    // ⚠️ CHANGED: initial snapshot so the chart has a starting point
    await client.query(
      `INSERT INTO market_snapshots (market_id, q_yes, q_no, p_yes)
       VALUES ($1, $2, $3, $4)`,
      [m.id, m.q_yes, m.q_no, p]
    );

    await client.query("COMMIT");

    return Response.json({
      market: { ...m, p_yes: p },
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return Response.json({ error: e?.message ?? "create market failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
