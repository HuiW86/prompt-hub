import { useEffect, useRef, useState } from "react";

import { useSettingsStore } from "../stores/settingsStore";
import {
  eventToAccelerator,
  formatAccelerator,
  isModifierCode,
} from "../utils/accelerator";
import { toUserMessage } from "../utils/errorMessage";

import { cx } from "./primitives/cx";
import styles from "./HotkeyRecorder.module.css";

// Shipped default, mirroring migration 0012 / settings::DEFAULT_GLOBAL_HOTKEY.
const DEFAULT_HOTKEY = "Alt+Space";

// Shown when the user pressed a chord we never received (omar 2026-08-20).
//
// This is the common conflict, and it does NOT surface as an error: whoever
// already owns the chord registers it with the OS, which consumes the keypress
// before any app sees it. So the user presses, this window sits there saying
// "按下新的组合键…", and some other application reacts instead — with nothing
// on screen to explain why. The G3 walkthrough reproduced exactly that.
//
// We can't observe the swallowed key, but we can observe its shadow: the
// modifiers are ordinary key events and arrive normally, so a modifier that
// goes down and comes back up while we captured nothing in between means the
// main key went somewhere else.
const SWALLOWED_HINT =
  "没收到完整的组合键——它可能已被其他应用占用，占用方会在系统层截走按键，本窗口收不到。换一组试试。";

// Global wake-chord editor (ADR-027). Redeems 03-product-spec §13.4's
// "默认值，可配置", which shipped as a hardcoded chord in v0.5.
//
// Recording is a deliberate mode rather than a text input: the value is a
// physical key combination, so the only honest way to enter it is to press it.
// While armed we take keydown on window in the CAPTURE phase and stop
// propagation, which is what makes the capture total — including over the
// settings modal's own ESC-to-close handler, which listens on window during
// bubble. That is intentional: in recording mode ESC means "cancel recording",
// and closing the dialog out from under the user mid-capture would leave them
// unsure whether the chord was saved. One ESC cancels, a second closes.
export function HotkeyRecorder() {
  const globalHotkey = useSettingsStore((s) => s.globalHotkey);
  const setGlobalHotkey = useSettingsStore((s) => s.setGlobalHotkey);

  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Focus returns here when recording ends, so the keyboard user is not
  // stranded after a capture.
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;

    // Per armed session: did a modifier go down, and did we handle anything at
    // all since? Refs rather than state — these gate an event handler, and
    // re-running the effect on every keystroke would tear the listener down
    // mid-gesture.
    let modifierDown = false;
    let handledSomething = false;

    const commit = async (accelerator: string) => {
      setBusy(true);
      try {
        await setGlobalHotkey(accelerator);
        setNotice(null);
      } catch (err) {
        // Rust owns the refusal reasons (unparseable / no modifier / already
        // claimed) and phrases them for the user; don't second-guess them here.
        setNotice(toUserMessage(err, "快捷键设置失败，请换一组再试"));
      } finally {
        setBusy(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Swallow everything while armed — otherwise the chord being recorded
      // also fires whatever it is currently bound to inside the app.
      e.preventDefault();
      e.stopPropagation();

      if (e.code === "Escape") {
        setRecording(false);
        return;
      }
      // Modifiers alone are the user mid-reach, not a chord yet: keep waiting.
      if (isModifierCode(e.code)) {
        modifierDown = true;
        return;
      }
      handledSomething = true;

      const accelerator = eventToAccelerator(e);
      if (!accelerator) {
        // Reachable only for a bare key. Stay armed so the user can simply add
        // a modifier and press again instead of re-entering the mode.
        setNotice("快捷键必须包含至少一个修饰键（⌘ / ⌥ / ⌃ / ⇧）");
        return;
      }
      setRecording(false);
      void commit(accelerator);
    };

    // The swallowed-chord probe. Fires on the modifier's release, not on a
    // timer: a timer would also scold a user who is merely hesitating, while
    // "held a modifier, let go, and we saw no key" is the actual signature of
    // a chord that went to another application.
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isModifierCode(e.code) || !modifierDown) return;
      modifierDown = false;
      if (handledSomething) return;
      setNotice(SWALLOWED_HINT);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [recording, setGlobalHotkey]);

  // Hand focus back once the capture ends, however it ended.
  useEffect(() => {
    if (!recording) triggerRef.current?.focus({ preventScroll: true });
  }, [recording]);

  const restoreDefault = async () => {
    setBusy(true);
    try {
      await setGlobalHotkey(DEFAULT_HOTKEY);
      setNotice(null);
    } catch (err) {
      setNotice(toUserMessage(err, "恢复默认失败，该组合键可能已被占用"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.row}>
        <span
          className={cx(styles.chord, recording && styles.recording)}
          aria-live="polite"
        >
          {recording ? "按下新的组合键…" : formatAccelerator(globalHotkey)}
        </span>
        <button
          ref={triggerRef}
          type="button"
          className={styles.button}
          disabled={busy}
          aria-pressed={recording}
          onClick={() => {
            setNotice(null);
            setRecording((armed) => !armed);
          }}
        >
          {recording ? "取消" : "更改"}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={busy || recording || globalHotkey === DEFAULT_HOTKEY}
          onClick={() => void restoreDefault()}
        >
          恢复默认
        </button>
      </div>
      {notice ? (
        <span className={styles.error} role="alert">
          {notice}
        </span>
      ) : null}
    </>
  );
}
