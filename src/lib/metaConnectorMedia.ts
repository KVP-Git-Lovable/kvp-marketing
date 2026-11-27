import { supabase } from "@/integrations/supabase/client";
import { captureVideoThumbnail } from "@/lib/adMedia";

export interface ConnectorMedia { media_path: string; media_kind: "image" | "video"; thumbnail_path?: string }

/** Uploads an ad image or video to the connector's folder in `meta-media` (same limits as New Campaign). */
export async function uploadConnectorMedia(userId: string, file: File): Promise<ConnectorMedia> {
  const video = file.type === "video/mp4";
  if (!["image/jpeg", "image/png", "video/mp4"].includes(file.type)) throw new Error("Choose a JPG or PNG image, or an MP4 video.");
  if (file.size > (video ? 20 : 8) * 1024 * 1024) throw new Error(video ? "Video must be under 20 MB." : "Image must be under 8 MB.");
  const id = crypto.randomUUID();
  const media_path = `connector/${userId}/${id}.${video ? "mp4" : file.type === "image/png" ? "png" : "jpg"}`;
  const up = await supabase.storage.from("meta-media").upload(media_path, file, { upsert: false, contentType: file.type });
  if (up.error) throw up.error;
  if (!video) return { media_path, media_kind: "image" };
  const thumbnail_path = `connector/${userId}/${id}-thumb.jpg`;
  const thumb = await supabase.storage.from("meta-media").upload(thumbnail_path, await captureVideoThumbnail(file), { contentType: "image/jpeg", upsert: false });
  if (thumb.error) throw thumb.error;
  return { media_path, media_kind: "video", thumbnail_path };
}
