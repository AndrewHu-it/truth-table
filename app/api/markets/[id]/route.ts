import { pool } from "@/lib/db";
import { yesPrice } from "@/lib/lmsr";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // ⚠️ CHANGED: params is a Promise in Next 15+
) {
  const { id } = await ctx.params; // ⚠️ CHANGED: unwrap params with await

  const r = await pool.query(
    `SELECT m.id, m.question, m.b, m.q_yes, m.q_no, m.created_at, m.image,
            COALESCE(v.volume, 0) AS volume
     FROM markets m
     LEFT JOIN (
       SELECT market_id, SUM(cost) AS volume
       FROM trades
       GROUP BY market_id
     ) v ON v.market_id = m.id
     WHERE m.id = $1`,
    [id]
  );

  if (r.rowCount === 0) {
    return Response.json({ error: "market not found", id }, { status: 404 }); // ⚠️ CHANGED: echo id
  }

  const m = r.rows[0];
  return Response.json({
    market: { ...m, p_yes: yesPrice(m.q_yes, m.q_no, m.b) },
  });
}
