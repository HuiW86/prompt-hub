import styles from "./SopProgress.module.css";

export function SopProgress() {
  return (
    <section
      className={styles.sopProgress}
      aria-label="SOP 进度"
      aria-describedby="sop-progress-placeholder-msg"
      data-region="sop-progress"
      tabIndex={0}
    >
      <h3 className={styles.heading}>SOP 进度</h3>
      <p id="sop-progress-placeholder-msg" className={styles.placeholder}>
        第三阶段实现 · 占位
      </p>
    </section>
  );
}
