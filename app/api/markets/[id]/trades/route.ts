import { pool } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await ctx.params;

  const r = await pool.query(
    `SELECT id, who, side, shares, cost, created_at
     FROM trades
     WHERE market_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [marketId]
  );

  const trades = r.rows.map((t: any) => ({
    ...t,
    // pg numeric can arrive as string; ensure number for the client
    cost: Number(t.cost),
    shares: Number(t.shares),
  }));

  return Response.json({ trades });
}
