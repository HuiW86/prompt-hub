import { useRef } from "react";

import type { PanoramaGroupId } from "../../ipc/types";
import {
  ALL_GROUP_IDS,
  COLUMN_TITLES,
  type PanoramaItem,
} from "../../utils/panorama";
import { AnchoredEditor } from "../primitives";

import styles from "./PlacementMenu.module.css";

// Where an item sits in the panorama (I-04 / ADR-031). Organize mode only.
// The position is the user's to decide — the app never moves anything on its
// own — so this menu is the whole of the layout UI: one column choice, one pin
// slot choice, each applied the moment it is picked.

/** What a pick changes. A key that is absent is left as it is. */
export interface PlacementChange {
  groupId?: PanoramaGroupId | null;
  pinSlot?: number | null;
}

export interface PlacementMenuProps {
  item: PanoramaItem;
  /** The item's row button: the menu pins to it and focus returns to it. */
  anchor: HTMLElement | null;
  /** Who holds each pin slot now, to name them next to the slot. */
  bySlot: Record<number, PanoramaItem>;
  onPick: (change: PlacementChange) => void;
  onClose: () => void;
}

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function PlacementMenu({
  item,
  anchor,
  bySlot,
  onPick,
  onClose,
}: PlacementMenuProps) {
  // The current choice gets first focus, so Enter on open is a no-op pick
  // rather than a silent change, and the user starts where they already are.
  const currentGroupRef = useRef<HTMLButtonElement>(null);

  const pick = (change: PlacementChange) => {
    onPick(change);
    onClose();
  };

  return (
    <AnchoredEditor
      anchor={anchor}
      ariaLabel={`「${item.name}」的位置`}
      className={styles.menu}
      initialFocus={currentGroupRef}
      onDismiss={() => onClose()}
    >
      <div className={styles.section} role="group" aria-label="分组">
        <span className={styles.heading}>分组</span>
        <div className={styles.options}>
          {([null, ...ALL_GROUP_IDS] as const).map((g) => {
            const current = item.groupId === g;
            return (
              <button
                key={g ?? "default"}
                ref={current ? currentGroupRef : undefined}
                type="button"
                className={current ? styles.current : styles.option}
                aria-pressed={current}
                onClick={() => pick({ groupId: g })}
              >
                {g == null ? "按默认" : COLUMN_TITLES[g]}
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.section} role="group" aria-label="常用位">
        <span className={styles.heading}>常用位</span>
        <div className={styles.slots}>
          <button
            type="button"
            className={item.pinSlot == null ? styles.current : styles.option}
            aria-pressed={item.pinSlot == null}
            onClick={() => pick({ pinSlot: null })}
          >
            不占用
          </button>
          {SLOTS.map((n) => {
            const current = item.pinSlot === n;
            const holder = bySlot[n];
            const taken = holder && !current ? holder : null;
            return (
              <button
                key={n}
                type="button"
                className={current ? styles.current : styles.option}
                aria-pressed={current}
                aria-label={
                  taken ? `常用位 ${n}，当前为「${taken.name}」` : `常用位 ${n}`
                }
                onClick={() => pick({ pinSlot: n })}
              >
                <span className={styles.slotNumber}>{n}</span>
                {taken && (
                  <span className={styles.holder} title={taken.name}>
                    {taken.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </AnchoredEditor>
  );
}
