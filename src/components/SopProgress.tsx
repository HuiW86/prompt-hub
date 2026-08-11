import styles from "./SopProgress.module.css";

// Collapsed until phase 3 ships the real SOP navigator. A placeholder has zero
// hit probability, so it earns a single line — not the ~180px instrument card
// it used to occupy in the context rail, which was taken straight out of the
// active Scene above it. It stays RENDERED (rather than returning null) because
// every region must remain on-screen in both modes (哲学二 同屏可见) and it is
// one of the six Tab-cycle regions (03-product-spec §13.4).
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
        第三阶段实现
      </p>
    </section>
  );
}
