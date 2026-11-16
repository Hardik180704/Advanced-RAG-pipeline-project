import type { ReactNode } from "react";

/**
 * Minimal, dependency-free markdown for chat answers.
 *
 * Understands the subset the model actually produces:
 *   - paragraphs and line breaks
 *   - "- " bullets and "1. " ordered lists
 *   - **bold**, *italic*, `inline code`
 *   - ``` fenced code blocks
 * Citations like [1] are handled by the caller and passed through untouched.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="space-y-2.5">{renderBlocks(text)}</div>;
}

function renderBlocks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const segments = text.split(/```/);

  segments.forEach((segment, index) => {
    if (index % 2 === 1) {
      const [maybeLang, ...rest] = segment.split("\n");
      const body = rest.length > 0 ? rest.join("\n") : maybeLang;
      nodes.push(
        <pre
          key={`code-${index}`}
          className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300"
        >
          <code>{body.replace(/\n$/, "")}</code>
        </pre>,
      );
      return;
    }

    const paragraphs = segment.split(/\n{2,}/).filter((p) => p.trim());
    paragraphs.forEach((paragraph, pIndex) => {
      nodes.push(
        <div key={`p-${index}-${pIndex}`} className="space-y-1.5">
          {renderParagraph(paragraph)}
        </div>,
      );
    });
  });

  return nodes;
}

function renderParagraph(paragraph: string): ReactNode[] {
  const lines = paragraph.split("\n");

  if (lines.every((line) => /^\s*-\s+/.test(line)) && lines.length > 0) {
    return [
      <ul key={paragraph} className="ml-4 list-disc space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="pl-1">
            {renderInline(line.replace(/^\s*-\s+/, ""))}
          </li>
        ))}
      </ul>,
    ];
  }

  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line)) && lines.length > 0) {
    return [
      <ol key={paragraph} className="ml-4 list-decimal space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="pl-1">
            {renderInline(line.replace(/^\s*\d+[.)]\s+/, ""))}
          </li>
        ))}
      </ol>,
    ];
  }

  return lines.map((line, i) => <p key={i}>{renderInline(line)}</p>);
}

function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  parts.forEach((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      nodes.push(
        <strong key={i} className="font-semibold text-zinc-50">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (/^\*[^*]+\*$/.test(part)) {
      nodes.push(
        <em key={i} className="italic text-zinc-100">
          {part.slice(1, -1)}
        </em>,
      );
    } else if (/^`[^`]+`$/.test(part)) {
      nodes.push(
        <code
          key={i}
          className="rounded-md border border-white/[0.06] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11.5px] text-indigo-200"
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part) {
      nodes.push(<span key={i}>{part}</span>);
    }
  });

  return nodes;
}
