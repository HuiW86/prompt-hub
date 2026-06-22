import type { ComponentPropsWithRef } from "react";

import { cx, type Layer } from "./cx";
import styles from "./primitives.module.css";

type Intent = "primary" | "ghost" | "subtle";

const intentClass: Record<Intent, string> = {
  primary: styles.btnPrimary,
  ghost: styles.btnGhost,
  subtle: styles.btnSubtle,
};

interface ButtonProps extends ComponentPropsWithRef<"button"> {
  layer?: Layer;
  intent?: Intent;
}

export function Button({
  layer = "neutral",
  intent = "ghost",
  className,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(styles.btn, styles[layer], intentClass[intent], className)}
      {...rest}
    />
  );
}

interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  plain?: boolean;
  dragHandle?: boolean;
}

export function IconButton({
  plain,
  dragHandle,
  className,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        styles.iconBtn,
        plain && styles.iconBtnPlain,
        dragHandle && styles.iconBtnGrab,
        className,
      )}
      {...rest}
    />
  );
}
