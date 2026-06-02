import { FontStyle, applyStyle } from "./unicodeFonts";

export interface ExportPost {
  day: number;
  dow: string;
  topic: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  rationale: string;
  image_prompt?: string;
}

export interface ExportMeta {
  title: string;
  industryLabel?: string;
  platform?: string;
  coreIdea?: string;
}

export interface ExportOptions {
  style?: FontStyle;
}

function fileSlug(s: string) {
  return (s || "calendar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "calendar";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function styleText(text: string, style?: FontStyle): string {
  if (!style || style === FontStyle.None) return text;
  return applyStyle(text, style);
}

export function downloadMd(meta: ExportMeta, posts: ExportPost[], options?: ExportOptions) {
  const style = options?.style;
  const lines: string[] = [];
  lines.push(`# ${styleText(meta.title, style)}`);
  lines.push("");
  const sub: string[] = [];
  if (meta.industryLabel) sub.push(styleText(meta.industryLabel, style));
  if (meta.platform) sub.push(styleText(meta.platform, style));
  sub.push(new Date().toLocaleDateString());
  lines.push(`_${sub.join(" · ")}_`);
  if (meta.coreIdea) {
    lines.push("");
    lines.push(`> ${styleText(meta.coreIdea, style)}`);
  }
  lines.push("");
  for (const p of posts) {
    lines.push("---");
    lines.push("");
    lines.push(`## Day ${p.day} — ${p.dow}: ${styleText(p.title, style)}`);
    lines.push("");
    lines.push(`**Topic:** ${styleText(p.topic, style)}  •  **Format:** ${styleText(p.format, style)}`);
    lines.push("");
    lines.push("### Hook");
    lines.push("");
    lines.push(`> ${styleText(p.hook, style).replace(/\n/g, "\n> ")}`);
    lines.push("");
    lines.push("### Post body");
    lines.push("");
    lines.push(styleText(p.body, style));
    lines.push("");
    lines.push("### CTA");
    lines.push("");
    lines.push(styleText(p.cta, style));
    lines.push("");
    lines.push("### Hashtags");
    lines.push("");
    lines.push(styleText(p.hashtags, style));
    lines.push("");
    if (p.rationale) {
      lines.push("### Why this works");
      lines.push("");
      lines.push(`_${styleText(p.rationale, style)}_`);
      lines.push("");
    }

    if (p.image_prompt) {
      lines.push("### Cinematic image prompt");
      lines.push("");
      lines.push(styleText(p.image_prompt, style));
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${fileSlug(meta.title)}.md`);
}

export function downloadPdf(meta: ExportMeta, posts: ExportPost[]) {
  void import("jspdf").then(({ jsPDF }) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number }) => {
    const { size = 11, bold = false, color = [40, 40, 50], gap = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "", contentW) as string[];
    const lineH = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += gap;
  };

  const hr = () => {
    ensureSpace(12);
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  // ── Cover ──
  writeWrapped(meta.title, { size: 22, bold: true, color: [20, 20, 30], gap: 8 });
  const sub: string[] = [];
  if (meta.industryLabel) sub.push(meta.industryLabel);
  if (meta.platform) sub.push(meta.platform);
  sub.push(new Date().toLocaleDateString());
  writeWrapped(sub.join("  ·  "), { size: 10, color: [120, 120, 140], gap: 12 });
  if (meta.coreIdea) {
    writeWrapped(meta.coreIdea, { size: 11, color: [80, 80, 100], gap: 16 });
  }
  hr();

  // ── Posts ──
  for (const p of posts) {
    ensureSpace(80);
    writeWrapped(`Day ${p.day} — ${p.dow}`, { size: 9, bold: true, color: [120, 140, 90], gap: 2 });
    writeWrapped(p.title, { size: 16, bold: true, color: [20, 20, 30], gap: 6 });
    writeWrapped(`${p.topic}  ·  ${p.format}`, { size: 9, color: [140, 140, 160], gap: 12 });

    writeWrapped("HOOK", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
    writeWrapped(p.hook, { size: 11, color: [60, 60, 80], gap: 12 });

    writeWrapped("POST BODY", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
    writeWrapped(p.body, { size: 11, color: [60, 60, 80], gap: 12 });

    writeWrapped("CTA", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
    writeWrapped(p.cta, { size: 11, color: [60, 60, 80], gap: 12 });

    if (p.hashtags) {
      writeWrapped("HASHTAGS", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
      writeWrapped(p.hashtags, { size: 10, color: [110, 130, 80], gap: 12 });
    }

    if (p.rationale) {
      writeWrapped("WHY THIS WORKS", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
      writeWrapped(p.rationale, { size: 10, color: [120, 120, 140], gap: 12 });
    }

    if (p.image_prompt) {
      writeWrapped("CINEMATIC IMAGE PROMPT", { size: 8, bold: true, color: [120, 140, 90], gap: 4 });
      writeWrapped(p.image_prompt, { size: 10, color: [120, 120, 140], gap: 12 });
    }

    hr();
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 175);
    doc.text(`ContentForge  ·  ${i} / ${pageCount}`, pageW / 2, pageH - 18, { align: "center" });
  }

    doc.save(`${fileSlug(meta.title)}.pdf`);
  });
}
