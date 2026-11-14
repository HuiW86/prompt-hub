import { useWebsiteStore } from "../stores/websiteStore";
// Alias open/confirm: their bare names collide with the window.open / window.confirm
// globals, which shadows the plugin imports in some bundler/test transforms.
import {
  confirm as confirmDialog,
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { Database, Download, Keyboard, Palette, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ipc } from "../ipc";
import {
  type Accent,
  DEFAULT_FONT_SCALE,
  type Density,
  type FontScale,
  type ThemeMode,
  useSettingsStore,
} from "../stores/settingsStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { useUpdaterStore } from "../stores/updaterStore";
import { toUserMessage } from "../utils/errorMessage";
import { primaryModifierLabel } from "../utils/platform";

import { HotkeyRecorder } from "./HotkeyRecorder";
import { TrashSection } from "./TrashSection";
import { cx } from "./primitives/cx";
import styles from "./SettingsModal.module.css";

type Tab = "appearance" | "hotkey" | "update" | "data";

// Default backup file name: prompt-hub-backup-YYYY-MM-DD.json.
function defaultBackupName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `prompt-hub-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}.json`;
}

// Segment options carry text only (issue #29): one icon per option said
// nothing the label did not, and the three text-size steps shared one glyph.
const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "comfortable", label: "舒适" },
  { value: "compact", label: "紧凑" },
];

// Text size steps (issue #25). Each step scales type only (tokens.css
// --font-scale); the result is visible the moment it is picked, so the
// percentages that used to sit beside each label were dropped (issue #29).
const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: "standard", label: "标准" },
  { value: "large", label: "大" },
  { value: "xlarge", label: "特大" },
];

const ACCENT_OPTIONS: { value: Accent; label: string; dot: string }[] = [
  { value: "neutral", label: "中性", dot: styles.dotNeutral },
  { value: "blue", label: "蓝", dot: styles.dotBlue },
  { value: "green", label: "绿", dot: styles.dotGreen },
  { value: "violet", label: "紫", dot: styles.dotViolet },
  { value: "amber", label: "琥珀", dot: styles.dotAmber },
];

const STATUS_TEXT: Record<string, string> = {
  idle: "尚未检查",
  checking: "正在检查…",
  available: "发现新版本",
  downloading: "正在下载…",
  uptodate: "已是最新版本",
  error: "检查失败",
};

