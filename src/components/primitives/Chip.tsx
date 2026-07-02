import { Children, type ComponentPropsWithRef } from "react";

import { cx, type Layer } from "./cx";
import styles from "./primitives.module.css";

interface ChipProps extends ComponentPropsWithRef<"button"> {
  layer?: Layer;
  active?: boolean;
  dim?: boolean;
  flash?: boolean;
}

export function Chip({
  layer = "protocol",
  active,
  dim,
  flash,
  className,
  type,
  title,
  children,
  ...rest
}: ChipProps) {
  // Chips cap at --w-chip-max and ellipsize; keep the full name reachable via
  // the native tooltip. Callers may still pass an explicit title (e.g. content
  // preview) which wins over the derived label.
  const label = Children.toArray(children)
    .filter((c): c is string | number => typeof c !== "object")
    .join("");
  return (
    <button
      type={type ?? "button"}
      title={title ?? (label || undefined)}
      className={cx(
        styles.chip,
        styles[layer],
        active && styles.chipActive,
        dim && styles.chipDim,
        flash && styles.flash,
        className,
      )}
      {...rest}
    >
      {Children.map(children, (child) =>
        typeof child === "string" || typeof child === "number" ? (
          <span className={styles.chipLabel}>{child}</span>
        ) : (
          child
        ),
      )}
    </button>
  );
}
