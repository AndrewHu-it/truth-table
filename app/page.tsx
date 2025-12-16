"use client";

import { useEffect, useState } from "react";
import { B_MAX, B_MIN } from "@/lib/lmsr";

type Market = {
  id: string;
  question: string;
  b: number;
  q_yes: number;
  q_no: number;
  p_yes: number;
  created_at: string;
};

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [question, setQuestion] = useState("");
  const [b, setB] = useState(25);
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
      body: JSON.stringify({ question, b }),
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
      <h1>Truth Table</h1>
      <p className="muted">
        Markets powered by an LMSR AMM. This UI calls the same API bots will use.
      </p>

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
          <div style={{ width: 140 }}>
            <input
              className="input"
              type="number"
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              title="Liquidity parameter b"
              min={B_MIN}
              max={B_MAX}
            />
          </div>
          <button className="btn" onClick={createMarket}>Create</button>
        </div>
        {err ? <p style={{ color: "salmon" }}>{err}</p> : null}
      </div>

      {markets.map((m) => (
        <div className="card" key={m.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>{m.question}</div>
              <div className="muted">b={m.b} • YES price: {m.p_yes.toFixed(3)}</div>
            </div>
            <a className="btn" href={`/m/${m.id}`}>Open</a>
          </div>
        </div>
      ))}
    </div>
  );
}
