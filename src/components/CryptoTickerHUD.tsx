import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Bitcoin } from "lucide-react";
import { HudCard } from "./HudCard";

interface Coin {
  id: string;
  symbol: string;
  price: number;
  change: number;
}

const COINS = "bitcoin,ethereum,solana,dogecoin,cardano";

// Live crypto price ticker via the free, key-less CoinGecko API.
export function CryptoTickerHUD() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINS}&vs_currencies=usd&include_24hr_change=true`
      );
      if (!r.ok) throw new Error();
      const j = await r.json();
      setCoins(
        Object.entries(j).map(([id, v]: [string, any]) => ({
          id,
          symbol: id.slice(0, 3).toUpperCase(),
          price: v.usd,
          change: v.usd_24h_change ?? 0,
        }))
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const display = coins.length
    ? coins
    : [
        { id: "bitcoin", symbol: "BIT", price: 67432, change: 2.3 },
        { id: "ethereum", symbol: "ETH", price: 3521, change: -1.2 },
        { id: "solana", symbol: "SOL", price: 178, change: 5.6 },
      ];

  return (
    <HudCard
      title="Crypto Markets"
      icon={Bitcoin}
      dotColor="#f59e0b"
      right={
        <button onClick={load} className="text-white/30 hover:text-white">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      {error && !coins.length ? (
        <p className="py-2 text-center text-[11px] text-amber-300/60">डेमो डेटा (API रेट लिमिट)</p>
      ) : null}
      <div className="space-y-1.5">
        {display.map((c) => {
          const up = c.change >= 0;
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <span className="w-9 font-mono text-xs font-bold text-white/80">{c.symbol}</span>
              <span className="flex-1 font-mono text-sm text-white">
                ${c.price.toLocaleString(undefined, { maximumFractionDigits: c.price < 10 ? 4 : 0 })}
              </span>
              <span
                className={`flex items-center gap-0.5 font-mono text-xs ${up ? "text-green-400" : "text-red-400"}`}
              >
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(c.change).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </HudCard>
  );
}
