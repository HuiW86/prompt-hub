import { useUpdaterStore } from "../stores/updaterStore";

import styles from "./UpdaterBanner.module.css";

// Non-intrusive top banner for the auto-update flow (ADR-017 §5.3). It surfaces
// three transient states and self-hides otherwise — there is no persistent
// region, so it never enters the Tab cycle / data-region landmark set:
//   1. first-launch opt-in prompt (default-off egress requires explicit consent)
//   2. an available update (download + install is user-confirmed, never silent)
//   3. a download-in-progress / error note
export function UpdaterBanner() {
  const optInDecided = useUpdaterStore((s) => s.optInDecided);
  const status = useUpdaterStore((s) => s.status);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const acceptOptIn = useUpdaterStore((s) => s.acceptOptIn);
  const declineOptIn = useUpdaterStore((s) => s.declineOptIn);
  const dismiss = useUpdaterStore((s) => s.dismiss);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);

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
    return (
      <div className={styles.banner} role="status" aria-live="polite">
        <span className={styles.msg}>正在下载更新，完成后将自动重启…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.banner} role="alert">
        <span className={styles.msg}>更新失败，请稍后重试</span>
        <span className={styles.actions}>
          <button className={styles.ghost} onClick={dismiss}>
            关闭
          </button>
        </span>
      </div>
    );
  }

  return null;
}
