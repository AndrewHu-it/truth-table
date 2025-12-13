import { pool } from "@/lib/db";

function lmsrCost(qYes: number, qNo: number, b: number) {
  return b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b));
}

function yesPrice(qYes: number, qNo: number, b: number) {
  const eY = Math.exp(qYes / b);
  const eN = Math.exp(qNo / b);
  return eY / (eY + eN);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15+: params is a Promise
) {
  const { id: marketId } = await ctx.params; // ⚠️ CHANGED: unwrap params

  const body = await req.json().catch(() => ({}));
  const side = String(body.side ?? "").toUpperCase();
  const shares = Number(body.shares ?? 0);
  const who = String(body.who ?? "demo");

  if (side !== "YES" && side !== "NO") {
    return Response.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return Response.json({ error: "shares must be > 0" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ CHANGED: lock the row so concurrent trades don't race
    const mRes = await client.query(
      `SELECT id, b, q_yes, q_no
       FROM markets
       WHERE id = $1
       FOR UPDATE`,
      [marketId]
    );

    if (mRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "market not found" }, { status: 404 });
    }

    const m = mRes.rows[0];
    const b = Number(m.b);
    const qYesOld = Number(m.q_yes);
    const qNoOld = Number(m.q_no);

    const oldC = lmsrCost(qYesOld, qNoOld, b);

    const qYesNew = side === "YES" ? qYesOld + shares : qYesOld;
    const qNoNew  = side === "NO"  ? qNoOld + shares  : qNoOld;

    const newC = lmsrCost(qYesNew, qNoNew, b);
    const cost = newC - oldC;

    const pYesNew = yesPrice(qYesNew, qNoNew, b); // ⚠️ CHANGED: compute once, use for snapshot + response

    // trade log (immutable)
    const tRes = await client.query(
      `INSERT INTO trades (market_id, who, side, shares, cost)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [marketId, who, side, shares, cost]
    );

    // update live market snapshot
    await client.query(
      `UPDATE markets
       SET q_yes = $2, q_no = $3
       WHERE id = $1`,
      [marketId, qYesNew, qNoNew]
    );

    // ⚠️ CHANGED: write a snapshot point for the graph (same transaction!)
    await client.query(
      `INSERT INTO market_snapshots (market_id, q_yes, q_no, p_yes)
       VALUES ($1, $2, $3, $4)`,
      [marketId, qYesNew, qNoNew, pYesNew]
    );

    await client.query("COMMIT");

    return Response.json({
      trade: {
        id: tRes.rows[0].id,
        created_at: tRes.rows[0].created_at,
        who,
        side,
        shares,
        cost,
      },
      market: {
        id: marketId,
        b,
        q_yes: qYesNew,
        q_no: qNoNew,
        p_yes: pYesNew,
      },
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return Response.json({ error: e?.message ?? "trade failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
