"use client";

import { use, useEffect, useState } from "react"; // ⚠️ CHANGED: `use` unwraps params Promise
import { SHARES_MAX } from "@/lib/lmsr";

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

type Point = { t: string; p_yes: number }; // ⚠️ CHANGED: history points for graph

function PriceGraph({ points }: { points: { p_yes: number }[] }) {
  const W = 640;
  const H = 180;
  const pad = 12;

  if (!points || points.length < 2) {
    return <div className="muted">Not enough data yet to plot a graph.</div>;
  }

  const xFor = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const yFor = (p: number) => pad + (1 - p) * (H - 2 * pad);

  const d = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(pt.p_yes).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", borderRadius: 14, border: "1px solid rgba(80,140,255,0.25)" }}
    >
      <rect x="0" y="0" width={W} height={H} fill="rgba(40, 80, 180, 0.06)" />

      {[0.25, 0.5, 0.75].map((p) => {
        const y = yFor(p);
        return (
          <g key={p}>
            <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <text x={W - pad} y={y - 4} fontSize="10" fill="rgba(255,255,255,0.45)" textAnchor="end">
              {p.toFixed(2)}
            </text>
          </g>
        );
      })}

      <path d={d} fill="none" stroke="rgba(120, 170, 255, 0.95)" strokeWidth="2.5" />

      {(() => {
        const last = points[points.length - 1].p_yes;
        const cx = xFor(points.length - 1);
        const cy = yFor(last);
        return <circle cx={cx} cy={cy} r="4" fill="rgba(120, 170, 255, 0.95)" />;
      })()}
    </svg>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // ⚠️ CHANGED

  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [points, setPoints] = useState<Point[]>([]); // ⚠️ CHANGED
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

    const tRes = await fetch(`/api/markets/${id}/trades`, { cache: "no-store" });
    if (tRes.ok) {
      const tData = await tRes.json();
      setTrades(tData.trades ?? []);
    }

    // ⚠️ CHANGED: history for graph
    const hRes = await fetch(`/api/markets/${id}/history?limit=300`, { cache: "no-store" });
    if (hRes.ok) {
      const hData = await hRes.json();
      setPoints(hData.points ?? []);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 5000);
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
      body: JSON.stringify({ side, shares }),
    });

    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        setErr("Please sign in to trade.");
      } else {
        setErr(data.error ?? "trade failed");
      }
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
              min={0.0001}
              max={SHARES_MAX}
            />
            <div className="muted">shares</div>
          </div>

          <button className="btn" onClick={() => trade("YES")}>Buy YES</button>
          <button className="btn" onClick={() => trade("NO")}>Buy NO</button>
        </div>

        {err ? <p style={{ color: "salmon" }}>{err}</p> : null}
      </div>

      <div className="card">
        <h3>YES price over time</h3>
        <PriceGraph points={points} />
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
            <div className="muted">cost: {Number(t.cost).toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
