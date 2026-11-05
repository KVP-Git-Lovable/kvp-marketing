import { overviewIcon } from "./overviewIcons";

/**
 * The mark on one Overview line: an admin's uploaded picture if there is one,
 * otherwise the chosen or derived icon. Both sides of the app draw it through
 * here so a line looks the same in the editor as it does to a rep.
 */
export function OverviewGlyph({
  icon, image, className = "h-4 w-4", tone = "", alt = "",
}: {
  icon?: string;
  image?: string;
  /** Size classes. Applied to the icon and to the image box alike. */
  className?: string;
  /** Colour classes for the icon. Ignored for an image, which has its own. */
  tone?: string;
  alt?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt}
        loading="lazy"
        // contain, not cover: these are screenshots of app buttons with words
        // in them, and cover cut the words off. The box is sized by the caller,
        // so the picture is as large as its shape allows inside it.
        className={`${className} object-contain rounded-[6px]`}
      />
    );
  }
  const Icon = overviewIcon(icon);
  return <Icon className={`${className} ${tone}`} />;
}
