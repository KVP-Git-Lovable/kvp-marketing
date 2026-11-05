import React from "react";

interface Props {
  children: React.ReactNode;
  /** Changing this (e.g. the retailer id) gives a fresh attempt instead of staying stuck. */
  resetKey?: string;
}
interface State {
  hasError: boolean;
}

/**
 * Isolates AI Suggestions render failures from the rest of Order Entry — a
 * crash here must never block product selection, quantity entry, or order
 * submission.
 */
export class PitchSuggestionsErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PitchSuggestionsErrorBoundary] AI Suggestions render crash:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          AI Suggestions are temporarily unavailable. You can continue placing your order manually.
        </div>
      );
    }
    return this.props.children;
  }
}
