import {
  Bug,
  Code,
  DraftingCompass,
  type LucideIcon,
  Microscope,
  Pen,
  Wrench,
} from "lucide-react";

// Scene icons are user content (design-spec §12.4): a lucide name string renders
// as a lucide glyph (matching the Promptscape design稿), anything else falls back
// to raw text so emoji / single-char icons keep working. Explicit map (not the
// full lucide registry) keeps the bundle lean per §12 icon restraint. Shared by
// ScenePanel (tab / card icons) and ScenePropertiesEditor (icon preset picker).
export const SCENE_LUCIDE: Record<string, LucideIcon> = {
  "drafting-compass": DraftingCompass,
  microscope: Microscope,
  wrench: Wrench,
  pen: Pen,
  code: Code,
  bug: Bug,
};
