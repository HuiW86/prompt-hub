import { useEffect, useState } from "react";

import { ipc } from "../ipc";
import { useSettingsStore } from "../stores/settingsStore";
import { formatAccelerator } from "../utils/accelerator";

import styles from "./HotkeyBanner.module.css";

// One-shot warning banner for a failed global-shortcut registration. The Rust
// setup hook records the outcome in AppState (register() typically fails when
// another app already owns the chord); we query it once at mount and, on
// failure, surface a dismissible alert so the user isn't left pressing a dead
// hotkey with no feedback. Mirrors UpdaterBanner's transient-top-banner model
// but with its own styles (that component is owned elsewhere). Never enters the
// Tab cycle / data-region set — it self-removes once dismissed or once we learn
// the hotkey is fine.
//
// The chord is read from the store rather than written into the copy: since
// ADR-027 it is user-configurable, and a banner naming a chord the user no
// longer uses would send them looking for the wrong conflict.
type Probe = "pending" | "ok" | "failed";

export function HotkeyBanner() {
  const [probe, setProbe] = useState<Probe>("pending");
  const [dismissed, setDismissed] = useState(false);
  const globalHotkey = useSettingsStore((s) => s.globalHotkey);
  const openSettings = useSettingsStore((s) => s.openSettings);

  useEffect(() => {
    let alive = true;
    // A single query off the wake hot path (that path is the Rust
    // global-shortcut handler — untouched here), so it can't threaten C1. On a
    // dev/web shell where the bridge is absent, treat any error as "ok" so we
    // never flash a false warning.
    ipc
      .hotkeyRegistered()
      .then((registered) => {
        if (alive) setProbe(registered ? "ok" : "failed");
      })
      .catch(() => {
        if (alive) setProbe("ok");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (probe !== "failed" || dismissed) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.msg}>
        全局快捷键 {formatAccelerator(globalHotkey)}{" "}
        注册失败，唤起可能无响应。它多半已被其他应用占用——
        换一组组合键通常比让对方让路更快。
      </span>
      <span className={styles.actions}>
        {/* Since ADR-027 the conflict is fixable from inside the app, so the
            banner offers the fix rather than only reporting the problem. */}
        <button
          className={styles.ghost}
          onClick={() => {
            openSettings();
            setDismissed(true);
          }}
        >
          更改快捷键
        </button>
        <button className={styles.ghost} onClick={() => setDismissed(true)}>
          关闭
        </button>
      </span>
    </div>
  );
}
