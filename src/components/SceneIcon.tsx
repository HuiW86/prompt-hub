import { SCENE_LUCIDE } from "./sceneIcons";

// Renders a Scene's icon field: a known lucide name → its glyph, anything else
// (emoji / single char) → raw text. See sceneIcons.ts for the map rationale.
export function SceneIcon({
  name,
  size,
  className,
}: {
  name: string | null;
  size: number;
  className?: string;
}) {
  if (!name) return null;
  const Lucide = SCENE_LUCIDE[name];
  if (Lucide)
    return (
      <Lucide size={size} className={className} aria-hidden strokeWidth={2} />
    );
  return (
    <span className={className} aria-hidden>
      {name}
    </span>
  );
}
