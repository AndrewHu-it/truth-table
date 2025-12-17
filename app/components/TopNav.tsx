"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="topnav">
      <div className="brand">
        <Link href="/">Truth Table</Link>
      </div>
      <div className="nav-actions">
        <Link href="/" className="nav-link">Markets</Link>
        <Link href="/profile" className="nav-link">Portfolio</Link>
        <SignedOut>
          <SignInButton />
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          <div className="profile-menu" ref={menuRef}>
            <button className="btn" onClick={() => setOpen((v) => !v)}>Profile ▾</button>
            {open ? (
              <div className="profile-menu__items">
                <Link href="/profile">Portfolio</Link>
                <Link href="/profile#positions">Positions</Link>
              </div>
            ) : null}
          </div>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
