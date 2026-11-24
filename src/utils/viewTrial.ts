// Temporary two-week trial counter (ADR-034, issue #50): how many pastes each
// view produced, per local day. Deliberately NOT in SQLite — no migration, so
// the trial build can still be downgraded — and deliberately per-device only
// (constitution A2: nothing leaves the machine). Remove this file, its two
// call sites and the settings row when the trial is decided.

export type TrialView = "quick" | "panorama" | "skills" | "manage";

const KEY = "prompt-hub:view-trial:v1";

type DayCounts = Partial<Record<TrialView, number>>;
type Store = Record<string, DayCounts>;

function dayKey(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

/** Never throws: a counter must not be able to break a paste. */
export function countPaste(view: TrialView, now: Date = new Date()): void {
  try {
    const store = read();
    const day = dayKey(now);
    const counts = store[day] ?? {};
    counts[view] = (counts[view] ?? 0) + 1;
    store[day] = counts;
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage blocked or full: the trial loses a count, the paste goes on.
  }
}

/** Totals over the last `days` local days, today included. */
export function trialTotals(
  days: number,
  now: Date = new Date(),
): Record<TrialView, number> {
  const store = read();
  const totals: Record<TrialView, number> = {
    quick: 0,
    panorama: 0,
    skills: 0,
    manage: 0,
  };
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const counts = store[dayKey(d)];
    if (!counts) continue;
    for (const view of Object.keys(totals) as TrialView[]) {
      totals[view] += counts[view] ?? 0;
    }
  }
  return totals;
}
