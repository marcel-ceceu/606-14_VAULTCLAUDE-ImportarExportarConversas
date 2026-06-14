/**
 * vaultApi.ts — camada única de acesso a dados do Vault Hub.
 *
 * Contrato a implementar no Worker (R2 + Anthropic):
 *   GET  {WORKER_URL}/api/list?prefix=...       -> { folders: string[], files: { key: string; size: number }[] }
 *   GET  {WORKER_URL}/api/note?path=...         -> text/markdown (corpo cru do .md)
 *   POST {WORKER_URL}/api/summarize             -> { titulo: string, resumo: string, tags: string[] }
 *
 * A chave da API Anthropic vive no Worker. NUNCA no browser.
 *
 * Enquanto o Worker não existe, este módulo usa MOCK in-memory.
 * Para plugar o Worker real: defina VITE_WORKER_URL no .env e o módulo
 * passa a usar fetch() automaticamente.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined;
const USE_MOCK = !WORKER_URL;

// ──────────────────────────────────────────────────────────────────────────────
// Tipos do contrato
// ──────────────────────────────────────────────────────────────────────────────

export type VaultFile = { key: string; size: number };
export type ListResponse = { folders: string[]; files: VaultFile[] };
export type SummarizeResponse = { titulo: string; resumo: string; tags: string[] };

export type SummarizeOptions = {
  /** Modelo Anthropic; o Worker decide o mapeamento exato. */
  model: string;
  /** Prompt ativo escolhido pelo usuário (preset ou livre). */
  prompt: string;
  /** Sinal de cancelamento (vindo do AbortController do modal de progresso). */
  signal?: AbortSignal;
};

// ──────────────────────────────────────────────────────────────────────────────
// MOCK — apenas o suficiente para validar a estrutura no Preview.
// Mantenha pequeno; quando o Worker existir, este bloco vira fallback de teste.
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_FILES: Record<string, string> = {
  "conversations/2026-04-23-arquitetura-vault.md": `# Arquitetura do Vault

Discussão sobre como estruturar o vault no R2, com pipeline de import incremental
e camada de leitura via Worker.

This block is not supported

- decisão: usar UUID + SQLite para deduplicar
- próximo passo: cron de sync semanal
`,
  "conversations/2026-04-24-prompts-consolidacao.md": `# Prompts de consolidação

Iteração de prompts para gerar resumo + tags consistentes em PT-BR.
Modelo Sonnet ficou mais fiel; Haiku acelerou 4x mas perde nuance em código.
`,
  "conversations/2026-04-25-vault-copy-spec.md": `# Vault Copy — spec

Ferramenta de extração: cola caminhos, baixa .zip, gera consolidado com IA,
exporta llms.txt como índice navegável.
`,
  // TODO: adicionar mais mocks reais quando precisar testar lotes grandes.
};

function mockList(prefix: string): ListResponse {
  const p = prefix.replace(/^\/+|\/+$/g, "");
  const files: VaultFile[] = Object.keys(MOCK_FILES)
    .filter((k) => (p ? k.startsWith(p + "/") || k.startsWith(p) : true))
    .map((key) => ({ key, size: MOCK_FILES[key].length }));
  return { folders: ["conversations"], files };
}

function mockSummarize(content: string, opts: SummarizeOptions): SummarizeResponse {
  // Stub determinístico só para o front exibir algo plausível.
  const firstLine = content.split("\n").find((l) => l.trim()) ?? "Sem título";
  const titulo = firstLine.replace(/^#+\s*/, "").slice(0, 80);
  const resumo =
    `[MOCK · ${opts.model}] ` +
    content.replace(/\s+/g, " ").trim().slice(0, 180) +
    "…";
  return { titulo, resumo, tags: ["mock", "vault-copy", "exemplo"] };
}

// ──────────────────────────────────────────────────────────────────────────────
// API pública — sempre use estas 3 funções; nada de fetch espalhado pelo app.
// ──────────────────────────────────────────────────────────────────────────────

export async function listVault(prefix = ""): Promise<ListResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 80));
    return mockList(prefix);
  }
  const res = await fetch(`${WORKER_URL}/api/list?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error(`listVault: ${res.status}`);
  return (await res.json()) as ListResponse;
}

export async function fetchNote(path: string, signal?: AbortSignal): Promise<string> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 60));
    const body = MOCK_FILES[path];
    if (body == null) throw new Error(`fetchNote: ${path} não encontrado (mock)`);
    return body;
  }
  const res = await fetch(`${WORKER_URL}/api/note?path=${encodeURIComponent(path)}`, { signal });
  if (!res.ok) throw new Error(`fetchNote: ${res.status}`);
  return await res.text();
}

export async function summarize(
  content: string,
  opts: SummarizeOptions,
): Promise<SummarizeResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return mockSummarize(content, opts);
  }
  const res = await fetch(`${WORKER_URL}/api/summarize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      content: content.slice(0, 12_000), // contrato: corta em 12k chars no front também por segurança
      model: opts.model,
      prompt: opts.prompt,
      // max_tokens fica fixo no Worker (1024)
    }),
  });
  if (!res.ok) throw new Error(`summarize: ${res.status}`);
  return (await res.json()) as SummarizeResponse;
}

// ──────────────────────────────────────────────────────────────────────────────
// Modelos disponíveis (UI consome esta lista direto).
// ──────────────────────────────────────────────────────────────────────────────

export const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — mais fiel" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — mais barato/rápido" },
] as const;

export const DEFAULT_MODEL = "claude-sonnet-4-6";
