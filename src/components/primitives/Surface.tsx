import type { ComponentPropsWithRef } from "react";

import { cx, type Layer } from "./cx";
import styles from "./primitives.module.css";

interface SurfaceProps extends ComponentPropsWithRef<"div"> {
  layer?: Layer;
  selected?: boolean;
  dragging?: boolean;
  flash?: boolean;
}

export function CardSurface({
  layer = "neutral",
  selected,
  dragging,
  flash,
  className,
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cx(
        styles.card,
        styles[layer],
        selected && styles.cardSelected,
        dragging && styles.cardDragging,
        flash && styles.flash,
        className,
      )}
      {...rest}
    />
  );
}

export function ListRowSurface({
  layer = "neutral",
  selected,
  dragging,
  flash,
  className,
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cx(
        styles.row,
        styles[layer],
        selected && styles.rowSelected,
        dragging && styles.rowDragging,
        flash && styles.flash,
        className,
      )}
      {...rest}
    />
  );
}
