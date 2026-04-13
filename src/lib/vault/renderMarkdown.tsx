import { Fragment } from "react";

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(
        <strong
          key={`b-${key++}`}
          style={{ color: "#FFFFFF", fontWeight: 600 }}
        >
          {match[1]}
        </strong>
      );
    } else if (match[2] !== undefined) {
      parts.push(
        <em key={`i-${key++}`} style={{ fontStyle: "italic" }}>
          {match[2]}
        </em>
      );
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 0 ? text : parts;
}

export function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  function flushList() {
    if (!listBuffer) return;
    const ordered = listBuffer.ordered;
    const items = listBuffer.items;
    blocks.push(
      <div
        key={`list-${key++}`}
        style={{
          margin: "6px 0",
          paddingLeft: 4,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                color: "#FF6B00",
                flexShrink: 0,
                marginTop: ordered ? 0 : 2,
                fontSize: ordered ? 13 : 14,
                lineHeight: 1,
                minWidth: 14,
              }}
            >
              {ordered ? `${i + 1}.` : "•"}
            </span>
            <span style={{ flex: 1 }}>{renderInline(item)}</span>
          </div>
        ))}
      </div>
    );
    listBuffer = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushList();
      blocks.push(<div key={`sp-${key++}`} style={{ height: 8 }} />);
      continue;
    }

    if (line === "---") {
      flushList();
      blocks.push(
        <hr
          key={`hr-${key++}`}
          style={{
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            margin: "10px 0",
          }}
        />
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <div
          key={`h3-${key++}`}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#FF6B00",
            margin: "12px 0 6px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {renderInline(line.slice(3))}
        </div>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <div
          key={`h4-${key++}`}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            margin: "8px 0 4px",
          }}
        >
          {renderInline(line.slice(4))}
        </div>
      );
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      continue;
    }

    const olMatch = /^(\d+)\.\s+(.*)$/.exec(line);
    if (olMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(olMatch[2]);
      continue;
    }

    flushList();
    blocks.push(
      <div
        key={`p-${key++}`}
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.6,
          margin: "4px 0",
        }}
      >
        {renderInline(line)}
      </div>
    );
  }
  flushList();
  return <Fragment>{blocks}</Fragment>;
}
