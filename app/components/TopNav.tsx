"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isSignedIn } = useUser();
  const [cash, setCash] = useState(0);
  const [portfolio, setPortfolio] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    window.location.href = `/?q=${encodeURIComponent(query.trim())}`;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSignedIn) {
        setCash(0);
        setPortfolio(0);
        return;
      }
      try {
        const r = await fetch("/api/portfolio", { cache: "no-store" });
        const text = await r.text();
        const data = text ? JSON.parse(text) : {};
        if (!cancelled && r.ok) {
          setCash(Number(data.balance ?? 0));
          setPortfolio(Number(data.portfolio_value ?? 0));
        }
      } catch {
        if (!cancelled) {
          setCash(0);
          setPortfolio(0);
        }
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isSignedIn]);

  return (
    <header className="topnav">
      <div className="nav-left">
        <Link href="/" className="logo-link">
          TRUTH TABLE
        </Link>
      </div>
      <div className="nav-center">
        <form onSubmit={onSearchSubmit} className="search">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets..."
          />
          <button className="btn" type="submit">Search</button>
        </form>
      </div>
      <div className="nav-actions">
        <Link href="/" className="nav-link">Markets</Link>
        <Link href="/profile" className="nav-link">Portfolio</Link>
        <SignedIn>
          <div className="balance-group">
            <div className="pill">Portfolio: {portfolio.toFixed(3)} TC</div>
            <div className="pill">Cash: {cash.toFixed(3)} TC</div>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton />
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
