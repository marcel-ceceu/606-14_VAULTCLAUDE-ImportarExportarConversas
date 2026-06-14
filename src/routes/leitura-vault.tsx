import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FeatureShell } from "@/components/FeatureShell";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/leitura-vault")({
  head: () => ({ meta: [{ title: "Leitura do Vault — Vault Hub" }] }),
  component: LeituraVault,
});

const mockNotes = [
  {
    id: "n1",
    title: "Plano de estudos React.md",
    content: "# Plano de estudos React\n\n- Hooks avançados\n- Suspense e streaming\n- Testes com Vitest\n\nMeta: 4 semanas para finalizar.",
  },
  {
    id: "n2",
    title: "Refatoração TypeScript.md",
    content: "# Refatoração TypeScript\n\nIdentificar tipos `any` e substituir por interfaces específicas. Habilitar `strict` no tsconfig.",
  },
  {
    id: "n3",
    title: "Configuração Obsidian.md",
    content: "# Configuração Obsidian\n\nPlugins essenciais:\n- Dataview\n- Templater\n- Git\n\nAtalhos personalizados configurados.",
  },
];

function LeituraVault() {
  const [activeId, setActiveId] = useState(mockNotes[0].id);
  const active = mockNotes.find((n) => n.id === activeId)!;

  return (
    <FeatureShell
      title="Leitura do Vault"
      description="Navegue pelas notas importadas no seu vault Obsidian."
    >
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-2">
          <ul className="space-y-1">
            {mockNotes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setActiveId(n.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeId === n.id
                      ? "bg-primary text-primary-foreground"
                      : "text-card-foreground hover:bg-accent"
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <article className="rounded-xl border border-border bg-card p-6">
          <pre className="whitespace-pre-wrap font-mono text-sm text-card-foreground">
            {active.content}
          </pre>
        </article>
      </div>
    </FeatureShell>
  );
}
