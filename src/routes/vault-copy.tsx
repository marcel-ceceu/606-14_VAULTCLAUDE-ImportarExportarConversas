import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Settings2,
  FileText,
  Sparkles,
  FolderOpen,
  X,
  Plus,
  Save,
  Trash2,
  Copy,
} from "lucide-react";
import { FeatureShell } from "@/components/FeatureShell";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  PROMPT_CLASSICO,
  PROMPT_CONSOLIDADO,
} from "@/lib/vaultCopyAi";
import {
  buildSubfolderName,
  parsePasteLines,
  type PasteEntry,
} from "@/lib/vaultCopy";
import { runCopyFiles, runLlms, runMerge } from "@/lib/vaultCopyExport";
import { idbDelete, idbGet, idbSet } from "@/lib/vaultCopyIdb";
import {
  loadVaultCopyUiPrefs,
  saveActivePresetId,
  saveDestAbsPath,
  savePasteArea,
} from "@/lib/vaultCopyPrefs";
import {
  DEFAULT_DEST_ABS,
  DEFAULT_VAULT_ABS,
  detectVaultLayout,
  ensurePermission,
  hasFsAccess,
  pickDestDirectory,
  pickVaultDirectory,
  restoreDestFromIdb,
  restoreVaultFromIdb,
  saveDestSelection,
  saveVaultSelection,
  vaultLayoutHint,
  type VaultLayout,
} from "@/lib/vaultFs";

export const Route = createFileRoute("/vault-copy")({
  head: () => ({
    meta: [
      { title: "Vault Copy — Vault Hub" },
      {
        name: "description",
        content: "Cole caminhos do vault e copie ou consolide conversas numa pasta destino.",
      },
    ],
  }),
  component: VaultCopy,
});

type Preset = { id: string; name: string; prompt: string; builtin?: boolean };

const BUILTIN_PRESETS: Preset[] = [
  {
    id: "builtin-consolidado",
    name: "Consolidado — índice, tags (200 pal)",
    builtin: true,
    prompt: PROMPT_CONSOLIDADO,
  },
  {
    id: "builtin-classico",
    name: "Clássico — título + resumo (500 pal)",
    builtin: true,
    prompt: PROMPT_CLASSICO,
  },
];

type ItemState = "read" | "ai" | "copy" | "ok" | "fail" | "skip";
type ProgressItem = { path: string; state: ItemState; note?: string };

type ResultItem = { className: string; tag: string; label: string };

