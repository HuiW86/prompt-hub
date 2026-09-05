import type { AlignmentPhrase, UsageSource } from "./types";

// The one place that decides which `source` an alignment-phrase copy records
// (ADR-029 口径 7 / 06-prd §6.8).
//
// `source` normally names the ENTRY POINT a copy came from. `live_cue` is the
// single exception: it names the phrase's CLASS. So a cue copied from the
// recents strip records `live_cue`, not `recent`, and ⌘9 copying 「停」 from the
// phase bar records `live_cue`, not `phase_bar`. The judgement is made on
// `kind` alone and never on where the user clicked.
//
// This is not bookkeeping pedantry, and it is why the rule ships with the data
// layer rather than with the UI that will eventually surface cues. The drift
// ledger finds each cue's anchor by looking backwards for the nearest
// `source = 'phase_bar'` record. If a cue copy recorded `phase_bar`, 「停」 would
// become an anchor — an opening phrase that nobody ever sent — and every cue
// after it would be attributed to it. `usage_records` is append-only by
// contract, so those rows could never be corrected, only outlived.
export function alignmentUsageSource(
  phrase: Pick<AlignmentPhrase, "kind">,
  entry: UsageSource,
): UsageSource {
  return phrase.kind === "cue" ? "live_cue" : entry;
}

/**
 * Find an alignment phrase by id across the store's per-phase buckets.
 *
 * Needed by copy paths that hold a usage record rather than a phrase — the
 * recents strip re-copies by id and has no `kind` of its own. Returns
 * `undefined` for an id the store cannot resolve (a trashed phrase, or one from
 * a stale render), in which case the caller keeps its entry-point source: one
 * cue missing from the ledger is a small loss, and no anchor can be invented
 * this way because `recent` is not an anchor source.
 */
export function findAlignmentPhrase(
  byPhase: Record<string, AlignmentPhrase[]>,
  id: string | null,
): AlignmentPhrase | undefined {
  if (!id) return undefined;
  for (const list of Object.values(byPhase)) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}