// One segmented control: a single track with the options butted together and
// the picked one lifted on a solid fill. aria-pressed carries the state.
function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
  dataAttr,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Optional data-* hook stamped with each option's value (tests / styling). */
  dataAttr?: string;
}) {
  return (
    <div className={styles.segment} role="group" aria-label={label}>
      {options.map((opt) => {
        const extra: Record<string, string> = dataAttr
          ? { [dataAttr]: opt.value }
          : {};
        return (
          <button
            key={opt.value}
            type="button"
            className={cx(styles.segItem, value === opt.value && styles.active)}
            aria-pressed={value === opt.value}
            {...extra}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Settings overlay dialog absorbed from the Promptscape design, reshaped into
// macOS-style grouped rows (issue #29): each page is a stack of rounded cards,
// each row has its name and a one-line note on the left and its control on the
// right. The dialog has a fixed size so switching pages never resizes it; the
// page body scrolls inside.
export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const close = useSettingsStore((s) => s.closeSettings);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const accent = useSettingsStore((s) => s.accent);
  const setAccent = useSettingsStore((s) => s.setAccent);
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);

  const enabled = useUpdaterStore((s) => s.enabled);
  const status = useUpdaterStore((s) => s.status);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const error = useUpdaterStore((s) => s.error);
  const acceptOptIn = useUpdaterStore((s) => s.acceptOptIn);
  const declineOptIn = useUpdaterStore((s) => s.declineOptIn);
  const check = useUpdaterStore((s) => s.check);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);

  const refreshAll = usePromptStore((s) => s.refreshAll);
  const showToast = useToastStore((s) => s.show);

  const [tab, setTab] = useState<Tab>("appearance");
  // Guards the export/import buttons against re-entry while a dialog or the
  // file I/O is in flight, and carries the last data-tab status line.
  const [dataBusy, setDataBusy] = useState(false);
  const [dataStatus, setDataStatus] = useState<string | null>(null);

  // Mirror of dataBusy for the Escape listener, which is registered once per
  // open and must not be torn down (and re-run its initial-focus landing) every
  // time the flag flips. Handlers read `.current` at event time instead.
  const dataBusyRef = useRef(false);
  useEffect(() => {
    dataBusyRef.current = dataBusy;
  }, [dataBusy]);

  // Modal container ref (initial focus landing point + focus-trap boundary).
  const modalRef = useRef<HTMLDivElement>(null);
  // Element that had focus before the modal opened, to restore on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleExport = async () => {
    if (dataBusy) return;
    setDataBusy(true);
    setDataStatus(null);
    try {
      const path = await saveDialog({
        defaultPath: defaultBackupName(),
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return; // user cancelled
      await ipc.exportData(path);
      setDataStatus("已导出备份");
      showToast("已导出备份");
    } catch (err) {
      setDataStatus(
        toUserMessage(
          err,
          "导出失败：无法写入所选位置，请更换目录或检查磁盘空间后重试",
        ),
      );
    } finally {
      setDataBusy(false);
    }
  };

  const handleImport = async () => {
    if (dataBusy) return;
    setDataBusy(true);
    setDataStatus(null);
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return; // user cancelled
      const ok = await confirmDialog(
        "导入会清空当前全部资产数据并以备份内容整库替换，此操作不可撤销。确定继续？",
        { title: "导入备份", kind: "warning" },
      );
      if (!ok) return;
      const summary = await ipc.importData(path);
      const total =
        summary.modifiers +
        summary.macros +
        summary.scenes +
        summary.subStages +
        summary.phrases +
        summary.phases +
        summary.alignmentPhrases +
        summary.compositions +
        (summary.websites ?? 0) +
        (summary.websiteGroups ?? 0);
      await refreshAll();
      await useWebsiteStore.getState().refreshIfLoaded();
      setDataStatus(
        `已导入 ${total} 条记录${summary.websites == null ? "；旧备份未包含常用网站，现有网站已保留" : `（含 ${summary.websites} 个网站）`}`,
      );
      showToast("已导入备份");
    } catch (err) {
      setDataStatus(
        toUserMessage(err, "导入失败：备份文件无法读取，请确认文件存在且完整"),
      );
    } finally {
      setDataBusy(false);
    }
  };

  // Focus domain: the modal owns keyboard focus while open (product-spec.md:786
  // / design-spec.md:786 "模态弹窗有自己的焦点域"). On open we record the
  // trigger element, move focus into the dialog, and trap Tab/Shift+Tab inside;
  // on close we hand focus back to the trigger.
  useEffect(() => {
    if (!open) return;

    // Deterministic landing point (resolves the ledger's line-162 focus-落点
    // TODO): focus the dialog container itself rather than any single control,
    // matching the useRegionNav model where the container is the neutral Tab
    // entry. Arrow/Tab then roam from there.
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    modalRef.current?.focus();

    // Enumerate the currently tabbable controls inside the modal, in DOM order.
    // Recomputed on each Tab so tab-switch / disabled-state changes stay honest.
    const focusables = (): HTMLElement[] => {
      const root = modalRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    // Escape claims the key before anyone else can act on it. The modal owns
    // the screen while open, so Escape means "close the modal", never "hide
    // the dashboard" — but App's hide listener sits on `document` in the bubble
    // phase, which fires *before* a `window` bubble listener, so a late
    // stopPropagation there would be moot (G4 D2). Same convention as
    // primitives/Editor.tsx: document capture + stop. HotkeyRecorder's own
    // window-capture swallow still runs ahead of this while a chord is being
    // recorded, so Escape mid-recording only cancels the recording.
    // While an export/import is in flight the dialog also refuses to close.
    // import_json truncates every asset table and refreshAll() reloads on top
    // of it, so a dismissed modal invites the user back to the dashboard to
    // create or edit assets that the running import then wipes without a
    // trace. The key is still claimed and cancelled either way: letting it
    // fall through to App's hide listener would hide the whole dashboard
    // behind the import, which is the same accident one step removed.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (dataBusyRef.current) return;
      close();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        // Nothing tabbable — keep focus pinned to the dialog container.
        e.preventDefault();
        modalRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const root = modalRef.current;

      // Focus outside the modal (or on the container) → pull it back to an edge.
      if (!root || !(active instanceof HTMLElement) || !root.contains(active)) {
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
      // Restore focus to the opener on close/unmount (guard against a stale node
      // detached from the DOM in the interim).
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open, close]);

  if (!open) return null;

  const statusLine =
    status === "available" && availableVersion
      ? `发现新版本 ${availableVersion}`
      : (STATUS_TEXT[status] ?? "");
  const mod = primaryModifierLabel();

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        // Same guard as Escape: no dismissal while the data page is working.
        if (dataBusy) return;
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabIndex={-1}
      >
        <nav className={styles.nav} aria-label="设置分区">
          <span className={styles.navHead}>设置</span>
          <button
            type="button"
            className={cx(
              styles.navItem,
              tab === "appearance" && styles.active,
            )}
            aria-current={tab === "appearance"}
            onClick={() => setTab("appearance")}
          >
            <Palette size={14} strokeWidth={2} aria-hidden />
            外观
          </button>
          <button
            type="button"
            className={cx(styles.navItem, tab === "hotkey" && styles.active)}
            aria-current={tab === "hotkey"}
            onClick={() => setTab("hotkey")}
          >
            <Keyboard size={14} strokeWidth={2} aria-hidden />
            快捷键
          </button>
          <button
            type="button"
            className={cx(styles.navItem, tab === "update" && styles.active)}
            aria-current={tab === "update"}
            onClick={() => setTab("update")}
          >
            <Download size={14} strokeWidth={2} aria-hidden />
            更新
          </button>
          <button
            type="button"
            className={cx(styles.navItem, tab === "data" && styles.active)}
            aria-current={tab === "data"}
            onClick={() => setTab("data")}
          >
            <Database size={14} strokeWidth={2} aria-hidden />
            数据
          </button>
        </nav>

        <div className={styles.content}>
          {/* No page title here: the selected nav item already names the
              page (issue #29 V7). The bar only carries the close button. */}
          <div className={styles.contentHead}>
            {/* The third dismissal path, held to the same rule as Escape and
                the overlay — a guard that leaves the most visible close
                button live is not a guard. */}
            <button
              type="button"
              className={styles.close}
              aria-label="关闭"
              disabled={dataBusy}
              onClick={close}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {tab === "appearance" ? (
            <div className={styles.body}>
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>显示</span>
                </div>
                <div className={styles.card}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>主题</span>
                    </div>
                    <div className={styles.rowControl}>
                      <Segment
                        label="主题模式"
                        options={THEME_OPTIONS}
                        value={themeMode}
                        onChange={setThemeMode}
                      />
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>字号</span>
                      <span className={styles.rowHint}>
                        <span className={styles.nowrap}>{mod}= 放大</span>
                        {" · "}
                        <span className={styles.nowrap}>{mod}− 缩小</span>
                        {" · "}
                        <span className={styles.nowrap}>{mod}0 恢复默认</span>
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      <Segment
                        label="字号"
                        options={FONT_SCALE_OPTIONS}
                        value={fontScale}
                        onChange={setFontScale}
                        dataAttr="data-font-scale"
                      />
                      <button
                        type="button"
                        className={styles.resetBtn}
                        data-font-scale-reset
                        aria-label="恢复默认字号"
                        disabled={fontScale === DEFAULT_FONT_SCALE}
                        onClick={() => setFontScale(DEFAULT_FONT_SCALE)}
                      >
                        恢复默认
                      </button>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>密度</span>
                      <span className={styles.rowHint}>
                        紧凑档一屏放下更多条目，字号不变
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      <Segment
                        label="密度"
                        options={DENSITY_OPTIONS}
                        value={density}
                        onChange={setDensity}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>颜色</span>
                </div>
                <div className={styles.card}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>强调色</span>
                    </div>
                    <div className={styles.rowControl}>
                      <div
                        className={styles.swatches}
                        role="group"
                        aria-label="强调色"
                      >
                        {ACCENT_OPTIONS.map(({ value, label, dot }) => (
                          <button
                            key={value}
                            type="button"
                            className={cx(
                              styles.swatch,
                              accent === value && styles.active,
                            )}
                            aria-pressed={accent === value}
                            aria-label={label}
                            title={label}
                            onClick={() => setAccent(value)}
                          >
                            <span className={cx(styles.dot, dot)} aria-hidden />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* A coloured swatch also takes over --brand (tokens.css §1b
                    :root.accent-*, ADR-024 补遗); neutral leaves the brand
                    violet alone. Too long to share a line with five dots, so
                    it sits under the card. */}
                <span className={styles.groupNote}>
                  主色 · 标记、Macro 芯片、当前相位与焦点一起换；中性保留品牌紫
                </span>
              </div>
            </div>
          ) : tab === "hotkey" ? (
            <div className={styles.body}>
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>全局唤起</span>
                </div>
                <div className={styles.card}>
                  {/* HotkeyRecorder renders its chord row plus an optional
                      notice as siblings; .rowWrap lets the notice drop to a
                      full-width line under the row. */}
                  <div className={cx(styles.row, styles.rowWrap)}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>唤起快捷键</span>
                      <span className={styles.rowHint}>
                        任何应用中按下即唤起，须含修饰键
                      </span>
                    </div>
                    <HotkeyRecorder />
                  </div>
                </div>
                <span className={styles.groupNote}>
                  被其他应用占用时会提示，换一组即可。
                </span>
              </div>
            </div>
          ) : tab === "update" ? (
            <div className={styles.body}>
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>软件更新</span>
                </div>
                <div className={styles.card}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>自动检查更新</span>
                      <span className={styles.rowHint}>
                        启动时向 GitHub 查询，仅发送版本号
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      <button
                        type="button"
                        className={cx(styles.toggle, enabled && styles.on)}
                        role="switch"
                        aria-checked={enabled}
                        aria-label="自动检查更新"
                        onClick={() =>
                          enabled ? declineOptIn() : acceptOptIn()
                        }
                      >
                        <span className={styles.knob} aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>版本状态</span>
                      <span
                        className={cx(
                          styles.rowHint,
                          status === "error" && styles.statusError,
                        )}
                      >
                        {error && status === "error" ? error : statusLine}
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      {status === "available" ? (
                        <button
                          type="button"
                          className={cx(styles.actionBtn, styles.actionPrimary)}
                          onClick={() => void downloadAndInstall()}
                        >
                          下载并安装
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={
                            !enabled ||
                            status === "checking" ||
                            status === "downloading"
                          }
                          onClick={() => void check(true)}
                        >
                          检查更新
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.body}>
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>备份</span>
                </div>
                <div className={styles.card}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>导出</span>
                      {/* Export carries the trash too (product-spec §13.3
                          区域 9, ADR-028 子决策 6) — say so. */}
                      <span className={styles.rowHint}>
                        全部资产（含废纸篓，不含使用记录）存为本地 JSON
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={dataBusy}
                        onClick={() => void handleExport()}
                      >
                        导出备份…
                      </button>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowLabel}>导入</span>
                      <span className={styles.rowHint}>
                        用备份整库覆盖当前数据，不可撤销
                      </span>
                    </div>
                    <div className={styles.rowControl}>
                      {/* Amber text marks the destructive one of the pair
                          (issue #29 V5); the confirm dialog still gates it. */}
                      <button
                        type="button"
                        className={cx(styles.actionBtn, styles.actionDanger)}
                        disabled={dataBusy}
                        onClick={() => void handleImport()}
                      >
                        导入备份…
                      </button>
                    </div>
                  </div>
                </div>
                {dataStatus ? (
                  <div className={styles.statusRow}>
                    <span>{dataStatus}</span>
                  </div>
                ) : null}
              </div>

              {/* ADR-028 P1. Mounted only under this tab, which is also what
                  loads it: the section re-reads the trash whenever the 数据 page
                  is opened, so it can never show a stale list — including the
                  item the user deleted seconds ago while the 撤销 toast is
                  still up. */}
              <TrashSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