function VaultCopy() {
  const [mounted, setMounted] = useState(false);
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [vaultLayout, setVaultLayout] = useState<VaultLayout | null>(null);
  const [vaultPerm, setVaultPerm] = useState<"pending" | "ok" | "warn">("pending");
  const [destHandle, setDestHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [destPerm, setDestPerm] = useState<"pending" | "ok" | "warn">("pending");
  const [destAbsPath, setDestAbsPath] = useState(DEFAULT_DEST_ABS);

  const [pasted, setPasted] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL);
  const [mergePrompt, setMergePrompt] = useState(PROMPT_CONSOLIDADO);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState(BUILTIN_PRESETS[0].id);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    mode: string;
    step: string;
    items: ProgressItem[];
  } | null>(null);
  const [results, setResults] = useState<{
    summaryHtml: string;
    listItems: ResultItem[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hasFsAccess()) return;
    void (async () => {
      const [key, prompt, model, presets, savedVault, savedDest, uiPrefs] = await Promise.all([
        idbGet<string>("apiKey"),
        idbGet<string>("mergePrompt"),
        idbGet<string>("aiModel"),
        idbGet<Preset[]>("savedPrompts"),
        restoreVaultFromIdb(),
        restoreDestFromIdb(),
        loadVaultCopyUiPrefs(),
      ]);
      if (key) setApiKey(key);
      if (prompt) setMergePrompt(prompt);
      if (model) setAiModel(model);
      if (presets?.length) setUserPresets(presets);
      if (uiPrefs.destAbsPath) setDestAbsPath(uiPrefs.destAbsPath);
      if (uiPrefs.pasteArea !== undefined) setPasted(uiPrefs.pasteArea);
      if (uiPrefs.activePresetId) setActivePresetId(uiPrefs.activePresetId);

      if (savedVault) {
        setVaultHandle(savedVault.handle);
        setVaultLayout(savedVault.layout);
        let perm = await savedVault.handle.queryPermission({ mode: "read" });
        if (perm !== "granted") {
          perm = await savedVault.handle.requestPermission({ mode: "read" });
        }
        setVaultPerm(perm === "granted" ? "ok" : "warn");
      }
      if (savedDest) {
        setDestHandle(savedDest);
        let perm = await savedDest.queryPermission({ mode: "readwrite" });
        if (perm !== "granted") {
          perm = await savedDest.requestPermission({ mode: "readwrite" });
        }
        setDestPerm(perm === "granted" ? "ok" : "warn");
      }
    })();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const t = window.setTimeout(() => {
      void savePasteArea(pasted);
    }, 400);
    return () => window.clearTimeout(t);
  }, [pasted, mounted]);

  const allPresets = useMemo(() => [...BUILTIN_PRESETS, ...userPresets], [userPresets]);

  const entries: PasteEntry[] = useMemo(
    () => parsePasteLines(pasted, vaultHandle?.name ?? null, vaultLayout),
    [pasted, vaultHandle?.name, vaultLayout],
  );
  const okEntries = useMemo(
    () => entries.filter((e): e is Extract<PasteEntry, { status: "ok" }> => e.status === "ok"),
    [entries],
  );
  const skipEntries = useMemo(() => entries.filter((e) => e.status === "skip"), [entries]);

  const vaultReady = vaultHandle !== null && vaultPerm === "ok";
  const destReady = destHandle !== null && destPerm === "ok";
  const canRun = vaultReady && destReady && okEntries.length > 0 && !busy;

  async function selectVault() {
    try {
      const handle = await pickVaultDirectory();
      const layout = await detectVaultLayout(handle);
      await saveVaultSelection(handle, layout);
      setVaultHandle(handle);
      setVaultLayout(layout);
      setVaultPerm("ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError") alert("Erro ao selecionar vault: " + (e as Error).message);
    }
  }

  async function authorizeVault() {
    if (!vaultHandle) {
      await selectVault();
      return;
    }
    if (await ensurePermission(vaultHandle, "read")) {
      setVaultPerm("ok");
      if (!vaultLayout) {
        const layout = await detectVaultLayout(vaultHandle);
        setVaultLayout(layout);
        await saveVaultSelection(vaultHandle, layout);
      }
    }
  }

  async function authorizeDest() {
    if (!destHandle) {
      await selectDest();
      return;
    }
    if (await ensurePermission(destHandle, "readwrite")) {
      setDestPerm("ok");
    }
  }

  async function selectDest() {
    try {
      const handle = await pickDestDirectory();
      await saveDestSelection(handle);
      setDestHandle(handle);
      setDestPerm("ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError") alert("Erro ao selecionar destino: " + (e as Error).message);
    }
  }

  async function ensureVault(): Promise<{
    handle: FileSystemDirectoryHandle;
    layout: VaultLayout;
  } | null> {
    if (vaultHandle && (await ensurePermission(vaultHandle, "read"))) {
      setVaultPerm("ok");
      let layout = vaultLayout;
      if (!layout) {
        layout = await detectVaultLayout(vaultHandle);
        setVaultLayout(layout);
        await saveVaultSelection(vaultHandle, layout);
      }
      return { handle: vaultHandle, layout };
    }
    try {
      const handle = await pickVaultDirectory();
      const layout = await detectVaultLayout(handle);
      await saveVaultSelection(handle, layout);
      setVaultHandle(handle);
      setVaultLayout(layout);
      setVaultPerm("ok");
      return { handle, layout };
    } catch (e) {
      if ((e as Error).name !== "AbortError") alert("Erro ao selecionar vault: " + (e as Error).message);
      return null;
    }
  }

  async function ensureDest(): Promise<FileSystemDirectoryHandle | null> {
    if (destHandle && (await ensurePermission(destHandle, "readwrite"))) {
      setDestPerm("ok");
      return destHandle;
    }
    try {
      const handle = await pickDestDirectory();
      await saveDestSelection(handle);
      setDestHandle(handle);
      setDestPerm("ok");
      return handle;
    } catch (e) {
      if ((e as Error).name !== "AbortError") alert("Erro ao selecionar destino: " + (e as Error).message);
      return null;
    }
  }

  const makeCallbacks = useCallback(() => ({
    onPhase: (msg: string) => setProgress((p) => (p ? { ...p, step: msg } : p)),
    onItem: (index: number, state: ItemState, detail?: string) => {
      setProgress((p) => {
        if (!p) return p;
        const next = p.items.slice();
        if (next[index]) next[index] = { ...next[index], state, note: detail };
        return { ...p, items: next };
      });
    },
  }), []);

  async function runExport(
    mode: string,
    fn: (ctx: {
      vaultHandle: FileSystemDirectoryHandle;
      vaultLayout: VaultLayout;
      destHandle: FileSystemDirectoryHandle;
    }) => Promise<{ summaryHtml: string; listItems: ResultItem[] }>,
  ) {
    const vault = await ensureVault();
    const dHandle = await ensureDest();
    if (!vault || !dHandle) return;

    const items: ProgressItem[] = okEntries.map((e) => ({
      path: e.relPath,
      state: "read" as ItemState,
    }));
    setResults(null);
    setProgress({ mode, step: "A iniciar…", items });
    setBusy(mode);

    try {
      const result = await fn({
        vaultHandle: vault.handle,
        vaultLayout: vault.layout,
        destHandle: dHandle,
      });
      setResults(result);
      setProgress((p) =>
        p ? { ...p, step: "Concluído — veja o resultado abaixo.", items: p.items } : p,
      );
      requestAnimationFrame(() => {
        document.getElementById("vc-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      alert("Erro: " + (e as Error).message);
      setProgress((p) => (p ? { ...p, step: `Erro: ${(e as Error).message}` } : p));
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    const vault = await ensureVault();
    const dHandle = await ensureDest();
    if (!vault || !dHandle) return;
    const items: ProgressItem[] = entries.map((e) => ({
      path: e.status === "ok" ? e.relPath : e.sourceLine,
      state: "read" as ItemState,
    }));
    setResults(null);
    setProgress({ mode: "Copiar arquivos", step: "A iniciar…", items });
    setBusy("Copiar arquivos");
    try {
      const result = await runCopyFiles(
        {
          vaultHandle: vault.handle,
          vaultLayout: vault.layout,
          destHandle: dHandle,
          vaultName: vault.handle.name,
          apiKey,
          aiModel,
          mergePrompt,
          cb: makeCallbacks(),
        },
        entries,
      );
      setResults(result);
      setProgress((p) => (p ? { ...p, step: "Concluído — veja o resultado abaixo." } : p));
      requestAnimationFrame(() => {
        document.getElementById("vc-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      alert("Erro: " + (e as Error).message);
      setProgress((p) => (p ? { ...p, step: `Erro: ${(e as Error).message}` } : p));
    } finally {
      setBusy(null);
    }
  }

  async function handleMerge(useAI: boolean) {
    if (useAI && !apiKey.trim()) {
      alert('Configure a chave em "Configurações do Merge".');
      setSettingsOpen(true);
      return;
    }
    const label = useAI ? "Consolidado com IA" : "Consolidado sem IA";
    await runExport(label, (ctx) =>
      runMerge(
        {
          vaultHandle: ctx.vaultHandle,
          vaultLayout: ctx.vaultLayout,
          destHandle: ctx.destHandle,
          vaultName: ctx.vaultHandle.name,
          apiKey,
          aiModel,
          mergePrompt,
          cb: makeCallbacks(),
        },
        okEntries,
        useAI,
      ),
    );
  }

  async function handleLlms() {
    if (!apiKey.trim()) {
      alert('Configure a chave em "Configurações do Merge".');
      setSettingsOpen(true);
      return;
    }
    await runExport("Copiar + llms.txt", (ctx) =>
      runLlms(
        {
          vaultHandle: ctx.vaultHandle,
          vaultLayout: ctx.vaultLayout,
          destHandle: ctx.destHandle,
          vaultName: ctx.vaultHandle.name,
          apiKey,
          aiModel,
          mergePrompt,
          cb: makeCallbacks(),
        },
        okEntries,
      ),
    );
  }

  async function saveSettings(data: {
    apiKey: string;
    aiModel: string;
    mergePrompt: string;
    activePresetId: string;
    userPresets: Preset[];
  }) {
    setApiKey(data.apiKey);
    setAiModel(data.aiModel);
    setMergePrompt(data.mergePrompt);
    setActivePresetId(data.activePresetId);
    setUserPresets(data.userPresets);
    await idbSet("apiKey", data.apiKey);
    await idbSet("mergePrompt", data.mergePrompt);
    await idbSet("aiModel", data.aiModel);
    await idbSet("savedPrompts", data.userPresets.filter((p) => !p.builtin));
    await saveActivePresetId(data.activePresetId);
  }

  async function resetFolders() {
    if (!confirm("Apagar pastas salvas (vault e destino)? Na próxima abertura vai pedir para selecionar de novo.")) return;
    await Promise.all(["vault", "vaultLayout", "dest", "lastDestFullPath"].map((k) => idbDelete(k)));
    setVaultHandle(null);
    setVaultLayout(null);
    setVaultPerm("pending");
    setDestHandle(null);
    setDestPerm("pending");
  }

  if (!mounted) {
    return (
      <FeatureShell title="Vault Copy" description="A carregar…">
        <p className="text-sm text-muted-foreground">A carregar…</p>
      </FeatureShell>
    );
  }

  if (!hasFsAccess()) {
    return (
      <FeatureShell
        title="Vault Copy"
        description="Browser sem suporte à leitura de pastas locais."
      >
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm">
          <p className="font-semibold">Use Chrome ou Microsoft Edge</p>
          <p className="mt-2 text-muted-foreground">
            Esta página usa a File System Access API, disponível apenas no Chrome ou Edge.
          </p>
        </div>
      </FeatureShell>
    );
  }

  const subPreview = buildSubfolderName();

  return (
    <FeatureShell
      title="Vault Copy"
      description="Pesquise no Obsidian, cole os caminhos aqui e copie ou consolide numa pasta destino."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Extração
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Settings2 className="h-4 w-4" />
            Configurações do Merge
          </button>
          <button
            type="button"
            onClick={() => void resetFolders()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Resetar pastas
          </button>
        </div>
      </div>

      {/* Step 01 */}
      <StepCard
        num="01"
        title="Pasta do Vault"
        status={vaultPerm === "ok" ? `${vaultHandle?.name ?? "ok"}` : vaultPerm === "warn" ? "autorizar" : "pendente"}
        statusOk={vaultPerm === "ok"}
      >
        <button
          type="button"
          onClick={() => void selectVault()}
          className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {vaultHandle ? "Trocar pasta do vault" : "Selecionar pasta do vault (fonte)"}
        </button>
        {vaultHandle && vaultPerm === "warn" && (
          <button
            type="button"
            onClick={() => void authorizeVault()}
            className="ml-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20"
          >
            Autorizar pasta guardada
          </button>
        )}
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {vaultHandle ? (
            <>
              {vaultHandle.name}
              {vaultPerm === "warn" && (
                <span className="ml-2 text-amber-600">— restauro pendente de autorização</span>
              )}
              {vaultPerm === "ok" && (
                <span className="ml-2 text-emerald-600">— guardado neste browser</span>
              )}
            </>
          ) : (
            `padrão: ${DEFAULT_VAULT_ABS}`
          )}
        </p>
        {vaultLayout && vaultPerm === "ok" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Estrutura: {vaultLayoutHint(vaultLayout)}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Padrão esperado: <code className="font-mono">{DEFAULT_VAULT_ABS}</code>
        </p>
      </StepCard>

      {/* Step 02 */}
      <StepCard
        num="02"
        title="Colar caminhos ou resultados"
        status={
          okEntries.length > 0
            ? `${okEntries.length} caminho${okEntries.length === 1 ? "" : "s"}`
            : skipEntries.length > 0
              ? `${skipEntries.length} ignorado${skipEntries.length === 1 ? "" : "s"}`
              : "0 caminhos"
        }
        statusOk={okEntries.length > 0}
        className="mt-4"
      >
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={`Cole caminhos ou resultados de busca (Ctrl+V). Exemplos:

D:\\2606VAULT-ClaudeConversasOF-FINAL\\2026-05-17-Topico.md
[[2026-05-17-Topico]]
2026-05-17-Topico.md`}
          spellCheck={false}
          className="h-44 w-full rounded-lg border border-border bg-background/60 p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setPasted("")}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          limpar área de cola
        </button>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Caminhos colados são guardados automaticamente neste browser.
        </p>
        {skipEntries.length > 0 && (
          <details className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              {skipEntries.length} linha(s) ignorada(s)
            </summary>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {skipEntries.map((p, i) => (
                <li key={i} className="font-mono">
                  <span className="text-rose-500">SKIP</span> · {p.reason} ·{" "}
                  <span className="opacity-70">{p.sourceLine}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </StepCard>

      {/* Step 03 */}
      <StepCard
        num="03"
        title="Pasta destino"
        status={destPerm === "ok" ? destHandle?.name ?? "ok" : destPerm === "warn" ? "autorizar" : "pendente"}
        statusOk={destPerm === "ok"}
        className="mt-4"
      >
        <button
          type="button"
          onClick={() => void selectDest()}
          className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {destHandle ? "Trocar pasta destino" : "Selecionar pasta destino"}
        </button>
        {destHandle && destPerm === "warn" && (
          <button
            type="button"
            onClick={() => void authorizeDest()}
            className="ml-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20"
          >
            Autorizar pasta guardada
          </button>
        )}
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {destHandle ? (
            <>
              {destHandle.name}
              {destPerm === "ok" && (
                <span className="ml-2 text-emerald-600">— guardado neste browser</span>
              )}
            </>
          ) : (
            `padrão: ${DEFAULT_DEST_ABS}`
          )}
        </p>
        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Caminho absoluto da pasta destino (referência)
        </label>
        <input
          type="text"
          value={destAbsPath}
          onChange={(e) => {
            setDestAbsPath(e.target.value);
            void saveDestAbsPath(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Nova subpasta a cada cópia: <code className="font-mono">{subPreview}</code>
          <br />
          <span className="text-[11px]">
            Consolidado (.md) grava na <strong>raiz</strong> desta pasta; Copiar arquivos / llms usam a subpasta acima.
          </span>
        </p>
      </StepCard>

      {/* Exports */}
      <section className="mt-6 space-y-3">
        <ExportBtn
          primary
          icon={Sparkles}
          label="Gerar consolidado (com IA)"
          busy={busy === "Consolidado com IA"}
          disabled={!canRun}
          onClick={() => void handleMerge(true)}
        />
        <ExportBtn
          icon={FileText}
          label="Gerar consolidado (1 .md, sem IA)"
          busy={busy === "Consolidado sem IA"}
          disabled={!canRun}
          onClick={() => void handleMerge(false)}
        />
        <ExportBtn
          icon={Copy}
          label="Copiar arquivos"
          busy={busy === "Copiar arquivos"}
          disabled={!canRun}
          onClick={() => void handleCopy()}
        />
        <ExportBtn
          icon={FolderOpen}
          label="Copiar + gerar llms.txt"
          busy={busy === "Copiar + llms.txt"}
          disabled={!canRun}
          onClick={() => void handleLlms()}
        />
      </section>

      {!vaultReady || !destReady ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Selecione vault e destino (passos 01 e 03) e cole ≥1 caminho válido.
        </p>
      ) : null}

      {results && (
        <section id="vc-results" className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">Resultado</h2>
          <div
            className="text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: results.summaryHtml }}
          />
          <ul className="mt-4 space-y-1 text-xs">
            {results.listItems.map((it, i) => (
              <li key={i} className="flex items-start gap-2 font-mono">
                <StateTag state={it.tag as ItemState} />
                <span className={it.className === "fail" ? "text-rose-500" : ""}>{it.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {settingsOpen && (
        <SettingsModal
          apiKey={apiKey}
          aiModel={aiModel}
          mergePrompt={mergePrompt}
          activePresetId={activePresetId}
          userPresets={userPresets}
          allPresets={allPresets}
          onClose={() => setSettingsOpen(false)}
          onSave={(d) => void saveSettings(d)}
        />
      )}

      {progress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{progress.mode}</h3>
              {!busy && (
                <button
                  type="button"
                  onClick={() => setProgress(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{progress.step}</p>
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-xs">
              {progress.items.map((it, i) => (
                <li key={i} className="flex items-center gap-2 font-mono">
                  <StateTag state={it.state} />
                  <span className="truncate">{it.path}</span>
                  {it.note && (
                    <span className="ml-auto truncate text-[10px] text-muted-foreground">{it.note}</span>
                  )}
                </li>
              ))}
            </ul>
            {!busy && (
              <button
                type="button"
                onClick={() => setProgress(null)}
                className="mt-4 w-full rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}
    </FeatureShell>
  );
}

function StepCard({
  num,
  title,
  status,
  statusOk,
  className = "",
  children,
}: {
  num: string;
  title: string;
  status: string;
  statusOk?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-6 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {num}
          </span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            statusOk
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {status}
        </span>
      </header>
      {children}
    </section>
  );
}

function ExportBtn({
  icon: Icon,
  label,
  disabled,
  busy,
  primary,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "text-primary-foreground"
          : "border border-border bg-card hover:bg-accent"
      }`}
      style={primary ? { backgroundImage: "var(--gradient-brand)" } : undefined}
    >
      <Icon className="h-4 w-4" />
      {busy ? "A processar…" : label}
    </button>
  );
}

function SettingsModal({
  apiKey: initKey,
  aiModel: initModel,
  mergePrompt: initPrompt,
  activePresetId: initPresetId,
  userPresets: initUserPresets,
  allPresets,
  onClose,
  onSave,
}: {
  apiKey: string;
  aiModel: string;
  mergePrompt: string;
  activePresetId: string;
  userPresets: Preset[];
  allPresets: Preset[];
  onClose: () => void;
  onSave: (d: {
    apiKey: string;
    aiModel: string;
    mergePrompt: string;
    activePresetId: string;
    userPresets: Preset[];
  }) => void;
}) {
  const [apiKey, setApiKey] = useState(initKey);
  const [aiModel, setAiModel] = useState(initModel);
  const [mergePrompt, setMergePrompt] = useState(initPrompt);
  const [activePresetId, setActivePresetId] = useState(initPresetId);
  const [userPresets, setUserPresets] = useState(initUserPresets);
  const [draftName, setDraftName] = useState("");

  const active = allPresets.find((p) => p.id === activePresetId) ?? allPresets[0];
  const isBuiltin = !!active?.builtin;

  function selectPreset(id: string) {
    const p = allPresets.find((x) => x.id === id);
    if (!p) return;
    setActivePresetId(id);
    setMergePrompt(p.prompt);
  }

  return (
    <ModalShell title="Configurações do Merge" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chave API Anthropic
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Gravada neste browser (IndexedDB). Não vai para o Git nem para servidor.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Modelo
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prompts favoritos
          </label>
          <select
            value={activePresetId}
            onChange={(e) => selectPreset(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {allPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.builtin ? "★ " : ""}
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prompt ativo
          </label>
          <textarea
            value={mergePrompt}
            onChange={(e) => setMergePrompt(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Nome do novo preset"
            className="min-w-[160px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              const p: Preset = { id: `u-${Date.now()}`, name: draftName.trim(), prompt: mergePrompt };
              setUserPresets([...userPresets, p]);
              setActivePresetId(p.id);
              setDraftName("");
            }}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Salvar como novo
          </button>
          <button
            type="button"
            disabled={isBuiltin}
            onClick={() =>
              setUserPresets(userPresets.map((p) => (p.id === active.id ? { ...p, prompt: mergePrompt } : p)))
            }
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            type="button"
            disabled={isBuiltin}
            onClick={() => {
              const next = userPresets.filter((p) => p.id !== active.id);
              setUserPresets(next);
              setActivePresetId(BUILTIN_PRESETS[0].id);
              setMergePrompt(BUILTIN_PRESETS[0].prompt);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Apagar
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onSave({ apiKey, aiModel, mergePrompt, activePresetId, userPresets });
            onClose();
          }}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          Guardar configurações
        </button>
      </div>
    </ModalShell>
  );
}

function StateTag({ state }: { state: ItemState | string }) {
  const map: Record<string, string> = {
    read: "bg-sky-500/15 text-sky-500",
    LER: "bg-sky-500/15 text-sky-500",
    ai: "bg-violet-500/15 text-violet-500",
    IA: "bg-violet-500/15 text-violet-500",
    copy: "bg-amber-500/15 text-amber-500",
    CPY: "bg-amber-500/15 text-amber-500",
    ok: "bg-emerald-500/15 text-emerald-500",
    OK: "bg-emerald-500/15 text-emerald-500",
    fail: "bg-rose-500/15 text-rose-500",
    FAIL: "bg-rose-500/15 text-rose-500",
    skip: "bg-muted text-muted-foreground",
    SKIP: "bg-muted text-muted-foreground",
  };
  const label = { read: "LER", ai: "IA", copy: "CPY", ok: "OK", fail: "FAIL", skip: "SKIP" }[state] ?? state;
  return (
    <span
      className={`inline-block w-11 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[10px] font-semibold ${map[state] ?? map.OK}`}
    >
      {label}
    </span>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
