import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';
// Rendered to canvas rather than shown in an <iframe>: Chrome blocks its PDF
// plugin inside sandboxed preview iframes ("This page has been blocked by
// Chrome"). Worker bundled via Vite so a dynamic worker URL can't fail there.
// @ts-ignore
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

try {
  // @ts-ignore — workerPort is the most reliable path inside iframes.
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
} catch (e) {
  console.warn('pdf.js worker init failed, falling back to fake worker', e);
}

/** Where a block landed on a page, in PDF points. From X-Report-Blocks. */
interface BlockBox { id: string; type: string; page: number; x: number; y: number; w: number; h: number }
/** Just enough of a layout block to reorder one. */
export interface BlockRef { id?: string; type: string; hidden?: boolean }

interface Dataset {
  key: string;
  label: string;
  source?: string;
  dimensions: Array<{ key: string; label: string }>;
  measures: Array<{ key: string; label: string; agg?: string }>;
}

export interface PdfInlinePreviewProps {
  open: boolean;
  template: any;
  aiEnabled?: boolean;
  name: string;
  dataset: Dataset | undefined;
  layout: string;
  rows: string[];
  columns: string;
  values: string[];
  /** The body order, so a handle on the page can move a block. */
  blocks?: BlockRef[] | null;
  onReorderBlocks?: (next: BlockRef[]) => void;
  filters: {
    date_from: string;
    date_to: string;
    scope_user_id?: string | null;
    distributor_id?: string | null;
    audience_user_ids?: string[] | null;
    date_format?: string | null;
    exclude_user_ids?: string[] | null;
    exclude_inactive?: boolean | null;
    sort_key?: string | null;
    sort_dir?: 'asc' | 'desc' | null;
  };
  refreshKey: number;
}

/**
 * Inline PDF preview.
 *
 * IMPORTANT: this renders the REAL PDF produced by the `generate-report` edge
 * function (mode: 'preview'), i.e. exactly the same template, renderer and
 * branding path used for the delivered/downloaded file. There is intentionally
 * no separate HTML mock — that is what previously caused preview/download
 * drift. The Download button saves the very bytes shown above it.
 */
