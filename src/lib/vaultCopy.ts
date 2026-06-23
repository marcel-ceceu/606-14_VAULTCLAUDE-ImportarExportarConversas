/**
 * vaultCopy.ts — parse, limpeza e formatação do Vault Copy (paridade import-obsidian).
 */

import { DEFAULT_VAULT_ABS } from "@/lib/vaultFs";
import type { VaultLayout } from "@/lib/vaultFs";

// ── Parsing dos caminhos colados ──────────────────────────────────────────────

const WIN_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

function escapeRegex(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSlashes(s: string): string {
  return String(s).replace(/\\/g, "/");
}

export function normalizeToVaultRelPath(
  raw: string,
  vaultName: string | null,
  layout: VaultLayout | null,
): string {
  let p = normalizeSlashes(raw.trim());
  if (!/^[A-Za-z]:/.test(p)) {
    return p.replace(/^\/+/, "");
  }
  const defaultNorm = normalizeSlashes(DEFAULT_VAULT_ABS).replace(/\/+$/, "");
  const lower = p.toLowerCase();
  const defaultLower = defaultNorm.toLowerCase();
  if (lower === defaultLower) {
    p = "";
  } else if (lower.startsWith(defaultLower + "/")) {
    p = p.slice(defaultNorm.length).replace(/^\/+/, "");
  } else if (vaultName) {
    const vaultPattern = new RegExp("^.*/" + escapeRegex(vaultName) + "/(.*)$", "i");
    const match = p.match(vaultPattern);
    if (match) p = match[1];
  }
  if (/^[A-Za-z]:/.test(p)) {
    const convIdx = p.toLowerCase().indexOf("/conversations/");
    if (convIdx >= 0) {
      p = p.slice(convIdx + 1);
    } else if (layout?.contentSubdir) {
      const subToken = "/" + layout.contentSubdir.toLowerCase() + "/";
      const subIdx = p.toLowerCase().indexOf(subToken);
      if (subIdx >= 0) p = p.slice(subIdx + 1);
      else {
        const parts = p.split("/").filter(Boolean);
        const mdFile = parts.find((x) => /\.md$/i.test(x));
        if (mdFile) p = mdFile;
      }
    } else {
      const parts = p.split("/").filter(Boolean);
      const mdFile = parts.find((x) => /\.md$/i.test(x));
      if (mdFile) p = mdFile;
    }
  }
  p = p.replace(/^\/+/, "");
  if (layout?.contentSubdir && layout.contentSubdir !== "conversations") {
    if (p.toLowerCase().startsWith("conversations/")) {
      p = p.slice("conversations/".length);
    }
  }
  return p;
}

function ensureContentPrefix(relPath: string, layout: VaultLayout | null): string {
  const normalized = normalizeSlashes(relPath).replace(/^\/+/, "");
  if (normalized.includes("/")) return normalized;
  const sub = layout?.contentSubdir;
  if (sub) return `${sub}/${normalized}`;
  return normalized;
}

function isValidRelPath(relPath: string): boolean {
  const parts = normalizeSlashes(relPath).split("/").filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  if (!/\.md$/i.test(parts[parts.length - 1])) return false;
  for (const part of parts) {
    if (part === "." || part === "..") return false;
    if (part.includes(":")) return false;
    if (/[.\s]$/.test(part)) return false;
    const base = part.replace(/\.[^./\\]+$/, "").toUpperCase();
    if (WIN_RESERVED.has(part.toUpperCase()) || WIN_RESERVED.has(base)) return false;
  }
  return true;
}

export type PasteEntry =
  | { status: "ok"; sourceLine: string; relPath: string; format: string }
  | { status: "skip"; sourceLine: string; reason: string; format?: string };

export function parsePasteLine(
  line: string,
  vaultName: string | null,
  layout: VaultLayout | null,
): PasteEntry {
  const sourceLine = line;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return { sourceLine, status: "skip", reason: "linha vazia" };
  }
  if (/^\d+\s+results?$/i.test(trimmed)) {
    return { sourceLine, status: "skip", reason: "metadata de busca" };
  }

  let text = trimmed
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .trim();

  let format = "relative";
  let pathCandidate = text;

  const wikiMatch = text.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  if (wikiMatch) {
    pathCandidate = wikiMatch[1].trim();
    format = "wikilink";
    if (!/\.md$/i.test(pathCandidate)) pathCandidate += ".md";
    pathCandidate = ensureContentPrefix(pathCandidate, layout);
  } else if (/^[A-Za-z]:[/\\]/.test(text)) {
    format = "absolute";
    pathCandidate = normalizeToVaultRelPath(text, vaultName, layout);
    pathCandidate = ensureContentPrefix(pathCandidate, layout);
  } else {
    pathCandidate = normalizeSlashes(text).replace(/^\/+/, "");
    if (!pathCandidate.includes("/")) {
      format = "basename";
      pathCandidate = ensureContentPrefix(pathCandidate, layout);
    }
  }

  pathCandidate = normalizeSlashes(pathCandidate).replace(/^\/+/, "");

  if (!isValidRelPath(pathCandidate)) {
    return {
      sourceLine,
      status: "skip",
      reason: "sem caminho de ficheiro reconhecido",
      format,
    };
  }

  return { sourceLine, relPath: pathCandidate, format, status: "ok" };
}

