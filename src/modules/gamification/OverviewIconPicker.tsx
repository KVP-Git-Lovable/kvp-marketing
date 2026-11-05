import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Upload } from "lucide-react";
import { OVERVIEW_ICONS } from "./overviewIcons";
import { OverviewGlyph } from "./OverviewGlyph";
import { removeOverviewImage, uploadOverviewImage } from "./overviewImageUpload";

/** What the picker hands back. Both keys are always sent, so one clears the other. */
export interface GlyphChoice {
  icon?: string;
  image?: string;
}

/**
 * Pick the mark for one Overview line: either a built-in icon or the admin's
 * own image.
 *
 * The icons are a curated grid rather than a text box, so an admin never has to
 * know a lucide name and cannot type one that does not exist. Leaving both
 * unset is normal — the rep-facing page then picks an icon from the sentence.
 */
export function OverviewIconPicker({
  value, image, onChange, label,
}: {
  value?: string;
  image?: string;
  onChange: (choice: GlyphChoice) => void;
  /** What this row says, so the button has a meaningful accessible name. */
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const chosen = OVERVIEW_ICONS.find((i) => i.name === value);
  const current = image ? "your image" : chosen?.label ?? "chosen automatically";

  const pickFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadOverviewImage(file);
      // The old picture is only unreferenced once the new one is in hand.
      const previous = image;
      onChange({ image: url, icon: undefined });
      void removeOverviewImage(previous);
      toast.success("Image added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button" size="icon" variant="outline"
          className="h-8 w-8 shrink-0 overflow-hidden"
          aria-label={`Icon for "${label || "this line"}": ${current}`}
        >
          <OverviewGlyph
            icon={value} image={image}
            className="h-4 w-4"
            tone={value ? "" : "text-muted-foreground/50"}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[268px] p-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11.5px] font-semibold">Choose an icon</p>
          <Button
            type="button" size="sm" variant="ghost" className="h-6 text-[11px]"
            disabled={!value && !image}
            onClick={() => {
              const previous = image;
              onChange({ icon: undefined, image: undefined });
              void removeOverviewImage(previous);
            }}
          >
            Automatic
          </Button>
        </div>

        <ScrollArea className="h-[188px] pr-2">
          <div className="grid grid-cols-6 gap-1">
            {OVERVIEW_ICONS.map(({ name, label: iconLabel, Icon }) => (
              <button
                key={name}
                type="button"
                title={iconLabel}
                aria-label={iconLabel}
                aria-pressed={value === name}
                onClick={() => {
                  const previous = image;
                  onChange({ icon: name, image: undefined });
                  void removeOverviewImage(previous);
                }}
                className={`h-8 w-8 grid place-items-center rounded-[8px] border transition-colors ${
                  value === name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* ---- or bring your own ---- */}
        <div className="relative my-2">
          <div className="h-px bg-border" />
          <span className="absolute inset-0 -top-[7px] grid place-items-center">
            <span className="bg-popover px-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              or
            </span>
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />

        {image ? (
          <div className="flex items-center gap-2 rounded-[8px] border p-1.5">
            {/* contain, matching how a rep sees it */}
            <img src={image} alt="" className="h-9 w-9 object-contain rounded-[6px]" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold leading-tight">Your image</p>
              <p className="text-[10.5px] text-muted-foreground leading-tight">
                Shown instead of an icon.
              </p>
            </div>
            <Button
              type="button" size="icon" variant="ghost"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              aria-label="Remove image"
              disabled={busy}
              onClick={() => {
                const previous = image;
                onChange({ image: undefined, icon: value });
                void removeOverviewImage(previous);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button" size="sm" variant="outline"
            className="w-full h-8 text-[11.5px]"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {busy ? "Uploading…" : "Upload an image"}
          </Button>
        )}

        <p className="text-[10.5px] text-muted-foreground mt-2 leading-snug">
          {image
            ? "Replace it by removing it first, or pick an icon above."
            : "PNG, JPG, WEBP or GIF — it is shrunk to a small square for you. Left on automatic, the rep's page picks an icon from the words you wrote."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
