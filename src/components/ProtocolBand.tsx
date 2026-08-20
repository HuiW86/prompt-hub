import { AlignmentPhrases } from "./AlignmentPhrases";
import { PhaseBar } from "./PhaseBar";
import styles from "./ProtocolBand.module.css";

// Visual container absorbed from the Promptscape design: groups the phase bar
// and alignment phrases into one "协议层" band, physically distinct from the
// task layer below (spec / constitution B2 protocol/task separation). Pure
// layout — the two children keep their own logic, data-region, and Tab landing.
//
// The "协议层" text pill was removed 2026-08-20 (omar): the dark band already
// says which layer this is, so the label was the interface narrating its own
// architecture. The layer identity is NOT lost — it moved nowhere, it was
// always carried by the band. Contrast ModifierGrid's pill, which is kept
// precisely because that panel sits in the aside column with no band to read
// the layer from. `aria-label` keeps the name for assistive tech.
export function ProtocolBand() {
  return (
    <section className={styles.band} aria-label="协议层">
      <PhaseBar />
      <AlignmentPhrases />
    </section>
  );
}
