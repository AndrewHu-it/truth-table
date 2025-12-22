import { pool } from "@/lib/db";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await ctx.params;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 5000);
  const range = (url.searchParams.get("range") ?? "ALL").toUpperCase();

  const ranges: Record<string, string> = {
    "1H": "1 hour",
    "6H": "6 hours",
    "1D": "1 day",
    "1W": "7 days",
    "1M": "1 month",
  };
  const interval = ranges[range];
  const params: any[] = [marketId];
  let where = "WHERE market_id = $1";
  if (interval) {
    params.push(interval);
    where += ` AND t >= NOW() - ($2 :: interval)`;
  }

  // grab most recent points, then reverse so chart goes left->right in time
  const r = await pool.query(
    `SELECT t, p_yes
     FROM market_snapshots
     ${where}
     ORDER BY t DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  const points = r.rows.reverse();
  return Response.json({ points });
}