export function parsePasteLines(
  text: string,
  vaultName: string | null,
  layout: VaultLayout | null,
): PasteEntry[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parsePasteLine(line, vaultName, layout));
}

// ── Limpeza e metadados ─────────────────────────────────────────────────────

export function cleanExportMarkdown(text: string): string {
  let s = text.replace(
    /^``` *\r?\nThis block is not supported on your current device yet\.\s*\r?\n``` *\r?\n?/gm,
    "",
  );
  s = s.replace(/^.*This block is not supported.*$\n?/gim, "");
  return s.replace(/(\r\n|\n|\r){3,}/g, "\n\n").trim();
}

export function extractTitle(content: string, fileName: string): string {
  let title = "";
  if (content.indexOf("---") === 0) {
    const end = content.indexOf("\n---", 3);
    if (end > 0) {
      const m = content.slice(0, end).match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (m) title = m[1].trim();
    }
  }
  if (!title) {
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }
  if (!title) {
    title = fileName
      .replace(/\.md$/i, "")
      .replace(/^\d{4}-\d{2}-\d{2}[-_ ]*/, "")
      .replace(/[-_]+/g, " ")
      .trim();
  }
  return title || fileName;
}

export function fileDate(fileName: string): string {
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function mergeRelBase(relPath: string): string {
  return String(relPath).replace(/\\/g, "/").split("/").pop() || relPath;
}

/** Subpasta por exportação: yyMMdd_HHmm_Export (ex.: 260623_0928_Export) */
export function buildSubfolderName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = pad(date.getFullYear() % 100);
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  return `${yy}${mm}${dd}_${pad(date.getHours())}${pad(date.getMinutes())}_Export`;
}

export function consolidadoFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `consolidado_${pad(date.getDate())}${pad(date.getMonth() + 1)}${String(date.getFullYear() % 100)}-${pad(date.getHours())}${pad(date.getMinutes())}.md`;
}

export type MergeConv = {
  fileName: string;
  title: string;
  date: string;
  content: string;
  resumo: string;
  tags: string[];
  erro?: string;
  jsonFailed?: boolean;
};

export function buildImportConsolidado(convs: MergeConv[], vaultLabel = "vault Claude"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const human = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let capa =
    `# Consolidado de conversas — guia para IA\n\n` +
    `> Gerado em ${human} · ${convs.length} conversas · fonte: ${vaultLabel}\n\n` +
    `Esta seção 1 é apenas um índice explicativo, sem transcrições. Para cada conversa há número, data, um resumo de até 200 palavras e tags (nomes próprios, ferramentas, temas, áreas) para a IA localizar rapidamente a conversa certa antes de ler a transcrição.\n\n` +
    `A seção 2 (TRANSCRIÇÕES) traz o conteúdo cru de cada conversa, identificado pelo mesmo [conv-NN], em ordem cronológica.\n\n` +
    `## Índice das conversas\n`;

  let corpo = `\n---\n# TRANSCRIÇÕES\n`;
  convs.forEach((c, i) => {
    const id = `conv-${pad(i + 1)}`;
    const data = c.date || "s/ data";
    const tagsLn = c.tags?.length ? c.tags.join(", ") : "—";
    const resumo = c.resumo ? c.resumo : "_resumo pendente (gerar com IA)_";
    capa += `\n### [${id}] ${c.title}\n**Data:** ${data} · **Tags:** ${tagsLn}\n\n${resumo}\n`;
    corpo += `\n## [${id}] ${c.title}\n\n${c.content}\n`;
  });
  return capa + "\n" + corpo;
}

export function buildLlmsTxtBody(
  rows: { fileName: string; title: string; date: string; resumo: string; tags: string[] }[],
): string {
  const formatLine = (row: (typeof rows)[0]) => {
    const resumo = (row.resumo || "").replace(/\s+/g, " ").trim();
    let line = `- [${row.date} · ${row.title}](${row.fileName})`;
    if (resumo) {
      line += `: ${resumo}.`;
      if (row.tags?.length) line += ` Tags: ${row.tags.join(", ")}.`;
    } else if (row.tags?.length) {
      line += `: Tags: ${row.tags.join(", ")}.`;
    }
    return line;
  };

  return (
    `# Índice de conversas — ${rows.length} itens\n\n` +
    `> Leia este arquivo primeiro. Cada item tem data, resumo e tags; use-os para\n` +
    `> escolher a conversa certa e abrir o .md correspondente nesta mesma pasta.\n` +
    `> As transcrições estão íntegras nos arquivos .md ao lado, sem edição.\n\n` +
    `## Conversas\n` +
    rows.map(formatLine).join("\n") +
    "\n"
  );
}
