import { useUpdaterStore } from "../stores/updaterStore";

import styles from "./UpdaterBanner.module.css";

// Non-intrusive top banner for the auto-update flow (ADR-017 §5.3). It surfaces
// three transient states and self-hides otherwise — there is no persistent
// region, so it never enters the Tab cycle / data-region landmark set:
//   1. first-launch opt-in prompt (default-off egress requires explicit consent)
//   2. an available update (download + install is user-confirmed, never silent)
//   3. a download-in-progress note
// Check FAILURES deliberately do not banner (UI reshape / ADR-023): a failed
// background check is low-priority chrome news — StatusBar's 检查更新 entry
// carries the failure label and doubles as the retry path.
export function UpdaterBanner() {
  const optInDecided = useUpdaterStore((s) => s.optInDecided);
  const status = useUpdaterStore((s) => s.status);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const acceptOptIn = useUpdaterStore((s) => s.acceptOptIn);
  const declineOptIn = useUpdaterStore((s) => s.declineOptIn);
  const dismiss = useUpdaterStore((s) => s.dismiss);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);
  const downloadProgress = useUpdaterStore((s) => s.downloadProgress);

  if (!optInDecided) {
    return (
      <div className={styles.banner} role="region" aria-label="更新检查授权">
        <span className={styles.msg}>
          是否启用更新检查？启用后应用会在启动时向 GitHub
          查询新版本（仅发送版本号，可随时关闭）。
        </span>
        <span className={styles.actions}>
          <button className={styles.primary} onClick={acceptOptIn}>
            启用
          </button>
          <button className={styles.ghost} onClick={declineOptIn}>
            暂不
          </button>
        </span>
      </div>
    );
  }

  if (status === "available") {
    return (
      <div className={styles.banner} role="region" aria-label="发现新版本">
        <span className={styles.msg}>发现新版本 {availableVersion}</span>
        <span className={styles.actions}>
          <button className={styles.primary} onClick={downloadAndInstall}>
            下载并安装
          </button>
          <button className={styles.ghost} onClick={dismiss}>
            稍后
          </button>
        </span>
      </div>
    );
  }

  if (status === "downloading") {
    // Determinate when the server reported a Content-Length (progress in
    // [0, 1]); otherwise indeterminate — show a running-state bar without a
    // percentage so the user still sees the download hasn't stalled.
    const hasPercent = downloadProgress !== null;
    const percent = hasPercent ? Math.round(downloadProgress * 100) : null;
    return (
      <div className={styles.banner} role="status" aria-live="polite">
        <span className={styles.msg}>
          {hasPercent
            ? `正在下载更新 ${percent}%，完成后将自动重启…`
            : "正在下载更新，完成后将自动重启…"}
          <span
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <span
              className={
                hasPercent ? styles.progressFill : styles.progressIndeterminate
              }
              style={hasPercent ? { width: `${percent}%` } : undefined}
            />
          </span>
        </span>
        <span className={styles.actions}>
          <button className={styles.primary} disabled aria-busy="true">
            下载中…
          </button>
        </span>
      </div>
    );
  }

  return null;
}
