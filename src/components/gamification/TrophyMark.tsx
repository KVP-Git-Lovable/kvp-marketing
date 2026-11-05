import trophy3d from "@/assets/gamification-trophy-3d.png";
import { cn } from "@/lib/utils";

interface TrophyMarkProps {
  className?: string;
  /** Adds the soft floating animation used on hero bands. */
  float?: boolean;
  alt?: string;
}

/**
 * Shared 3D champion-cup mark. Single source of truth so every gamification
 * surface (admin hero, leaderboard, badges, celebrations) uses the same trophy.
 *
 * Uses the local transparent PNG rather than the Lovable-hosted
 * gamification-trophy.png asset: that one has a purple plate baked into the
 * image, which showed as a purple square once the hero band went navy/gold.
 * The hosted asset is also scoped to one Lovable project id, so it 404s if the
 * module is ever ported elsewhere.
 */
export function TrophyMark({ className, float = false, alt = "Champion trophy" }: TrophyMarkProps) {
  return (
    <img
      src={trophy3d}
      alt={alt}
      width={480}
      height={480}
      loading="lazy"
      className={cn(
        "select-none pointer-events-none drop-shadow-[0_14px_28px_rgba(0,0,0,.32)]",
        float && "animate-trophy-float",
        className,
      )}
    />
  );
}
