import {
  type ComponentPropsWithRef,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAnchoredPosition } from "../../hooks/useAnchoredPosition";

import { cx, type Layer } from "./cx";
import styles from "./primitives.module.css";

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input className={cx(styles.input, className)} {...rest} />;
}

export function EditorInput({
  className,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cx(styles.editorInput, className)} {...rest} />;
}

interface EditorPanelProps extends ComponentPropsWithRef<"div"> {
  layer?: Layer;
}

export function EditorPanel({
  layer = "neutral",
  className,
  ...rest
}: EditorPanelProps) {
  return (
    <div
      className={cx(styles.editorPanel, styles[layer], className)}
      {...rest}
    />
  );
}

export function EditorActions({
  className,
  ...rest
}: ComponentPropsWithRef<"div">) {
  return <div className={cx(styles.editorActions, className)} {...rest} />;
}

/** Why the panel is closing — the caller decides what that means for the draft
 *  (ADR-025 子决策 2 的规则表). */
export type DismissReason = "outside" | "escape";

export interface AnchoredEditorProps {
  /** Element the panel pins to; also where focus returns on close. */
  anchor: HTMLElement | null;
  open: boolean;
  layer?: Layer;
  /** Localised aria-label for the panel (e.g. "编辑话术"). */
  ariaLabel: string;
  className?: string;
  onDismiss: (reason: DismissReason) => void;
  children: ReactNode;
}

// Editing surface that leaves the host's document flow (ADR-025 子决策 1).
//
// The panel renders into the TOP LAYER via the native `popover` attribute
// rather than a React portal. That distinction is the whole point: a portal
// would move the DOM node out of the protocol band, and the band's ~20 token
// remaps (--fg-1 / --surface-1 / --accent …) are plain CSS inheritance
// (ADR-020) — the panel would render dark text on dark ground. The top layer
// changes only paint and stacking, so the ancestor chain, and therefore every
// inherited custom property, survives intact.
//
// Three long-standing traps fall out for free: ancestor `overflow: hidden` no
// longer clips (the trigger bug — the host row is 44px tall with a hidden
// overflow, which made 保存/取消 unreachable), z-index competition is moot, and
// the hover-lift `transform` on Macro / Scene cards can no longer capture the
// panel as a containing block.
//
// Dismissal is ours, not the platform's: native light-dismiss only hides, and
// 子决策 2 requires "click outside = save and close". So the popover is
// `manual` and this component reports intent; the caller applies the rules.
export function AnchoredEditor({
  anchor,
  open,
  layer = "neutral",
  ariaLabel,
  className,
  onDismiss,
  children,
}: AnchoredEditorProps) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const position = useAnchoredPosition(anchor, panel, open);

  // Keep the dismiss callback out of the listener effects' dependency lists:
  // it is re-created every render by callers that close over draft state, and
  // re-subscribing a pointerdown listener mid-interaction drops the event.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Anchor is read through a ref by the unmount cleanup, which must see the
  // latest one without re-running (a re-run would steal focus mid-edit).
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  // Promoted into the TOP LAYER here rather than in an effect, on purpose: ref
  // callbacks run during commit, before any effect, and until the popover is
  // shown the UA sheet keeps it `display: none` — so a child's mount-time
  // autofocus (PhraseFormEditor focusing the name field) would land on an
  // unfocusable element and silently do nothing.
  // Whether focus was inside the panel, sampled while it still is.
  const heldFocusRef = useRef(false);

  const attachPanel = useCallback((el: HTMLDivElement | null) => {
    setPanel(el);
    if (!el) return;
    // Not every environment has the API (older webviews); mounting plainly is
    // better than throwing, even though the panel would then be flow-bound.
    if (typeof el.showPopover === "function") el.showPopover();
  }, []);

  useEffect(() => {
    if (!open || !panel) return;

    // pointerdown, not click: a click fires after the mousedown already moved
    // focus, so a "save on outside" that waited for click would race the blur.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panel.contains(target)) return;
      // Pressing the anchor itself is a toggle, not an outside dismissal —
      // letting it through would save here and immediately re-open there.
      if (anchor?.contains(target)) return;
      dismissRef.current("outside");
    };

    // Escape is handled here as well as in the form fields: the panel can hold
    // focus on a non-input (a button, or the panel itself), where the fields'
    // own handlers never see the key.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!panel.contains(document.activeElement)) return;
      // Native popover close-on-Esc would skip our discard semantics.
      e.preventDefault();
      e.stopPropagation();
      dismissRef.current("escape");
    };

    // Whether focus lives in the panel has to be tracked as it happens: by the
    // time the teardown below runs, React has already detached the panel, so
    // asking "does it contain activeElement" would always answer no (the answer
    // is `body`). Seeded from the current state because the child's mount-time
    // autofocus has already fired by the time this effect gets to run.
    heldFocusRef.current = panel.contains(document.activeElement);
    const onFocusIn = () => {
      heldFocusRef.current = panel.contains(document.activeElement);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [open, panel, anchor]);

  // Focus returns to the trigger when the panel goes away, so a keyboard user
  // lands back on the chip they opened rather than at the top of the region.
  // Empty deps: this must fire exactly once, on teardown. Anything in the list
  // would make it re-run mid-edit and yank focus out of the field being typed
  // into.
  useEffect(
    () => () => {
      // A dismissal caused by clicking some other control must leave that
      // control focused, so this only reclaims focus the panel actually held.
      // Safe against the click case even so: pointerdown (and this teardown)
      // run before mousedown's default focus, which then wins.
      if (heldFocusRef.current) anchorRef.current?.focus();
    },
    [],
  );

  if (!open) return null;

  return (
    <div
      ref={attachPanel}
      popover="manual"
      role="group"
      aria-label={ariaLabel}
      className={cx(styles.anchoredEditor, styles[layer], className)}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        // Until the first measurement lands the panel has no honest place to
        // be; hiding it for that one layout pass avoids a flash at (0,0).
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
}
