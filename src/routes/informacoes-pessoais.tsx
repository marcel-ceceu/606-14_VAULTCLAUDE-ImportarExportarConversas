import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FeatureShell } from "@/components/FeatureShell";

export const Route = createFileRoute("/informacoes-pessoais")({
  head: () => ({ meta: [{ title: "Informações Pessoais — Vault Hub" }] }),
  component: InformacoesPessoais,
});

const initialData = {
  nome: "João da Silva",
  email: "joao@exemplo.com",
  vaultPath: "/Users/joao/Obsidian/MeuVault",
  bio: "Entusiasta de produtividade, programação e conhecimento pessoal.",
};

function InformacoesPessoais() {
  const [data, setData] = useState(initialData);
  const [saved, setSaved] = useState(false);

  const update = (k: keyof typeof data, v: string) => {
    setData((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  return (
    <FeatureShell
      title="Informações Pessoais"
      description="Gerencie seus dados, preferências e caminho do vault Obsidian."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="space-y-5 rounded-xl border border-border bg-card p-6"
      >
        {(
          [
            ["nome", "Nome"],
            ["email", "Email"],
            ["vaultPath", "Caminho do Vault Obsidian"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-card-foreground">
              {label}
            </label>
            <input
              value={data[key]}
              onChange={(e) => update(key, e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}

        <div>
          <label className="mb-1 block text-sm font-medium text-card-foreground">Bio</label>
          <textarea
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Salvar alterações
          </button>
          {saved && (
            <span className="text-sm text-emerald-600">Salvo (mock) ✓</span>
          )}
        </div>
      </form>
    </FeatureShell>
  );
}
