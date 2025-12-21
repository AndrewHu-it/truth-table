"use client";

import { useEffect, useState } from "react";

type Market = {
  id: string;
  question: string;
  b: number;
  q_yes: number;
  q_no: number;
  p_yes: number;
  created_at: string;
  image?: string | null;
};

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    const r = await fetch("/api/markets", { cache: "no-store" });
    const data = await r.json();
    setMarkets(data.markets ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createMarket() {
    setErr("");
    const r = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, image }),
    });

    const data = await r.json();
    if (!r.ok) {
      setErr(data.error ?? "failed");
      return;
    }

    setQuestion("");
    await load();
  }

  return (
    <div className="container">
      <div className="hero">
        <h1 style={{ marginBottom: 6 }}>Truth Table</h1>
        <p className="muted" style={{ margin: 0 }}>
          Browse markets, tap YES or NO to jump in. Prices update live.
        </p>
      </div>

      <div className="card">
        <h3>Create a market</h3>
        <div className="row">
          <div style={{ flex: 1 }}>
            <input
              className="input"
              placeholder="Question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              className="input"
              placeholder="Image URL (optional)"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>
          <button className="btn" onClick={createMarket}>Create</button>
        </div>
        {err ? <p style={{ color: "salmon" }}>{err}</p> : null}
      </div>

      <div className="market-grid">
        {markets.map((m) => {
          const imageUrl = m.image || "/globe.svg"; // replace with your own image URL per market
          return (
            <div className="market-card" key={m.id}>
              <div
                className="market-image"
                style={{ backgroundImage: `url(${imageUrl})` }}
                title="Add an image URL per market to replace this placeholder"
              />
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{m.question}</div>
              <div className="meta-line">
                <span>Liquidity b={m.b}</span>
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
  );
}
