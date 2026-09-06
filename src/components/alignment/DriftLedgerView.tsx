import { useEffect, useRef, useState } from "react";

import { ipc } from "../../ipc";
import type { AnchorDrift, AxisTally, DriftLedger } from "../../ipc/types";
import { useToastStore } from "../../stores/toastStore";
import { CUE_AXIS_LABELS, CUE_AXIS_ORDER } from "../../utils/alignmentCopyText";
import { toUserMessage } from "../../utils/errorMessage";

import styles from "./driftLedger.module.css";

// The cue tally, in full (ADR-029 子决策 4 / 03-product-spec 区域 7
// 「归因明细不在首屏」 / 06-prd §5.7).
//
// ONE component, two hosts. The main form opens it on demand from the status
// bar cell; the aux form will embed this same element in its status dashboard.
// 01-spec §8.7 forbids two independent UIs for one thing, so the modal chrome
// (scrim, Escape, ×) belongs to the host — DriftLedgerPanel — and never to this
// file. Everything here renders inline in whatever box it is given.
//
// EVERY NUMBER HERE IS A COUNT, NEVER A VERDICT. 01-spec §8.1 permanently
// forbids the app from judging alignment, so there is no threshold, no rating,
// no medal, no colour scale and no advice anywhere in this component. The
// user-facing noun is 「中途口令」 everywhere, because a copied cue is the only
// thing the app actually observed — anything stronger would decide on the
// user's behalf that the preceding turn had gone wrong (03-product-spec 区域 7
// 「措辞是刻意的」). A unit test greps this file for the banned words.
//
// STATE LIVES HERE, NOT IN THE STORE — the same division TrashSection records.
// promptStore models the live working set; this is a derived read over
// `usage_records` that is stale the moment the next copy lands, so it is
// re-read on mount (i.e. on open) and dies with the component.

type LoadPhase = "loading" | "ready" | "error";

const ZERO: AxisTally = { form: 0, layer: 0, domain: 0, mode: 0 };

function add(a: AxisTally, b: AxisTally): AxisTally {
  return {
    form: a.form + b.form,
    layer: a.layer + b.layer,
    domain: a.domain + b.domain,
    mode: a.mode + b.mode,
  };
}

function total(t: AxisTally): number {
  return t.form + t.layer + t.domain + t.mode;
}

/** before + after — always the anchor's whole tally, split or not. */
function whole(anchor: AnchorDrift): AxisTally {
  return add(anchor.before, anchor.after);
}

/** Calendar day of a revision, local time. No time-of-day: the split point is
 *  read as "which side of the rewrite", not as a moment. */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function TallyCells({ tally }: { tally: AxisTally }) {
  return (
    <>
      {CUE_AXIS_ORDER.map((axis) => (
        <td key={axis} className={styles.num}>
          {tally[axis]}
        </td>
      ))}
      <td className={styles.num}>{total(tally)}</td>
    </>
  );
}

