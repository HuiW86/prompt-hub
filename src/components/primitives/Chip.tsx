import type { ComponentPropsWithRef } from "react";

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
  ...rest
}: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        styles.chip,
        styles[layer],
        active && styles.chipActive,
        dim && styles.chipDim,
        flash && styles.flash,
        className,
      )}
      {...rest}
    />
  );
}
