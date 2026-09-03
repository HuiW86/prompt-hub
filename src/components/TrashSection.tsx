import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ipc } from "../ipc";
import type { AssetKind, TrashEntry } from "../ipc";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";
import { relativeTime } from "../utils/time";

import { ConfirmInline, EmptyState, ListRowSurface } from "./primitives";
import styles from "./TrashSection.module.css";

// ADR-028 P1 — the trash view. It lives on the settings 数据 page rather than on
// the dashboard because ADR-026 froze the dashboard at six regions (子决策 4 /
// ADR-028 §5), and because this is a place you visit after a mistake, not a
// place you work.
//
// STATE LIVES HERE, NOT IN THE STORE. promptStore models the LIVE working set —
// the collections the dashboard renders — and a trashed row is by definition not
// in it; parking the trash there would wake every dashboard subscriber on a
// change only this pane can see. The list also has to be fresh, not merely
// present: another window can delete or purge behind our back, so it is re-read
// on open and after every mutation regardless of where it were cached. Mount is
// that trigger — SettingsModal renders nothing while closed and renders this only
// under the 数据 tab, so the component mounts exactly when the page opens and its
// state dies with it. Nothing to invalidate. (`src/ipc/index.ts` records the same
// division: the trash is an ipc-only surface, modelled by no store.)

/// The seven kinds in the words the rest of the product uses for them: the four
/// English ones are the asset-layer names the regions and the draft inbox
/// display, the three Chinese ones match the nouns the delete toasts speak.
const KIND_LABEL: Record<AssetKind, string> = {
  modifier: "Modifier",
  macro: "Macro",
  composition: "Composition",
  alignment_phrase: "对齐话术",
  phrase: "话术",
  scene: "场景",
  sub_stage: "子阶段",
};

type LoadPhase = "loading" | "ready" | "error";

export function TrashSection() {
  const restoreAsset = usePromptStore((s) => s.restoreAsset);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);

  const [entries, setEntries] = useState<TrashEntry[]>([]);
  // The count is the whole of what 子决策 4 traded auto-expiry for, so it must
  // never be guessed: "0 项" before the read lands would be a lie, hence a
  // phase separate from an empty array.
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Mounted flag: a settings close mid-flight must not write into a dead tree.
  const liveRef = useRef(true);
  // Synchronous in-flight latch. `busy` drives the disabled attribute, but state
  // updates are async — two clicks inside one tick would both pass a state
  // check. purge_trash hard-deletes, so "at most once" has to hold against a
  // double press and against a re-render landing between the two.
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const rows = await ipc.listTrash();
      if (!liveRef.current) return;
      setEntries(rows);
      setPhase("ready");
    } catch (err) {
      if (!liveRef.current) return;
      // Do NOT fall back to an empty list: "废纸篓是空的" on a failed read tells
      // the user their deletions are gone, which is the one thing this feature
      // exists to disprove.
      setPhase("error");
      setStatus(toUserMessage(err, "读取废纸篓失败，请重新打开设置"));
    }
  }, []);

  useEffect(() => {
    liveRef.current = true;
    void load();
    return () => {
      liveRef.current = false;
    };
  }, [load]);

  async function handleRestore(entry: TrashEntry) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      // The store action, not a bare ipc call: putting a row back also re-syncs
      // the collection it rejoined and the Recent list whose usage rows resolve
      // again (trashSlice), which this pane has no business reimplementing.
      await restoreAsset(entry.kind, entry.id);
      showToast(`已恢复「${entry.label}」`);
    } catch (err) {
      // Same funnel a failed 撤销 uses (useUndoableDelete): a restore that did
      // not happen must never be swallowed into something that looks like one
      // that did. The likely cause — the row was purged from another window —
      // maps to 「目标不存在，可能已被删除，请刷新后重试。」
      showError(toUserMessage(err, "恢复失败"));
    } finally {
      // Reconcile either way. On success the row left the trash; on failure it
      // may have left for a reason we did not cause.
      await load();
      inFlightRef.current = false;
      if (liveRef.current) setBusy(false);
    }
  }

  async function handlePurge() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    // Disarm before the await: this is the only irreversible action left in the
    // app, and an armed 确认 sitting on screen through a round-trip is an
    // invitation to press it again.
    setConfirming(false);
    setStatus(null);
    try {
      const summary = await ipc.purgeTrash();
      // The receipt goes to the status line rather than the toast because it
      // carries numbers and a success toast clears in under a second — the same
      // reason 导入备份 reports 「已导入 N 条记录」 there.
      setStatus(
        `已彻底删除 ${summary.assets} 项资产与 ${summary.usageRecords} 条使用记录`,
      );
      showToast("已清空废纸篓");
    } catch (err) {
      setStatus(toUserMessage(err, "清空废纸篓失败，请稍后重试"));
    } finally {
      await load();
      inFlightRef.current = false;
      if (liveRef.current) setBusy(false);
    }
  }

  const count = entries.length;
  const ready = phase === "ready";

  return (
    <section className={styles.section} aria-label="废纸篓">
      <div className={styles.head}>
        <span className={styles.label}>废纸篓</span>
        {ready ? <span className={styles.count}>{count} 项</span> : null}
      </div>
      <span className={styles.hint}>
        删除的资产会留在这里，不会自动清除，也不会出现在仪表盘或搜索中。
        恢复后它回到原来的位置，使用历史一并回来。
      </span>

      {phase === "loading" ? (
        <span className={styles.hint}>正在读取…</span>
      ) : ready && count === 0 ? (
        <EmptyState>废纸篓是空的</EmptyState>
      ) : ready ? (
        <div className={styles.list} role="list" aria-label="废纸篓条目">
          {entries.map((entry) => (
            <ListRowSurface
              key={`${entry.kind}:${entry.id}`}
              role="listitem"
              className={styles.row}
            >
              <span className={styles.kind}>{KIND_LABEL[entry.kind]}</span>
              <span className={styles.name}>{entry.label}</span>
              <span className={styles.time}>
                {relativeTime(entry.deletedAt)}
              </span>
              <button
                type="button"
                className={styles.rowBtn}
                // The name, not just the verb: a column of identical 「恢复」
                // buttons tells a screen-reader user nothing about which row
                // they are on.
                aria-label={`恢复「${entry.label}」`}
                disabled={busy}
                onClick={() => void handleRestore(entry)}
              >
                <RotateCcw size={13} strokeWidth={2} aria-hidden />
                恢复
              </button>
            </ListRowSurface>
          ))}
        </div>
      ) : null}

      <div className={styles.actions}>
        {confirming ? (
          // The last confirm in the app (子决策 3). It survived the cull because
          // it is the only step here that cannot be undone, so it has to say
          // both what goes and that nothing brings it back.
          <ConfirmInline
            text={`彻底删除废纸篓中的 ${count} 项，删除后无法恢复`}
            confirmLabel="确认清空"
            cancelLabel="取消"
            onConfirm={() => void handlePurge()}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <button
            type="button"
            className={styles.button}
            disabled={busy || !ready || count === 0}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={13} strokeWidth={2} aria-hidden />
            清空废纸篓
          </button>
        )}
      </div>

      {status ? (
        <div className={styles.status}>
          <span>{status}</span>
        </div>
      ) : null}
    </section>
  );
}
