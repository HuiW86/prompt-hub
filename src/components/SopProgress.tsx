import styles from "./SopProgress.module.css";

export function SopProgress() {
  return (
    <section
      className={styles.sopProgress}
      aria-label="SOP 进度"
      data-region="sop-progress"
    >
      <h3 className={styles.heading}>SOP 进度</h3>
      <p className={styles.placeholder}>第三阶段实现 · 占位</p>
    </section>
  );
}
