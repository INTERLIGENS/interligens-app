"use client";
import React from "react";

interface State { hasError: boolean; }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: any) { console.error("[ErrorBoundary]", e); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-black text-xl mb-2">Demo recovered</h2>
          <p className="text-zinc-500 text-sm mb-6">Something went wrong. No data was lost.</p>
          <button onClick={() => window.location.reload()}
            className="bg-[#F85B05] text-white font-black uppercase text-xs px-6 py-3 rounded-lg hover:bg-orange-600 transition-all">
            Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
