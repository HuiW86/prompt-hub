import type { ComponentPropsWithRef } from "react";

import { cx, type Layer } from "./cx";
import styles from "./primitives.module.css";

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input className={cx(styles.input, className)} {...rest} />;
}

export function EditorInput({
  className,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cx(styles.editorInput, className)} {...rest} />;
}

interface EditorPanelProps extends ComponentPropsWithRef<"div"> {
  layer?: Layer;
}

export function EditorPanel({
  layer = "neutral",
  className,
  ...rest
}: EditorPanelProps) {
  return (
    <div
      className={cx(styles.editorPanel, styles[layer], className)}
      {...rest}
    />
  );
}

export function EditorActions({
  className,
  ...rest
}: ComponentPropsWithRef<"div">) {
  return <div className={cx(styles.editorActions, className)} {...rest} />;
}
