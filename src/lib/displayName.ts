/**
 * How long a name is allowed to be before it is cut short on screen.
 *
 * Distributor names run to things like "KVP Business Solutions Private
 * Limited", which pushes every column beside it out of shape. Twenty-five
 * characters is the agreed ceiling across the app; the full name always
 * stays available on hover, so nothing is actually lost.
 */
export const NAME_MAX = 25;

/** "BHARATH BEVERAGES Bangalo…" — cut on a word boundary where one is near. */
export function shortName(name: string | null | undefined, max = NAME_MAX): string {
  const v = (name ?? "").trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // Only break on a space when it is not so early that the name says nothing.
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/**
 * Props for a span that shows the short form and the full name on hover.
 *
 * `title` is set only when the name was actually cut, so hovering a short
 * name does not pop a tooltip repeating what is already on screen.
 */
export function nameProps(name: string | null | undefined, max = NAME_MAX) {
  const v = (name ?? "").trim();
  return { children: shortName(v, max), title: v.length > max ? v : undefined };
}

/**
 * For a container that already truncates with CSS.
 *
 * Pre-cutting the text there is actively worse: the string arrives short,
 * the container clips it again, and a 39-character name lands as
 * "BHARATH BE…" instead of filling the width it has. So the full name goes
 * in, CSS decides how much fits, and `title` carries the rest.
 *
 * Use this wherever the element (or its parent) has `truncate`; use
 * `nameProps` only where the width is roomy and the cap is what bounds it.
 */
export function fullNameProps(name: string | null | undefined) {
  const v = (name ?? "").trim();
  return { children: v, title: v || undefined };
}
