import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TwilioBalance { balance: string; currency: string; account_sid: string }
interface ExchangeRates { rates?: Record<string, number> }

export function WhatsAppWalletBalanceCard() {
  const { data, isFetching, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["twilio-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("twilio-balance", { method: "POST" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as TwilioBalance;
    },
    staleTime: 3 * 60 * 1000,
    retry: false,
  });

  const { data: fx } = useQuery({
    queryKey: ["usd-inr-rate"],
    enabled: !!data,
    queryFn: async () => {
      const resp = await fetch("https://open.er-api.com/v6/latest/USD");
      return (await resp.json()) as ExchangeRates;
    },
    staleTime: 60 * 60 * 1000,
  });

  const usd = data ? Number(data.balance) : null;
  const inr = usd != null && fx?.rates?.INR ? usd * fx.rates.INR : null;

  return (
    <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <Wallet className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide opacity-80">API Wallet Balance</p>
          {isError ? (
            <p className="text-sm">Unable to load balance</p>
          ) : usd != null ? (
            <p className="text-lg font-semibold">
              ${usd.toFixed(2)} USD
              {inr != null && <span className="text-sm font-normal opacity-80"> (₹{inr.toFixed(0)})</span>}
            </p>
          ) : (
            <p className="text-sm opacity-80">Loading...</p>
          )}
          {dataUpdatedAt > 0 && (
            <p className="text-[11px] opacity-70">Updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}</p>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
