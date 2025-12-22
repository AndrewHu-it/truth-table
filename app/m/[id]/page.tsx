"use client";

import { use, useEffect, useMemo, useState } from "react"; // ⚠️ CHANGED: `use` unwraps params Promise
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { SHARES_MAX } from "@/lib/lmsr";

type Market = {
  id: string;
  question: string;
  b: number;
  q_yes: number;
  q_no: number;
  p_yes: number;
  created_at: string;
  image?: string | null;
  volume?: number;
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
type Holdings = { yes: number; no: number };

function PriceGraph({ points }: { points: { p_yes: number; t: string }[] }) {
  const W = 780;
  const H = 260;
  const pad = 20;

  if (!points || points.length < 2) {
    return <div className="muted">Not enough data yet to plot a graph.</div>;
  }

  const xs = points.map((_, i) => pad + (i * (W - 2 * pad)) / Math.max(points.length - 1, 1));
  const ys = points.map((p) => p.p_yes);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 1);
  const yFor = (p: number) => pad + (1 - (p - min) / (max - min || 1)) * (H - 2 * pad);

  const d = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(2)} ${yFor(pt.p_yes).toFixed(2)}`)
    .join(" ");

  const gradientId = "marketGrad";

  return (
    <div className="graph-shell">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="pnl-graph">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(90, 140, 255, 0.35)" />
            <stop offset="100%" stopColor="rgba(90, 140, 255, 0.05)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="rgba(255,255,255,0.95)" rx="16" />
        {[0.25, 0.5, 0.75].map((p) => {
          const y = yFor(p);
          return (
            <g key={p}>
              <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="rgba(15,26,47,0.12)" strokeWidth="1" />
              <text x={W - 6} y={y - 4} fontSize="10" fill="rgba(15,26,47,0.55)" textAnchor="end">
                {(p * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <path d={`${d} L ${xs[xs.length - 1]} ${H - pad} L ${xs[0]} ${H - pad} Z`} fill={`url(#${gradientId})`} />
        <path d={d} fill="none" stroke="rgba(65,120,245,0.95)" strokeWidth="3" />
        {(() => {
          const last = points[points.length - 1].p_yes;
          const cx = xs[xs.length - 1];
          const cy = yFor(last);
          return <circle cx={cx} cy={cy} r="5" fill="rgba(65,120,245,0.95)" stroke="#fff" strokeWidth="1.5" />;
        })()}
      </svg>
    </div>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // ⚠️ CHANGED

  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [points, setPoints] = useState<Point[]>([]); // ⚠️ CHANGED
  const [shares, setShares] = useState(5);
  const [err, setErr] = useState("");
  const [range, setRange] = useState<"ALL" | "1H" | "6H" | "1D" | "1W" | "1M">("ALL");
  const [others, setOthers] = useState<Market[]>([]);
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [holdings, setHoldings] = useState<Holdings>({ yes: 0, no: 0 });

  async function loadAll() {
    setErr("");

    const mRes = await fetch(`/api/markets/${id}`, { cache: "no-store" });
    const mData = await mRes.json();
    if (!mRes.ok) {
      setErr(mData.error ?? "market load failed");
      return;
    }
    setMarket(mData.market);
    // load other markets to suggest
    fetch("/api/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.markets ?? []).filter((m: Market) => m.id !== id).slice(0, 4);
        setOthers(list);
      })
      .catch(() => {});

    const tRes = await fetch(`/api/markets/${id}/trades`, { cache: "no-store" });
    if (tRes.ok) {
      const tData = await tRes.json();
      const clean = (tData.trades ?? []).map((t: any) => ({
        ...t,
        shares: Number(t.shares ?? 0),
        cost: Number(t.cost ?? 0),
      }));
      setTrades(clean);
      const yesHeld = clean.filter((t: any) => t.side === "YES").reduce((sum, t) => sum + t.shares, 0);
      const noHeld  = clean.filter((t: any) => t.side === "NO").reduce((sum, t) => sum + t.shares, 0);
      setHoldings({ yes: yesHeld, no: noHeld });
    }

    const hRes = await fetch(`/api/markets/${id}/history?limit=600&range=${range}`, { cache: "no-store" });
    if (hRes.ok) {
      const hData = await hRes.json();
      setPoints(hData.points ?? []);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, range]);

  async function trade(side: "YES" | "NO") {
    setErr("");

    if (!Number.isFinite(shares) || shares <= 0) {
      setErr("Shares must be > 0");
      return;
    }

    const r = await fetch(`/api/markets/${id}/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, shares, action: mode }),
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

  const priceDisplay = useMemo(() => {
    if (!market) return "…";
    return `${(market.p_yes * 100).toFixed(1)}% chance`;
  }, [market]);

  return (
    <div className="container market-layout">
      <div className="market-grid-main">
        <div className="card fancy-card market-main">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="row" style={{ alignItems: "center", gap: 14 }}>
              {market?.image ? (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundImage: `url(${market.image})`,
                    border: "1px solid rgba(15,26,47,0.08)",
                  }}
                />
              ) : null}
              <div>
                <div style={{ fontSize: "1.8rem", fontWeight: 780, lineHeight: 1.2 }}>{market ? market.question : "Loading..."}</div>
                <div className="muted">Volume: {(market?.volume ?? 0).toFixed(3)} TC</div>
              </div>
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 780 }}>{priceDisplay}</div>
          </div>

          <div className="graph-box">
            <div className="range-tabs inline" style={{ marginBottom: 4 }}>
              {(["ALL", "1H", "6H", "1D", "1W", "1M"] as const).map((r) => (
                <button
                  key={r}
                  className={`tab-btn ${r === range ? "active" : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <PriceGraph points={points} />
          </div>
        </div>

        <div className="card trade-box" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: "1.1rem", fontWeight: 750 }}>Place Order</h3>
          <div style={{ marginBottom: 12, fontSize: "1.3rem", fontWeight: 750 }}>{priceDisplay}</div>
          <div className="range-tabs inline" style={{ marginBottom: 10, justifyContent: "flex-start" }}>
            {(["BUY", "SELL"] as const).map((m) => (
              <button
                key={m}
                className={`tab-btn ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Your holdings — YES: {holdings.yes.toFixed(2)} • NO: {holdings.no.toFixed(2)}
          </div>
          <SignedIn>
            <div className="trade-input">
              <label className="muted" htmlFor="shares" style={{ fontSize: "0.95rem" }}>Shares</label>
              <input
                id="shares"
                className="input"
                type="number"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                min={0.0001}
                max={SHARES_MAX}
              />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="muted">Sign in to trade</div>
            <SignInButton />
          </SignedOut>
          {err ? <p style={{ color: "salmon" }}>{err}</p> : null}
          <SignedIn>
            <div className="trade-actions" style={{ marginTop: 16 }}>
              <button className="cta-yes full" onClick={() => trade("YES")}>YES</button>
              <button className="cta-no full" onClick={() => trade("NO")}>NO</button>
            </div>
          </SignedIn>
        </div>
      </div>

      <div style={{ height: 32 }} />

      {others.length > 0 ? (
        <div className="card fancy-card">
          <h3 style={{ marginTop: 0, fontSize: "1.2rem", fontWeight: 780 }}>Other markets</h3>
          <div className="market-grid">
            {others.map((m) => {
              const imageUrl = m.image || "/globe.svg";
              return (
                <div className="market-card" key={m.id}>
                  <div
                    className="market-image"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                  />
                  <div style={{ fontWeight: 750, fontSize: "1.12rem" }}>{m.question}</div>
                  <div className="meta-line">
                    <span>Volume: {(m.volume ?? 0).toFixed(3)} TC</span>
                    <span>YES: {m.p_yes.toFixed(3)}</span>
                  </div>
                  <div className="market-actions">
                    <a className="cta-yes" href={`/m/${m.id}`}>YES</a>
                    <a className="cta-no" href={`/m/${m.id}`}>NO</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
