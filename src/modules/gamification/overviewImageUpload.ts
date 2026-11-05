import { supabase } from "@/integrations/supabase/client";

export const OVERVIEW_ICON_BUCKET = "gamification-icons";

/** The largest box it fills is an 88px journey tile, so 3x that covers
 *  a high-density phone screen without wasting a rep's data. */
const MAX_EDGE = 264;

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];

/**
 * Shrink an admin's picture to a square-ish thumbnail before it leaves the
 * browser. A photo straight off a phone is several megabytes and would be
 * refused by the bucket; downscaling means they can pick any file and it just
 * works, and reps on a patchy connection download ~5 KB instead.
 *
 * Transparency is kept — PNG in, PNG out — so a logo with a cut-out background
 * does not come back on a white square.
 */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.drawImage(bitmap, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not read that image."))),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

/**
 * Upload one Overview picture and return its public URL.
 *
 * Throws with a sentence worth showing in a toast — every failure here is
 * something the admin can act on.
 */
export async function uploadOverviewImage(file: File): Promise<string> {
  if (!ACCEPT.includes(file.type)) {
    throw new Error("Pick a PNG, JPG, WEBP or GIF image.");
  }

  const blob = await downscale(file);

  // Random name: two admins uploading "logo.png" must not collide, and the
  // bucket is public so the path should not leak the original filename.
  const path = `overview/${crypto.randomUUID()}.png`;

  const { error } = await supabase.storage
    .from(OVERVIEW_ICON_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw new Error(error.message || "Could not upload that image.");

  const { data } = supabase.storage.from(OVERVIEW_ICON_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Uploaded, but could not get a link to it.");
  return data.publicUrl;
}

/**
 * Best-effort cleanup when an admin replaces or clears a picture.
 *
 * Never throws: the row is what matters, and a stray 5 KB object is a smaller
 * problem than a save that fails because storage said no.
 */
export async function removeOverviewImage(url?: string): Promise<void> {
  if (!url) return;
  const marker = `/${OVERVIEW_ICON_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return;
  const path = url.slice(at + marker.length).split("?")[0];
  if (!path) return;
  await supabase.storage.from(OVERVIEW_ICON_BUCKET).remove([path]).catch(() => {});
}
