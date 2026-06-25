import {
  Check,
  Download,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCw,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  type Accent,
  type ThemeMode,
  useSettingsStore,
} from "../stores/settingsStore";
import { useUpdaterStore } from "../stores/updaterStore";

import { cx } from "./primitives/cx";
import styles from "./SettingsModal.module.css";

type Tab = "appearance" | "update";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
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

// Settings overlay dialog absorbed from the Promptscape design. Two panes:
// 外观 (theme mode + accent swatch, wired to settingsStore) and 更新 (the
// ADR-017 opt-in egress switch + manual check/install, wired to updaterStore).
export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const close = useSettingsStore((s) => s.closeSettings);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const accent = useSettingsStore((s) => s.accent);
  const setAccent = useSettingsStore((s) => s.setAccent);

  const enabled = useUpdaterStore((s) => s.enabled);
  const status = useUpdaterStore((s) => s.status);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const error = useUpdaterStore((s) => s.error);
  const acceptOptIn = useUpdaterStore((s) => s.acceptOptIn);
  const declineOptIn = useUpdaterStore((s) => s.declineOptIn);
  const check = useUpdaterStore((s) => s.check);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);

  const [tab, setTab] = useState<Tab>("appearance");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const statusLine =
    status === "available" && availableVersion
      ? `发现新版本 ${availableVersion}`
      : (STATUS_TEXT[status] ?? "");

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
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
            className={cx(styles.navItem, tab === "update" && styles.active)}
            aria-current={tab === "update"}
            onClick={() => setTab("update")}
          >
            <Download size={14} strokeWidth={2} aria-hidden />
            更新
          </button>
        </nav>

        <div className={styles.content}>
          <div className={styles.contentHead}>
            <span className={styles.contentTitle}>
              {tab === "appearance" ? "外观" : "更新"}
            </span>
            <button
              type="button"
              className={styles.close}
              aria-label="关闭"
              onClick={close}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {tab === "appearance" ? (
            <div className={styles.body}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>主题模式</span>
                <div
                  className={styles.segment}
                  role="group"
                  aria-label="主题模式"
                >
                  {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={cx(
                        styles.segItem,
                        themeMode === value && styles.active,
                      )}
                      aria-pressed={themeMode === value}
                      onClick={() => setThemeMode(value)}
                    >
                      <Icon size={13} strokeWidth={2} aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>强调色</span>
                <span className={styles.fieldHint}>
                  仅作用于品牌标记、主操作与焦点环，不影响协议层 /
                  任务层语义色。
                </span>
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
                      {accent === value && (
                        <Check
                          size={12}
                          strokeWidth={3}
                          className={styles.check}
                          aria-hidden
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.body}>
              <div className={styles.field}>
                <div className={styles.toggleRow}>
                  <span className={styles.toggleText}>
                    <span className={styles.fieldLabel}>自动检查更新</span>
                    <span className={styles.fieldHint}>
                      启用后应用会在启动时向 GitHub
                      查询新版本（仅发送版本号，可随时关闭）。
                    </span>
                  </span>
                  <button
                    type="button"
                    className={cx(styles.toggle, enabled && styles.on)}
                    role="switch"
                    aria-checked={enabled}
                    aria-label="自动检查更新"
                    onClick={() => (enabled ? declineOptIn() : acceptOptIn())}
                  >
                    <span className={styles.knob} aria-hidden />
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <div
                  className={cx(
                    styles.statusRow,
                    status === "error" && styles.statusError,
                  )}
                >
                  {status === "checking" || status === "downloading" ? (
                    <RefreshCw size={13} strokeWidth={2} aria-hidden />
                  ) : null}
                  <span>
                    {error && status === "error" ? error : statusLine}
                  </span>
                </div>
                <div className={styles.actions}>
                  {status === "available" ? (
                    <button
                      type="button"
                      className={cx(styles.actionBtn, styles.actionPrimary)}
                      onClick={() => void downloadAndInstall()}
                    >
                      <Download size={13} strokeWidth={2} aria-hidden />
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
                      <RotateCw size={13} strokeWidth={2} aria-hidden />
                      检查更新
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
