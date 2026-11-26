import { lazy, useState, type ComponentType } from "react";

import type { Workspace } from "../stores/appStore";

// Lazy workspace panels that can be warmed ahead of the switch.
//
// A plain React.lazy shows its Suspense fallback on the first switch even when
// the chunk is a few milliseconds away, so the user saw a 「加载中…」 frame
// between two real views. Once preloaded, the wrapper renders the resolved
// component directly — no Suspense boundary is ever hit.
function preloadable<P extends object>(load: () => Promise<ComponentType<P>>) {
  let resolved: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const preload = () => {
    pending ??= load().then(
      (c) => (resolved = c),
      (err: unknown) => {
        // Forget a failed load so the next hover / switch can try again.
        pending = null;
        throw err;
      },
    );
    return pending;
  };
  const Lazy = lazy(() => preload().then((c) => ({ default: c })));
  function Panel(props: P) {
    // Chosen once per mount: swapping Lazy for the resolved component on a
    // later render would change the element type and remount the panel,
    // dropping its local state, focus and scroll.
    const [Comp] = useState<ComponentType<P>>(() => resolved ?? Lazy);
    return <Comp {...props} />;
  }
  return { Panel, preload };
}

const website = preloadable(() =>
  import("../components/WebsitePanel").then((m) => m.WebsitePanel),
);
const skill = preloadable(() =>
  import("../components/skills/SkillPanel").then((m) => m.SkillPanel),
);

export const WebsitePanel = website.Panel;
export const SkillPanel = skill.Panel;

/** Start loading a workspace's panel chunk (no-op for eager workspaces). */
export function prefetchWorkspace(id: Workspace) {
  if (id === "websites") void website.preload().catch(() => {});
  else if (id === "skills") void skill.preload().catch(() => {});
}
