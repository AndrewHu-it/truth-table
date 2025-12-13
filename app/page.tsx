export default function Home() {
  const markets = [
    { id: "m1", title: "Did Facility X have a chemical leak in March 2024?", yes: 0.62 },
    { id: "m2", title: "Did University Y force Professor Chen to resign in Sept 2025?", yes: 0.41 },
    { id: "m3", title: "Will BTC be above $120k on June 30, 2026?", yes: 0.55 },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Truth Market</h1>
        <p className="mt-2 text-slate-300">
          Click a market → later we’ll wire this to a real backend + trading API.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {markets.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow"
            >
              <div className="text-sm text-slate-400">Market</div>
              <div className="mt-1 text-lg font-semibold">{m.title}</div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-slate-300">
                  YES price: <span className="font-mono">{m.yes.toFixed(2)}</span>
                </div>

                <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500">
                  Trade
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
