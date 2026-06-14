/**
 * vaultCopy.ts — helpers puros do Vault Copy.
 *
 * Mantenha tudo sem efeito colateral aqui (parse, normalização, limpeza,
 * formatação de consolidado/llms.txt, timestamp). Faz fácil testar e
 * permite que o componente foque só em UI + orquestração.
 */

// ── Parsing dos caminhos colados ──────────────────────────────────────────────

const WIN_RESERVED = /[<>:"|?*\x00-\x1F]/;

export type ParsedPath =
  | { ok: true; path: string; original: string }
  | { ok: false; reason: string; original: string };

/**
 * Aceita 4 formatos por linha:
 *   (a) "1. conversations/x.md"         numerado/bullet
 *   (b) "C:\\...\\conversations\\x.md"   caminho Explorer
 *   (c) "[[2026-04-23-Topico]]"         wiki-link
 *   (d) "2026-04-24-Nota.md"            relativo (vira conversations/2026-...md)
 *
 * Linhas vazias, "//..." e "N results" são ignoradas silenciosamente.
 */
export function parsePastedPaths(raw: string): ParsedPath[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !/^\d+\s+results?$/i.test(l))
    .map((line) => parseLine(line));
}

function parseLine(line: string): ParsedPath {
  const original = line;
  let s = line;

  // remove numeração "1." / "1)" / "-" / "*" / "•"
  s = s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "");
  // remove aspas envolventes
  s = s.replace(/^['"`](.*)['"`]$/, "$1");
  // markdown link [texto](url) -> texto
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // wiki-link [[Nome]]
  const wiki = s.match(/^\[\[(.+?)\]\]$/);
  if (wiki) {
    const name = wiki[1].endsWith(".md") ? wiki[1] : `${wiki[1]}.md`;
    s = `conversations/${name}`;
  }

  // Windows path: pega o trecho depois de "conversations\"
  if (/[A-Za-z]:\\/.test(s) || s.includes("\\")) {
    s = s.replace(/\\/g, "/");
    const idx = s.toLowerCase().lastIndexOf("conversations/");
    if (idx >= 0) s = s.slice(idx);
  }

  // se vier só "nome.md", prefixa conversations/
  if (!s.includes("/")) s = `conversations/${s}`;

  // normaliza barras duplicadas
  s = s.replace(/\/{2,}/g, "/").replace(/^\/+/, "");

  // validações
  if (!s.toLowerCase().endsWith(".md")) {
    return { ok: false, reason: "não termina em .md", original };
  }
  if (s.includes("..") || s.startsWith("./")) {
    return { ok: false, reason: "caminho relativo inseguro (./ ou ..)", original };
  }
  if (WIN_RESERVED.test(s)) {
    return { ok: false, reason: "caractere reservado Windows", original };
  }

  return { ok: true, path: s, original };
}

// ── Limpeza de markdown exportado ─────────────────────────────────────────────

/**
 * Remove blocos "This block is not supported" e colapsa 3+ quebras em 2.
 * Mantém o restante intacto — não é hora de reformatar.
 */
export function cleanExportMarkdown(md: string): string {
  return md
    .replace(/^.*This block is not supported.*$\n?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extrai o primeiro H1; senão, primeira linha não-vazia; senão, basename. */
export function extractTitle(md: string, fallback: string): string {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const first = md.split("\n").map((l) => l.trim()).find(Boolean);
  return first ?? fallback;
}

/** "2026-04-23-foo.md" -> Date(2026-04-23). Senão epoch 0 (vai pro topo da lista). */
export function dateFromFilename(path: string): Date {
  const m = path.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(0);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

// ── Nomenclatura ──────────────────────────────────────────────────────────────

/** DDMMYY-HHMM no fuso local. */
export function timestampTag(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export const fileNames = {
  zipBundle: (ts: string) => `${ts}_msgm_obsidian.zip`,
  consolidado: (ts: string) => `consolidado_${ts}.md`,
  llmsIndex: "llms.txt",
};

// ── Tipo unificado de item do lote (consumido pelos exports) ──────────────────

export type ConvItem = {
  tag: string;                 // "conv-01"
  path: string;                // "conversations/2026-04-23-foo.md"
  filename: string;            // "2026-04-23-foo.md"
  date: Date;
  title: string;
  rawContent: string;          // bruto (sem cleanExportMarkdown)
  cleanContent: string;        // pós-clean
  ai?: { titulo: string; resumo: string; tags: string[] } | { error: string };
};

// ── Formatação dos artefatos finais ───────────────────────────────────────────

/** Consolidado .md — Seção 1 (Índice) + Seção 2 (Transcrições). */
export function buildConsolidado(items: ConvItem[], withAI: boolean): string {
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Consolidado — ${timestampTag()}`, "");
  lines.push("## Seção 1 — Índice", "");
  for (const it of items) {
    lines.push(`### [${it.tag}] ${it.title}`);
    lines.push(`- **data**: ${fmtDate(it.date)}`);
    let tags = "—";
    let resumo = "_resumo pendente_";
    if (withAI && it.ai) {
      if ("error" in it.ai) {
        resumo = `_resumo IA falhou: ${it.ai.error}_`;
      } else {
        resumo = it.ai.resumo;
        tags = it.ai.tags.length ? it.ai.tags.join(", ") : "—";
      }
    }
    lines.push(`- **tags**: ${tags}`);
    lines.push(`- **resumo**: ${resumo}`);
    lines.push("");
  }

  lines.push("", "## Seção 2 — TRANSCRIÇÕES", "");
  for (const it of items) {
    lines.push(`### [${it.tag}] ${it.title}`);
    lines.push("");
    lines.push(it.cleanContent);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/** llms.txt — cabeçalho instrutivo + 1 linha por conversa. */
export function buildLlmsIndex(items: ConvItem[]): string {
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const header = [
    "# Índice de conversas (llms.txt)",
    "",
    "Este arquivo é um mapa para LLMs navegarem o lote anexo.",
    "Cada linha aponta para um .md no mesmo diretório; siga o link",
    "para ler a conversa completa. Tags são pistas, não filtros rígidos.",
    "",
  ].join("\n");

  const body = items
    .map((it) => {
      const tags =
        it.ai && !("error" in it.ai) && it.ai.tags.length ? it.ai.tags.join(", ") : "—";
      const resumo =
        it.ai && !("error" in it.ai) ? it.ai.resumo : "_resumo pendente_";
      return `- [${fmtDate(it.date)} · ${it.title}](${it.filename}): ${resumo}. Tags: ${tags}.`;
    })
    .join("\n");

  return `${header}\n${body}\n`;
}
