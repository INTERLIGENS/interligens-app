"use client";

/**
 * Minimal error boundary for heavy tab-level components (WalletJourney,
 * TimelineBuilder, CaseAssistant). A render-time crash in one component no
 * longer takes down the whole case detail page — instead the user sees a
 * friendly fallback and can keep using the other tabs.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label?: string;
};

type State = { hasError: boolean; message: string | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    // Explicit log so the client console still shows the stack if an
    // investigator reports an issue.
    console.error(
      `[${this.props.label ?? "boundary"}] component crashed`,
      err,
      info.componentStack
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          border: "1px solid rgba(255,59,92,0.35)",
          background: "rgba(255,59,92,0.06)",
          borderRadius: 6,
          padding: "16px 18px",
          fontSize: 13,
          color: "#FF9AAB",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#FF3B5C" }}>
          {this.props.label ? `${this.props.label}: ` : ""}something
          crashed.
        </strong>{" "}
        You can keep using the other tabs — a page reload usually clears
        this.
        {this.state.message && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "rgba(255,154,171,0.7)",
              fontFamily: "monospace",
            }}
          >
            {this.state.message}
          </div>
        )}
      </div>
    );
  }
}
