import { pool } from "@/lib/db";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await ctx.params;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 5000);

  // grab most recent points, then reverse so chart goes left->right in time
  const r = await pool.query(
    `SELECT t, p_yes
     FROM market_snapshots
     WHERE market_id = $1
     ORDER BY t DESC
     LIMIT $2`,
    [marketId, limit]
  );

  const points = r.rows.reverse();
  return Response.json({ points });
}
