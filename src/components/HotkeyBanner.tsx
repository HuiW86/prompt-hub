import { useEffect, useState } from "react";

import { ipc } from "../ipc";

import styles from "./HotkeyBanner.module.css";

// One-shot warning banner for a failed ⌥Space global-shortcut registration. The
// Rust setup hook records the outcome in AppState (register() typically fails
// when another app already owns the chord); we query it once at mount and, on
// failure, surface a dismissible alert so the user isn't left pressing a dead
// hotkey with no feedback. Mirrors UpdaterBanner's transient-top-banner model
// but with its own styles (that component is owned elsewhere). Never enters the
// Tab cycle / data-region set — it self-removes once dismissed or once we learn
// the hotkey is fine.
type Probe = "pending" | "ok" | "failed";

export function HotkeyBanner() {
  const [probe, setProbe] = useState<Probe>("pending");
  const [dismissed, setDismissed] = useState(false);

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
        全局快捷键 ⌥Space 注册失败，唤起可能无响应。它多半已被其他应用占用——请到
        系统设置检查快捷键冲突，或退出占用该组合键的应用后重启本应用。
      </span>
      <span className={styles.actions}>
        <button className={styles.ghost} onClick={() => setDismissed(true)}>
          关闭
        </button>
      </span>
    </div>
  );
}
