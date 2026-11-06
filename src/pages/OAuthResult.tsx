import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OAuthResultPayload {
  source: string;
  ok: boolean;
  message: string;
}

// Landing page for the OAuth popup (Meta Connection). The edge function redirects here
// with the outcome in the URL fragment, because Supabase serves HTML from edge functions
// as plain text. Shows a Success / failure screen, tells the window that opened it, and
// closes itself.
function readPayload(): OAuthResultPayload {
  try {
    const raw = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("result");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        source: String(parsed.source || "oauth"),
        ok: !!parsed.ok,
        message: String(parsed.message || (parsed.ok ? "Connected." : "Connection was not completed.")),
      };
    }
  } catch {
    /* fall through to the generic failure below */
  }
  return { source: "oauth", ok: false, message: "No result was received. You can close this window and try again." };
}

export default function OAuthResult() {
  const result = useMemo(readPayload, []);
  const [closeBlocked, setCloseBlocked] = useState(false);

  useEffect(() => {
    document.title = result.ok ? "Connected" : "Connection failed";
    try {
      window.opener?.postMessage({ source: result.source, ok: result.ok }, window.location.origin);
    } catch {
      /* opener is gone or cross-origin; the app also watches for the popup closing */
    }
    if (!result.ok) return;
    const timer = window.setTimeout(() => {
      window.close();
      // Browsers only allow close() on windows a script opened; if this one wasn't, say so.
      window.setTimeout(() => setCloseBlocked(true), 400);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [result]);

  const handleClose = () => {
    window.close();
    setCloseBlocked(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card text-card-foreground shadow-lg p-8 text-center space-y-4">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            result.ok ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="h-12 w-12 text-green-600 animate-in zoom-in-50 duration-300" />
          ) : (
            <XCircle className="h-12 w-12 text-red-600 animate-in zoom-in-50 duration-300" />
          )}
        </div>
        <div className="space-y-1">
          <h1 className={`text-2xl font-bold ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.ok ? "Success" : "Connection failed"}
          </h1>
          <p className="text-sm text-muted-foreground break-words">{result.message}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {closeBlocked
            ? "You can close this window now."
            : result.ok
              ? "This window will close automatically."
              : "Close this window and try again."}
        </p>
        <Button onClick={handleClose} variant={result.ok ? "default" : "outline"} className="w-full">
          Close window
        </Button>
      </div>
    </div>
  );
}
