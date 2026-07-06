import { Component, type ErrorInfo, type ReactNode } from "react";

import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// App-wide render guard: any exception thrown during a child render would
// otherwise unmount the whole tree into a blank screen with no recovery.
// This boundary catches it, keeps a diagnostic in the console, and offers an
// in-place reload. Wording mirrors the Dashboard load-error state (中文 +
// ghost 重试 button) so the two failure surfaces read the same.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Preserve the stack for diagnosis; nothing is uploaded (constitution A2).
    console.error("ErrorBoundary caught a render error:", error, info);
  }

  private handleReload = (): void => {
    // First try a soft reset: clear the error flag and re-render the subtree.
    // If the same fault reproduces immediately (getDerivedStateFromError fires
    // again on the retry render), fall back to a hard reload of the webview.
    if (this.reloadArmed) {
      window.location.reload();
      return;
    }
    this.reloadArmed = true;
    this.setState({ hasError: false });
  };

  // Latches once a soft reset has been attempted; reset after a clean render so
  // a later, unrelated error still gets its own soft-retry first.
  private reloadArmed = false;

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    if (prevState.hasError && !this.state.hasError) {
      // Soft reset produced a clean render — disarm the hard-reload fallback.
      // If the child throws again, getDerivedStateFromError flips hasError back
      // to true synchronously during that render, so this branch won't run and
      // reloadArmed stays true for the next 重新加载 click.
      queueMicrotask(() => {
        if (!this.state.hasError) this.reloadArmed = false;
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className={styles.error} role="alert">
          <span>页面出错了：某个组件在渲染时崩溃。</span>
          <button
            type="button"
            className={styles.reload}
            onClick={this.handleReload}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
