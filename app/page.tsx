"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
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
  volume?: number;
};

export default function Page() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState("");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return url.searchParams.get("q") ?? "";
  });

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
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: "1.6rem", fontWeight: 780 }}>Create a market</h2>
        <SignedIn>
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
        </SignedIn>
        <SignedOut>
          <div className="signedout-panel">
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Sign in to create a market</div>
            <div className="muted" style={{ margin: "6px 0 12px" }}>
              Join to launch a new market and start trading.
            </div>
            <div className="auth-buttons">
              <SignInButton>
                <button className="pill auth-btn primary">Sign in</button>
              </SignInButton>
              <SignUpButton>
                <button className="pill auth-btn">Sign up</button>
              </SignUpButton>
            </div>
          </div>
        </SignedOut>
      </div>

      <div className="market-grid">
        {markets
          .filter((m) => {
            if (!query.trim()) return true;
            return m.question.toLowerCase().includes(query.toLowerCase());
          })
          .map((m) => {
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
  );
}
