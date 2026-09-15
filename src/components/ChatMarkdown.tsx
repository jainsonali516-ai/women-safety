import type { ReactNode } from "react";

/**
 * A small, dependency-free renderer for the subset of Markdown Ally's replies actually use:
 * tables (for comparing routes/modes/times), numbered/bulleted lists, **bold**, and plain
 * paragraphs. Chat bubbles previously rendered raw text with `white-space: pre-wrap`, which
 * showed literal `**`/`|` characters and gave no way to lay out comparative data as a table.
 */
export function ChatMarkdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, i) => (
        <ChatBlock key={i} block={block} />
      ))}
    </>
  );
}

type LineGroup = { type: "ol" | "ul" | "p"; lines: string[] };

function ChatBlock({ block }: { block: string }) {
  const lines = block.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  if (isTableBlock(lines)) return <MarkdownTable lines={lines} />;

  // Grouped by consecutive same-type lines rather than requiring the whole block to be one type —
  // a leading header line followed by a bullet list (a very common Gemini answer shape) is its own
  // paragraph + list, not one blob that falls through to showing literal "*"/"1." characters.
  const groups: LineGroup[] = [];
  for (const line of lines) {
    const type: LineGroup["type"] = /^\s*\d+[.)]\s+/.test(line) ? "ol" : /^\s*[-*]\s+/.test(line) ? "ul" : "p";
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.lines.push(line);
    else groups.push({ type, lines: [line] });
  }

  return (
    <>
      {groups.map((g, gi) => {
        if (g.type === "ol") {
          return (
            <ol key={gi} style={{ margin: "0.3rem 0", paddingLeft: "1.3rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {g.lines.map((l, i) => (
                <li key={i}>{renderInline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        if (g.type === "ul") {
          return (
            <ul key={gi} style={{ margin: "0.3rem 0", paddingLeft: "1.3rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {g.lines.map((l, i) => (
                <li key={i}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={gi} style={{ margin: "0.3rem 0" }}>
            {renderInline(g.lines.join("\n"))}
          </p>
        );
      })}
    </>
  );
}

function isTableBlock(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const isRow = (l: string) => l.trim().startsWith("|") || l.includes("|");
  const isSeparator = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  return isRow(lines[0]) && isSeparator(lines[1]);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const header = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);

  return (
    <div style={{ overflowX: "auto", margin: "0.4rem 0", borderRadius: "0.6rem", border: "1px solid var(--border)" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8rem" }}>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "0.45rem 0.6rem",
                  background: "var(--surface-raised, var(--surface))",
                  borderBottom: "1px solid var(--border)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Converts **bold** spans and preserves line breaks within a single block. */
function renderInline(text: string): ReactNode[] {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push(<br key={`br-${lineIndex}`} />);
    const parts = line.split(/\*\*(.+?)\*\*/g);
    parts.forEach((part, i) => {
      if (i % 2 === 1) nodes.push(<strong key={`${lineIndex}-${i}`}>{part}</strong>);
      else if (part) nodes.push(<span key={`${lineIndex}-${i}`}>{part}</span>);
    });
  });
  return nodes;
}