export function PdfInlinePreview(props: PdfInlinePreviewProps) {
  const { open, template: t, name, dataset, layout, rows, columns, values, filters, refreshKey } = props;

  const canQuery = !!dataset?.key && (values.length > 0 || (layout === 'tabular' && rows.length > 0));

  const previewPayload = useMemo(() => ({
    mode: 'preview' as const,
    preview: {
      name: name || 'Report',
      dataset_key: dataset?.key ?? '',
      layout,
      config: {
        rows,
        columns: columns ? [columns] : [],
        values,
        filters: {
          date_from: filters.date_from,
          date_to: filters.date_to,
          scope_user_id: filters.scope_user_id || null,
          distributor_id: filters.distributor_id || null,
          audience_user_ids: filters.audience_user_ids?.length ? filters.audience_user_ids : null,
          exclude_user_ids: filters.exclude_user_ids?.length ? filters.exclude_user_ids : null,
          exclude_inactive: filters.exclude_inactive || null,
          date_format: filters.date_format || null,
          sort_key: filters.sort_key || null,
          sort_dir: filters.sort_key ? (filters.sort_dir || 'desc') : null,
        },
      },
      pdf_template: t ?? {},
      ai_enabled: !!props.aiEnabled,
      period: {
        key: `${filters.date_from}_${filters.date_to}`,
        label: `${filters.date_from} → ${filters.date_to}`,
        date_from: filters.date_from,
        date_to: filters.date_to,
      },
    },
  }), [name, dataset?.key, layout, rows, columns, values, filters, t]);

  const pdf = useQuery({
    queryKey: ['pdf-inline-preview-file', JSON.stringify(previewPayload), refreshKey],
    enabled: open && canQuery,
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<{ blob: Blob; boxes: BlockBox[] }> => {
      // Raw fetch rather than functions.invoke: the renderer reports where each
      // block landed in an X-Report-Blocks header, and invoke hands back only
      // the body. That header is what the drag handles below are placed from.
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(previewPayload),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { msg = JSON.parse(text)?.error ?? text; } catch { /* plain text */ }
        throw new Error(msg || 'Preview failed');
      }
      let boxes: BlockBox[] = [];
      const raw = res.headers.get('X-Report-Blocks');
      // No header — an older deployment — simply means no handles. The preview
      // itself still works, so this never fails the render.
      if (raw) { try { boxes = JSON.parse(atob(raw)); } catch { boxes = []; } }
      return { blob: await res.blob(), boxes };
    },
  });

  const [url, setUrl] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!(pdf.data?.blob instanceof Blob)) return;
    const next = URL.createObjectURL(pdf.data.blob);
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = next;
    setUrl(next);
    return () => {
      // revoked on next render or unmount
    };
  }, [pdf.data]);

  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  // Paint the PDF into canvases inside the scroll container.
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // The drag reads these at drop time, not at paint time, so a handle painted
  // before the last edit still moves the right block.
  const liveBlocks = useRef(props.blocks ?? null);
  const liveReorder = useRef(props.onReorderBlocks);
  liveBlocks.current = props.blocks ?? null;
  liveReorder.current = props.onReorderBlocks;

  /**
   * Drag handles, laid over the page where each block actually landed.
   *
   * The preview is the real PDF painted to a canvas, so there is no HTML to
   * attach a handle to — the renderer reports each block's box instead and the
   * handles are placed from that. Drag one onto another and the two swap places
   * in the body, which re-renders the page underneath.
   */
  const paintHandles = (wrap: HTMLDivElement, pageNo: number, pageW: number, pageH: number) => {
    const boxes = (pdf.data?.boxes ?? []).filter(b => b.page === pageNo);
    const blocks = liveBlocks.current;
    if (!boxes.length || !blocks?.length || !liveReorder.current) return;

    const pct = (v: number, total: number) => `${(v / total) * 100}%`;
    let fromId: string | null = null;

    boxes.forEach((b) => {
      if (!blocks.some(x => (x.id ?? '') === b.id)) return;
      const el = document.createElement('div');
      el.draggable = true;
      el.dataset.blockId = b.id;
      el.title = `Drag to move the ${b.type.replace(/_/g, ' ')}`;
      el.style.position = 'absolute';
      el.style.left = pct(b.x, pageW);
      el.style.top = pct(b.y, pageH);
      el.style.width = pct(b.w, pageW);
      el.style.height = pct(Math.max(b.h, 12), pageH);
      el.style.cursor = 'grab';
      el.style.borderRadius = '4px';
      el.style.transition = 'background .12s, box-shadow .12s';
      el.style.background = 'transparent';

      const grip = document.createElement('div');
      grip.textContent = '⋮⋮';
      grip.style.cssText =
        'position:absolute;left:-2px;top:2px;font-size:11px;line-height:1;padding:2px 3px;'
        + 'border-radius:4px;background:hsl(var(--primary));color:#fff;opacity:0;transition:opacity .12s';
      el.appendChild(grip);

      const lit = (on: boolean) => {
        el.style.background = on ? 'hsl(var(--primary) / 0.10)' : 'transparent';
        el.style.boxShadow = on ? '0 0 0 1.5px hsl(var(--primary))' : 'none';
        grip.style.opacity = on ? '1' : '0';
      };
      el.addEventListener('mouseenter', () => lit(true));
      el.addEventListener('mouseleave', () => { if (!fromId) lit(false); });

      el.addEventListener('dragstart', (e) => {
        fromId = b.id;
        (e as DragEvent).dataTransfer?.setData('text/plain', b.id);
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => { fromId = null; el.style.opacity = '1'; lit(false); });
      el.addEventListener('dragover', (e) => { e.preventDefault(); lit(true); });
      el.addEventListener('dragleave', () => lit(false));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        lit(false);
        const src = fromId ?? (e as DragEvent).dataTransfer?.getData('text/plain') ?? '';
        const cur = liveBlocks.current ?? [];
        const from = cur.findIndex(x => (x.id ?? '') === src);
        const to = cur.findIndex(x => (x.id ?? '') === b.id);
        if (from < 0 || to < 0 || from === to) return;
        const next = [...cur];
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        liveReorder.current?.(next);
      });

      wrap.appendChild(el);
    });
  };

  useEffect(() => {
    if (!(pdf.data?.blob instanceof Blob)) return;
    let cancelled = false;
    setRenderError(null);
    (async () => {
      try {
        const buf = await pdf.data.blob.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        const host = canvasHostRef.current;
        if (!host || cancelled) return;
        host.innerHTML = '';
        const hostWidth = Math.max(320, host.clientWidth - 24);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(1, hostWidth / base.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'shadow-sm rounded bg-white block max-w-full h-auto';
          const ctx = canvas.getContext('2d')!;

          // The canvas is wrapped so the handles can sit over it. Positions are
          // PERCENTAGES of the page, not pixels: the canvas is max-w-full, so
          // its drawn size and its CSS size differ, and a pixel offset would
          // drift as the panel resizes.
          const wrap = document.createElement('div');
          wrap.className = 'relative mx-auto mb-3 w-fit';
          wrap.appendChild(canvas);
          host.appendChild(wrap);
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          paintHandles(wrap, i, base.width, base.height);
        }
      } catch (e: any) {
        if (!cancelled) setRenderError(e?.message ?? 'Could not render the PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [pdf.data, props.blocks, props.onReorderBlocks]);

  if (!open) return null;

  const orientationSetting = (t?.orientation ?? 'auto') as 'auto' | 'portrait' | 'landscape';
  const columnCount = (layout === 'tabular' ? rows.length : 1) + values.length + (layout === 'matrix' && columns ? 1 : 0);
  const orientation = orientationSetting === 'auto'
    ? (columnCount > 6 ? 'landscape' : 'portrait')
    : orientationSetting;

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(name || 'report').replace(/[^\w-]+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2 text-[11px] text-muted-foreground">
        <span>Inline preview · this is the exact PDF that gets delivered</span>
        <div className="flex items-center gap-2">
          <span>{orientation === 'portrait' ? 'A4 · Portrait' : 'A4 · Landscape'}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={download} disabled={!url}>
            <Download size={13} className="mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      <div
        className="w-full rounded-md border border-border bg-background overflow-hidden"
        style={{ height: orientation === 'portrait' ? 780 : 620 }}
      >
        {!canQuery ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Pick fields in the Build step to see the PDF here.
          </div>
        ) : pdf.isLoading || pdf.isFetching ? (
          <div className="h-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Rendering PDF…
          </div>
        ) : pdf.error || renderError ? (
          <div className="h-full flex items-center justify-center gap-2 text-xs text-destructive px-6 text-center">
            <AlertTriangle size={14} /> Could not render the PDF preview.{' '}
            {renderError ?? (pdf.error as any)?.message ?? ''}
          </div>
        ) : (
          <div ref={canvasHostRef} className="w-full h-full overflow-auto p-3 bg-muted/20" />
        )}
      </div>
    </div>
  );
}
