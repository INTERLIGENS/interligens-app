"use client";

import { RefObject } from "react";

type Props = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
};

const BTN: React.CSSProperties = {
  height: 28,
  minWidth: 32,
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  color: "rgba(255,255,255,0.7)",
  fontSize: 12,
  cursor: "pointer",
  padding: "0 8px",
};

export default function NotesToolbar({ textareaRef, value, onChange }: Props) {
  function withCursor(mutator: (ctx: {
    before: string;
    selected: string;
    after: string;
    start: number;
    end: number;
  }) => { next: string; caret: number }) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const { next, caret } = mutator({ before, selected, after, start, end });
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  function wrap(marker: string, placeholder: string) {
    withCursor(({ before, selected, after }) => {
      const body = selected || placeholder;
      const next = before + marker + body + marker + after;
      const caret = before.length + marker.length + body.length + marker.length;
      return { next, caret };
    });
  }

  function lineStart(prefix: string) {
    withCursor(({ before, selected, after }) => {
      const lineBreakIdx = before.lastIndexOf("\n");
      const lineStartIdx = lineBreakIdx === -1 ? 0 : lineBreakIdx + 1;
      const lineBefore = before.slice(0, lineStartIdx);
      const currentLine = before.slice(lineStartIdx);
      const next =
        lineBefore + prefix + currentLine + selected + after;
      const caret =
        lineBefore.length + prefix.length + currentLine.length + selected.length;
      return { next, caret };
    });
  }

  function insert(snippet: string) {
    withCursor(({ before, after }) => {
      const next = before + snippet + after;
      return { next, caret: before.length + snippet.length };
    });
  }

  return (
    <div
      className="flex items-center gap-1"
      style={{ marginBottom: 6, flexWrap: "wrap" }}
    >
      <button
        type="button"
        title="Bold"
        onClick={() => wrap("**", "bold")}
        style={{ ...BTN, fontWeight: 700 }}
      >
        B
      </button>
      <button
        type="button"
        title="Italic"
        onClick={() => wrap("*", "italic")}
        style={{ ...BTN, fontStyle: "italic" }}
      >
        I
      </button>
      <button
        type="button"
        title="Bullet list"
        onClick={() => lineStart("- ")}
        style={BTN}
      >
        •
      </button>
      <button
        type="button"
        title="Numbered list"
        onClick={() => lineStart("1. ")}
        style={BTN}
      >
        1.
      </button>
      <button
        type="button"
        title="Horizontal rule"
        onClick={() => insert("\n---\n")}
        style={BTN}
      >
        —
      </button>
    </div>
  );
}
