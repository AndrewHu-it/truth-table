"use client";

import { useEffect, useState } from "react";

type Position = {
  market_id: string;
  question: string;
  shares_yes: number;
  shares_no: number;
  cost: number;
  value: number;
  pnl: number;
  pct: number;
};

type Trade = {
  id: string;
  question: string;
  side: "YES" | "NO";
  shares: number;
  cost: number;
  created_at: string;
  price_now: number;
  value: number;
  pnl: number;
  pct: number;
};

type PnlPoint = { t: string; pnl: number };

const ranges = ["ALL", "1M", "1W", "1D"] as const;

function PnlGraph({ points }: { points: PnlPoint[] }) {
  const W = 640;
  const H = 200;
  const pad = 16;

  if (!points || points.length === 0) {
    return <div className="muted">No PnL data yet.</div>;
  }

  const xs = points.map((_, i) => pad + (i * (W - 2 * pad)) / Math.max(points.length - 1, 1));
  const pnlVals = points.map((p) => p.pnl);
  const min = Math.min(...pnlVals, 0);
  const max = Math.max(...pnlVals, 0.0001);
  const scaleY = (p: number) => {
    const t = (p - min) / (max - min || 1);
    return pad + (1 - t) * (H - 2 * pad);
  };

  const d = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(2)} ${scaleY(pt.pnl).toFixed(2)}`)
    .join(" ");

  const gradientId = "pnlGrad";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="pnl-graph">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(120,170,255,0.35)" />
          <stop offset="100%" stopColor="rgba(120,170,255,0.03)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="rgba(255,255,255,0.9)" rx="16" />
      <line x1={pad} x2={W - pad} y1={scaleY(0)} y2={scaleY(0)} stroke="rgba(15,26,47,0.18)" strokeDasharray="4 4" />
      <path d={`${d} L ${xs[xs.length - 1]} ${H - pad} L ${xs[0]} ${H - pad} Z`} fill={`url(#${gradientId})`} />
      <path d={d} fill="none" stroke="rgba(65,120,245,0.9)" strokeWidth="3" />
      {(() => {
        const last = points[points.length - 1];
        const cx = xs[xs.length - 1];
        const cy = scaleY(last.pnl);
        return <circle cx={cx} cy={cy} r="5" fill="rgba(65,120,245,0.95)" stroke="#fff" strokeWidth="1.5" />;
      })()}
    </svg>
  );
}

export default function ProfilePage() {
  const [range, setRange] = useState<(typeof ranges)[number]>("ALL");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(0);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [pnlTotal, setPnlTotal] = useState(0);
  const [points, setPoints] = useState<PnlPoint[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/positions?range=${range}`, { cache: "no-store" });
      const text = await r.text();
      const data = text ? JSON.parse(text) : {};
      if (!r.ok) {
        if (r.status === 401) {
          setErr("Please sign in to view your portfolio.");
        } else {
          setErr(data.error ?? "failed to load");
        }
        return;
      }
      setBalance(Number(data.balance ?? 0));
      setPnlTotal(Number(data.pnl?.total ?? 0));
      setPoints(data.pnl?.points ?? []);
      setPortfolioValue(Number(data.portfolio_value ?? 0));
      setPositions(data.positions ?? []);
      setTrades(data.trades ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const pnlColor = pnlTotal >= 0 ? "#65d57d" : "#ef7070";
  const tradesDisplay = trades.slice(0, 30);

  return (
    <div className="container portfolio-container">
      {err ? <p style={{ color: "salmon" }}>{err}</p> : null}

      <div className="row" style={{ alignItems: "stretch", gap: 14 }}>
        <div className="card fancy-card" style={{ flex: 2, position: "relative" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="muted">Profit &amp; Loss</div>
              <div style={{ fontSize: "1.9rem", color: pnlColor, fontWeight: 700 }}>
                {pnlTotal >= 0 ? "+" : ""}
                {pnlTotal.toFixed(3)} TC
              </div>
            </div>
            {loading ? <div className="muted">Loading...</div> : null}
          </div>
          <div className="graph-box">
            <div className="range-tabs inline">
              {ranges.map((r) => (
                <button
                  key={r}
                  className={`tab-btn ${r === range ? "active" : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <PnlGraph points={points} />
          </div>
        </div>

        <div className="card fancy-card summary-card cash-card" style={{ flex: 1 }}>
          <div className="stat-label">Cash</div>
          <div className="stat-value">{balance.toFixed(3)} TC</div>
          <div className="stat-sub">Available Truth Coins.</div>
          <div className="stat-sub" style={{ marginTop: 8 }}>Holdings value: {portfolioValue.toFixed(3)} TC</div>
          <div className="stat-sub">Total: {(balance + portfolioValue).toFixed(3)} TC</div>
        </div>
      </div>

      <div className="card fancy-card" id="positions">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Positions</h3>
          <div className="muted">Live mark-to-market</div>
        </div>
        {positions.length === 0 ? <div className="muted">No positions yet.</div> : null}
        <div className="stacked-list">
          {positions.map((p) => {
            const color = p.pnl >= 0 ? "#1aa36f" : "#e35c5c";
            return (
              <div key={p.market_id} className="stacked-item">
                <div>
                  <div style={{ fontWeight: 650, marginBottom: 4 }}>{p.question}</div>
                  <div className="muted">
                    YES: {p.shares_yes.toFixed(2)} • NO: {p.shares_no.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color, fontWeight: 700 }}>
                    {p.pnl >= 0 ? "+" : ""}
                    {p.pnl.toFixed(3)} TC
                    {" "}
                    ({(p.pct * 100).toFixed(2)}%)
                  </div>
                  <div className="muted">Value: {p.value.toFixed(3)} TC</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card fancy-card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Last 30 trades</h3>
          <div className="muted">Most recent activity</div>
        </div>
        {tradesDisplay.length === 0 ? <div className="muted">No trades yet.</div> : null}
        <div className="stacked-list">
          {tradesDisplay.map((t) => {
            const color = t.pnl >= 0 ? "#1aa36f" : "#e35c5c";
            return (
              <div key={t.id} className="stacked-item">
                <div>
                  <div style={{ fontWeight: 650, marginBottom: 4 }}>{t.question}</div>
                  <div className="muted">{t.side} • {t.shares} shares @ {t.price_now.toFixed(3)}</div>
                  <div className="muted">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color, fontWeight: 700 }}>
                    {t.pnl >= 0 ? "+" : ""}
                    {t.pnl.toFixed(3)} TC
                    {" "}
                    ({(t.pct * 100).toFixed(2)}%)
                  </div>
                  <div className="muted">Cost: {t.cost.toFixed(3)} TC</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
