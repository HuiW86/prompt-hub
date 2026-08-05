// ScenePanel was split into a scene/ directory (W4 component architecture): the
// orchestrator owns all edit-state + store wiring, with the tab track, view
// column, phrase card, move selector, and editors as sibling modules. This
// re-export keeps every existing importer (Dashboard, ScenePanel.test.tsx)
// resolving `import { ScenePanel } from "../components/ScenePanel"` unchanged.
export { ScenePanel } from "./scene/ScenePanel";
