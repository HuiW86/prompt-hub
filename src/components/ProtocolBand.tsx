import { Route } from "lucide-react";

import { AlignmentPhrases } from "./AlignmentPhrases";
import { PhaseBar } from "./PhaseBar";
import styles from "./ProtocolBand.module.css";

// Visual container absorbed from the Promptscape design: groups the phase bar
// and alignment phrases into one "协议层" band, physically distinct from the
// task layer below (spec / constitution B2 protocol/task separation). Pure
// layout — the two children keep their own logic, data-region, and Tab landing.
export function ProtocolBand() {
  return (
    <section className={styles.band} aria-label="协议层">
      <div className={styles.head}>
        <span className={styles.pill}>
          <Route size={12} strokeWidth={2} aria-hidden />
          协议层
        </span>
      </div>
      <PhaseBar />
      <AlignmentPhrases />
    </section>
  );
}