export function DriftLedgerView() {
  const showError = useToastStore((s) => s.showError);

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [ledger, setLedger] = useState<DriftLedger | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // A close mid-flight must not write into a dead tree.
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    void (async () => {
      try {
        const next = await ipc.summarizeDriftLedger();
        if (!liveRef.current) return;
        setLedger(next);
        setPhase("ready");
      } catch (err) {
        if (!liveRef.current) return;
        // A failed read must NOT fall through to the empty state. 「还没有记到
        // 中途口令」 is a claim about the data, and making it on the strength of
        // a broken query tells the user their history is empty when it is only
        // unreadable — the same trap TrashSection documents for the trash list.
        const text = toUserMessage(err, "中途口令明细读取失败，请重新打开");
        setMessage(text);
        setPhase("error");
        showError(text);
      }
    })();
    return () => {
      liveRef.current = false;
    };
  }, [showError]);

  if (phase === "loading") {
    return <p className={styles.status}>读取中…</p>;
  }
  if (phase === "error" || ledger == null) {
    return (
      <p className={styles.status} role="alert">
        {message ?? "中途口令明细读取失败，请重新打开"}
      </p>
    );
  }

  // Zero is never printed as a total. "0" reads as "nothing ever went wrong",
  // while the fact on hand is only "the cues have not been used" — two very
  // different statements (06-prd §5.7 空状态分两层).
  if (ledger.liveCueTotal === 0) {
    return <p className={styles.empty}>还没有记到中途口令</p>;
  }

  // Sorted by count, descending. Sorting is how a table is read, not a verdict
  // about the phrases in it: no position number, no highlight, no superlative
  // is attached to any row. Array.prototype.sort is stable, so equal counts
  // keep the order the ledger returned them in (first use), which means no
  // tiebreaker has to be invented.
  const anchors = [...ledger.anchors].sort(
    (a, b) => total(whole(b)) - total(whole(a)),
  );

  const perAxis = anchors.reduce((acc, a) => add(acc, whole(a)), ZERO);
  const filed = total(perAxis);
  // Cues that reached an anchor but no column: 「停」 (a halt, filed nowhere by
  // design) and cues whose own phrase is now in the trash. Derived rather than
  // returned, and stated out loud so the three lines below plus the table add
  // up to the total exactly.
  //
  // It cannot come out negative: the ledger files every counted cue in exactly
  // one of the three buckets. Left unclamped for that reason — a floor here
  // would turn a reconciliation into a number that always looks right.
  const noAxis = ledger.liveCueTotal - ledger.unattributed - filed;

  return (
    <div className={styles.view}>
      <section className={styles.section}>
        <h3 className={styles.heading}>按开场话术</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={`${styles.colHead} ${styles.nameCol}`}>
                开场话术
              </th>
              {CUE_AXIS_ORDER.map((axis) => (
                <th
                  key={axis}
                  scope="col"
                  className={`${styles.colHead} ${styles.num}`}
                >
                  {CUE_AXIS_LABELS[axis]}
                </th>
              ))}
              <th scope="col" className={`${styles.colHead} ${styles.num}`}>
                合计
              </th>
            </tr>
          </thead>
          {anchors.map((anchor) => (
            <tbody key={anchor.phraseId} className={styles.group}>
              <tr>
                <th scope="row" className={styles.nameCol}>
                  {anchor.name}
                </th>
                <TallyCells tally={whole(anchor)} />
              </tr>
              {/* Split only where there is a split point. A phrase whose text
                  has never changed gets one row — an empty 「修订前」 row would
                  invent a rewrite that never happened. */}
              {anchor.revisedAt != null && (
                <>
                  <tr className={styles.subRow}>
                    <th scope="row" className={styles.subCell}>
                      {`修订前 · ${formatDay(anchor.revisedAt)} 之前`}
                    </th>
                    <TallyCells tally={anchor.before} />
                  </tr>
                  <tr className={styles.subRow}>
                    <th scope="row" className={styles.subCell}>
                      {`修订后 · ${formatDay(anchor.revisedAt)} 起`}
                    </th>
                    <TallyCells tally={anchor.after} />
                  </tr>
                </>
              )}
            </tbody>
          ))}
        </table>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>按轴合计</h3>
        <ul className={styles.lines}>
          {CUE_AXIS_ORDER.map((axis) => (
            <li
              key={axis}
            >{`${CUE_AXIS_LABELS[axis]}：${perAxis[axis]} 次`}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <ul className={styles.lines}>
          {/* Three lines that reconcile with the table above:
              table + 未归入任何一轴 + 未归到任何开场话术 = 合计. The gap is
              named rather than absorbed, because a total nobody can take apart
              is a number nobody can check. */}
          <li>{`未归入任何一轴：${noAxis} 次`}</li>
          <li>{`未归到任何开场话术：${ledger.unattributed} 次`}</li>
          <li
            className={styles.grand}
          >{`中途口令合计：${ledger.liveCueTotal} 次`}</li>
        </ul>
      </section>
    </div>
  );
}
