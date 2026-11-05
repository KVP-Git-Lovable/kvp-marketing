import React from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { useSignedUrl } from "@/hooks/useSignedUrl";

/**
 * Drop-in replacement for AvatarImage that automatically resolves
 * Supabase private storage URLs to signed URLs.
 */
export function SignedAvatarImage({
  src,
  ...props
}: React.ComponentProps<typeof AvatarImage>) {
  const signedUrl = useSignedUrl(src as string | null | undefined);
  return <AvatarImage src={signedUrl || undefined} {...props} />;
}

/**
 * Drop-in replacement for <img> that automatically resolves
 * Supabase private storage URLs to signed URLs.
 */
export function SignedImage({
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const signedUrl = useSignedUrl(src as string | null | undefined);
  if (!signedUrl) return null;
  return <img src={signedUrl} {...props} />;
}
