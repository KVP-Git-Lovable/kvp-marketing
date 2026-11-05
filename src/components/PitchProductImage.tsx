import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Optional pack image: reserve space only after a successful image load. */
export function PitchProductImage({ url, name, className, fallback = false }: { url?: string; name: string; className?: string; fallback?: boolean }) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  useEffect(() => {
    setLoadedUrl(null);
    if (!url) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled && image.naturalWidth > 0) setLoadedUrl(url); };
    image.onerror = () => { if (!cancelled) setLoadedUrl(null); };
    image.src = url;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [url]);
  if (!url || loadedUrl !== url) return fallback ? <span className="line-clamp-3 break-words px-0.5 text-center text-[8px] font-medium leading-tight text-muted-foreground">{name}</span> : null;
  return <img src={url} alt={name} className={cn("shrink-0 rounded-md object-cover", className ?? "h-16 w-10")} onError={() => setLoadedUrl(null)} />;
}
