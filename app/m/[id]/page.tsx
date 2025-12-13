"use client";

import { use, useEffect, useState } from "react"; // ⚠️ CHANGED: `use` unwraps params Promise in Next 15+

type Market = {
  id: string;
  question: string;
  b: number;
  q_yes: number;
  q_no: number;
  p_yes: number;
  created_at: string;
};

type Trade = {
  id: string;
  who: string;
  side: "YES" | "NO";
  shares: number;
  cost: number;
  created_at: string;
};

export default function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>; // ⚠️ CHANGED: params is a Promise
}) {
  const { id } = use(params); // ⚠️ CHANGED: unwrap params so id is NEVER undefined

  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [shares, setShares] = useState(5);
  const [err, setErr] = useState("");

  async function loadAll() {
    setErr("");

    const mRes = await fetch(`/api/markets/${id}`, { cache: "no-store" });
    const mData = await mRes.json();
    if (!mRes.ok) {
      setErr(mData.error ?? "market load failed");
      return;
    }
    setMarket(mData.market);

    // Trades endpoint is optional; if you haven't added it, this will just show none
    const tRes = await fetch(`/api/markets/${id}/trades`, { cache: "no-store" });
    if (tRes.ok) {
      const tData = await tRes.json();
      setTrades(tData.trades ?? []);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 1200);
    return () => clearInterval(timer);
  }, [id]);

  async function trade(side: "YES" | "NO") {
    setErr("");

    if (!Number.isFinite(shares) || shares <= 0) {
      setErr("Shares must be > 0");
      return;
    }

    const r = await fetch(`/api/markets/${id}/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, shares, who: "demo" }),
    });

    const data = await r.json();
    if (!r.ok) {
      setErr(data.error ?? "trade failed");
      return;
    }

    await loadAll();
  }

  return (
    <div className="container">
      <a className="muted" href="/">← Back</a>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{market ? market.question : "Loading..."}</h2>

        {market ? (
          <div className="muted">
            YES price: <b>{market.p_yes.toFixed(4)}</b> • q_yes={market.q_yes.toFixed(2)} • q_no={market.q_no.toFixed(2)}
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ width: 160 }}>
            <input
              className="input"
              type="number"
              value={shares}
              onChange={(e) => setShares(Number(e.target.value))}
            />
            <div className="muted">shares</div>
          </div>

          <button className="btn" onClick={() => trade("YES")}>Buy YES</button>
          <button className="btn" onClick={() => trade("NO")}>Buy NO</button>
        </div>

        {err ? <p style={{ color: "salmon" }}>{err}</p> : null}
      </div>

      <div className="card">
        <h3>Recent trades</h3>
        {trades.length === 0 ? <div className="muted">No trades yet.</div> : null}

        {trades.map((t) => (
          <div
            key={t.id}
            className="row"
            style={{
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 8,
              marginTop: 8,
            }}
          >
            <div>
              <b>{t.side}</b> {t.shares} shares <span className="muted">by {t.who}</span>
            </div>
            <div className="muted">cost: {t.cost.toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
