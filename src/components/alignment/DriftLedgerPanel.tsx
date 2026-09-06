import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { IconButton } from "../primitives";

import { DriftLedgerView } from "./DriftLedgerView";
import styles from "./driftLedger.module.css";

// The main form's on-demand host for the cue tally (03-product-spec 区域 7
// 「归因明细不在首屏」): 「主形态：点状态栏这一格，按需打开同一块内容 …… 看完即关」.
//
// Same nature as the settings dialog, and deliberately nothing more: it is NOT
// a numbered region (§13.3 stops at six) and NOT a stop in the §13.4 Tab cycle
// — a modal owns its own focus domain, which is exactly why it can hold a
// seventh surface without adding a seventh region.
//
// It holds no data guard of its own. The settings 数据 page refuses to close
// while an import runs because closing would let the user edit assets the
// import is about to overwrite; this panel only reads, so there is nothing a
// dismissal could corrupt and every dismissal path stays open.
//
// Focus return is the CALLER's job. WebKit does not focus a <button> on click,
// so "restore whatever was focused when we opened" — the settings dialog's
// approach, which works there because ⌘, leaves focus on a real element —
// would hand focus to the body here. The status bar keeps a ref to its cell
// and re-focuses it in onClose.

interface DriftLedgerPanelProps {
  onClose: () => void;
}

export function DriftLedgerPanel({ onClose }: DriftLedgerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Land on the dialog container rather than the close button: the same
    // neutral entry point SettingsModal uses, so Tab starts from the top of
    // the panel instead of from its dismissal.
    panelRef.current?.focus();

    // Escape is claimed at document CAPTURE and stopped there. App's
    // "hide the dashboard" listener sits on document in the bubble phase, so a
    // bubble-phase listener here would fire too late and the whole window would
    // hide behind the panel (the G4 D2 ordering, same as primitives/Editor).
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };

    // Tab stays inside while the panel owns the screen; without this the cycle
    // walks into the dashboard behind the scrim, which is unreachable by mouse
    // and so looks like focus has simply vanished.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="中途口令明细"
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>中途口令明细</h2>
          <IconButton aria-label="关闭" onClick={onClose}>
            <X size={14} strokeWidth={2} aria-hidden />
          </IconButton>
        </header>
        <div className={styles.body}>
          <DriftLedgerView />
        </div>
      </div>
    </div>
  );
}
