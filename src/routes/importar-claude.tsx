import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FeatureShell } from "@/components/FeatureShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Download,
  Terminal,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import { buildPipelineCommand, PIPELINE_DEFAULTS } from "@/lib/pipeline.config";

export const Route = createFileRoute("/importar-claude")({
  head: () => ({
    meta: [
      { title: "Importar Conversas Claude — Vault Hub" },
      {
        name: "description",
        content:
          "Guia em dois passos: baixe suas conversas do Claude e transforme em notas prontas no seu computador.",
      },
    ],
  }),
  component: ImportarClaude,
});

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
      >
        {label} ↗
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copiar link: ${href}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </span>
  );
}

type TabId = "download" | "pipeline";

const TABS: { id: TabId; number: string; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "download", number: "01", title: "Baixar do Claude", icon: Download },
  { id: "pipeline", number: "02", title: "Transformar em notas", icon: Terminal },
];

function ImportarClaude() {
  const [activeTab, setActiveTab] = useState<TabId>("download");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const [whatOpen, setWhatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [outputVault, setOutputVault] = useState(PIPELINE_DEFAULTS.vault);
  const [outputFinal, setOutputFinal] = useState(PIPELINE_DEFAULTS.final);
  const [enableFinal, setEnableFinal] = useState(true);

  const pipelineCommand = useMemo(
    () =>
      buildPipelineCommand({
        vault: outputVault,
        final: outputFinal,
        skipFinal: !enableFinal,
      }),
    [outputVault, outputFinal, enableFinal],
  );

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pipelineCommand);
      } else {
        const ta = document.createElement("textarea");
        ta.value = pipelineCommand;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand falhou");
      }
      setCopyState("ok");
    } catch {
      setCopyState("err");
    }
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <FeatureShell
      title="Importar Conversas Claude"
      description="Em dois passos simples: baixe suas conversas e gere notas organizadas no seu PC."
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Importação
        </span>
      </div>

      {/* Resumo — o que o usuário ganha */}
      <div
        className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-sm font-semibold text-card-foreground">No final você terá</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="font-medium text-foreground">Notas prontas</strong> — em{" "}
              <code className="font-mono text-xs">{PIPELINE_DEFAULTS.vault}</code>
            </span>
          </li>
          <li className="flex gap-2">
            <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="font-medium text-foreground">Versão extra limpa</strong> — em{" "}
              <code className="font-mono text-xs">{PIPELINE_DEFAULTS.final}</code> (sem
              &quot;oi/obrigado/ok…&quot;)
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Tudo fica salvo no disco <strong className="text-foreground">D:</strong> do seu computador. Você
          não precisa entender de programação — só seguir os passos abaixo.
        </p>
      </div>

      {/* Tabs */}
      <div className="relative flex items-end gap-1 border-b border-border pl-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative -mb-px flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "z-10 border-border bg-card text-card-foreground"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
              style={active ? { boxShadow: "var(--shadow-card)" } : undefined}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold ${
                  active
                    ? "text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground"
                }`}
                style={active ? { backgroundImage: "var(--gradient-brand)" } : undefined}
              >
                {tab.number}
              </span>
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.title}</span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-px bg-card" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <section
        role="tabpanel"
        className="rounded-b-2xl rounded-tr-2xl border border-t-0 border-border bg-card p-6 sm:p-7"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {activeTab === "download" && (
          <>
            <header className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Você faz manualmente · cerca de 5 minutos
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-card-foreground">
                Baixar suas conversas do Claude
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O site do Claude manda um arquivo compactado por email. É só pedir, esperar e baixar.
              </p>
            </header>

            <ol className="space-y-4 text-sm leading-relaxed text-card-foreground">
              {[
                <>
                  Abra esta página de privacidade no <strong>Chrome ou Edge</strong> (janela normal do
                  navegador):
                  <ExternalLinkRow
                    href="https://claude.ai/settings/data-privacy-controls"
                    label="Abrir página do Claude"
                  />
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    Se não abrir direito, copie o link e cole numa aba nova do navegador.
                  </span>
                </>,
                <>
                  No menu, toque em <strong>Privacy</strong> e depois em <strong>Export data</strong>.
                  Confirme quando pedirem.
                </>,
                <>
                  Espere o email (geralmente de <strong>5 a 15 minutos</strong>). Para achar mais rápido, abra
                  seu Gmail buscando por &quot;anthropic&quot;:{" "}
                  <a
                    href="https://mail.google.com/mail/u/0/#search/anthropic"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    Abrir Gmail ↗
                  </a>
                </>,
                <>
                  Clique no link do email e <strong>baixe o arquivo</strong>. Deixe na pasta{" "}
                  <strong>Downloads</strong> do Windows (a pasta padrão de downloads). Não precisa renomear.
                </>,
                <>
                  Se vierem <strong>vários arquivos</strong> parecidos (parte 1, parte 2…), deixe todos em
                  Downloads. Na etapa seguinte o sistema junta tudo sozinho.
                </>,
              ].map((node, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{node}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab("pipeline")}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                Já baixei — próximo passo →
              </button>
            </div>
          </>
        )}

        {activeTab === "pipeline" && (
          <>
            <header className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Automático · cerca de 1 minuto
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-card-foreground">
                Transformar o download em notas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Um único comando no Windows faz todo o trabalho pesado. Você só copia, cola e aperta Enter.
              </p>
            </header>

            <div className="mb-6 rounded-xl border border-border bg-background/60 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-card-foreground">Pastas de saída</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Já vêm preenchidas com o padrão do projeto. O comando copiado usa estes caminhos.
              </p>

              <label className="mt-4 block text-xs font-medium text-muted-foreground">
                Pasta principal (notas formatadas)
              </label>
              <input
                type="text"
                value={outputVault}
                onChange={(e) => setOutputVault(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                spellCheck={false}
              />

              <div className="mt-4 flex items-start gap-3">
                <Checkbox
                  id="enableFinal"
                  checked={enableFinal}
                  onCheckedChange={(checked) => setEnableFinal(checked === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor="enableFinal" className="text-sm font-normal leading-snug text-card-foreground">
                    Também gerar versão sem cortesias (remove &quot;oi/obrigado/ok…&quot;) numa pasta{" "}
                    <strong>-FINAL</strong> ao lado
                  </Label>
                  {enableFinal && (
                    <>
                      <label
                        htmlFor="outputFinal"
                        className="mt-3 block text-xs font-medium text-muted-foreground"
                      >
                        Pasta -FINAL
                      </label>
                      <input
                        id="outputFinal"
                        type="text"
                        value={outputFinal}
                        onChange={(e) => setOutputFinal(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                        spellCheck={false}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Passos visuais — tutorial na interface */}
            <ol className="mb-6 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Como fazer</p>
              {[
                "Clique no botão verde abaixo: Copiar comando automático.",
                "Abra o PowerShell: menu Iniciar → digite PowerShell → abra o aplicativo azul.",
                "Clique dentro da janela preta, cole com Ctrl+V e aperte Enter.",
                "Espere terminar. Vai abrir um bloco de notas com o resumo. Pronto!",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-card-foreground">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-primary-foreground"
                    style={{ backgroundImage: "var(--gradient-brand)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={handleCopy}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              {copyState === "ok" ? (
                <>
                  <Check className="h-5 w-5" />
                  Comando copiado! Agora cole no PowerShell
                </>
              ) : copyState === "err" ? (
                <>
                  <AlertCircle className="h-5 w-5" />
                  Não copiou — tente de novo ou veja o texto avançado abaixo
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  Copiar comando automático
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCommand((v) => !v)}
              className="mb-5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {showCommand ? "Ocultar texto técnico do comando" : "Ver texto técnico do comando (opcional)"}
            </button>

            {showCommand && (
              <div className="mb-5 overflow-hidden rounded-xl border border-border bg-[oklch(0.18_0.03_270)]">
                <pre className="overflow-x-auto px-4 py-4 text-[11px] leading-relaxed text-white/80">
                  <code className="font-mono whitespace-pre">{pipelineCommand}</code>
                </pre>
              </div>
            )}

            {/* O que acontece — linguagem simples */}
            <div className="mb-5 overflow-hidden rounded-xl border border-border bg-background/60">
              <button
                type="button"
                onClick={() => setWhatOpen((v) => !v)}
                aria-expanded={whatOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30"
              >
                <span className="text-sm font-medium text-card-foreground">O que esse comando faz por você</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    whatOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {whatOpen && (
                <ul className="space-y-2.5 border-t border-border px-4 py-4 text-sm text-muted-foreground">
                  <li>• Acha o arquivo que você baixou do Claude (o mais recente em Downloads).</li>
                  <li>• Converte cada conversa em uma nota legível, com título e data.</li>
                  <li>• Tira o “texto de bastidor” que polui a leitura.</li>
                  <li>• Grava as notas em <code className="font-mono text-xs">{outputVault}</code>.</li>
                  <li>
                    {enableFinal
                      ? `• Gera versão sem cortesias em ${outputFinal}.`
                      : "• Não gera pasta -FINAL (opção desmarcada)."}
                  </li>
                  <li>• Mostra um resumo no Bloco de Notas quando terminar.</li>
                </ul>
              )}
            </div>

            {/* Deu certo? */}
            <div className="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-card-foreground">Como saber se deu certo</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>✓ Abriu o Bloco de Notas sozinho no final</li>
                <li>✓ No disco D: apareceram pastas com arquivos de conversas</li>
                <li>✓ Ao abrir uma nota, você vê o papo entre você e o Claude, organizado</li>
              </ul>
            </div>

            {/* Ajuda */}
            <div className="overflow-hidden rounded-xl border border-border bg-background/60">
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                aria-expanded={helpOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  Algo deu errado?
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    helpOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {helpOpen && (
                <ul className="space-y-3 border-t border-border px-4 py-4 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">“Não achei o arquivo”</strong> — Volte à etapa 1 e
                    confirme que o download do Claude está na pasta Downloads.
                  </li>
                  <li>
                    <strong className="text-foreground">“Scripts desabilitados”</strong> — Use o botão Copiar
                    acima (o comando já vem preparado para funcionar).
                  </li>
                  <li>
                    <strong className="text-foreground">“PowerShell não encontrado”</strong> — No menu
                    Iniciar, procure por &quot;PowerShell&quot; ou &quot;Terminal&quot;.
                  </li>
                  <li>
                    <strong className="text-foreground">Windows pediu permissão</strong> — Pode aceitar: o
                    processo roda só no seu PC e não envia dados para a internet.
                  </li>
                </ul>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveTab("download")}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                ← Voltar ao download
              </button>
            </div>
          </>
        )}
      </section>
    </FeatureShell>
  );
}
