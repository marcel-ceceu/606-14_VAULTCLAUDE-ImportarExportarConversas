import { createFileRoute } from "@tanstack/react-router";
import { FeatureShell } from "@/components/FeatureShell";
import { MessageSquareText, FileText, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — Vault Hub" }] }),
  component: Insights,
});

const stats = [
  { label: "Conversas importadas", value: "128", icon: MessageSquareText },
  { label: "Notas no vault", value: "342", icon: FileText },
  { label: "Última sincronização", value: "há 2h", icon: Clock },
  { label: "Crescimento semanal", value: "+12%", icon: TrendingUp },
];

const recent = [
  { action: "Importou", item: "Plano de estudos React", when: "há 10 min" },
  { action: "Editou", item: "Configuração Obsidian", when: "há 1h" },
  { action: "Importou", item: "Brainstorm produto SaaS", when: "ontem" },
];

function Insights() {
  return (
    <FeatureShell
      title="Insights"
      description="Visão geral das suas importações e atividade recente."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-2xl font-bold text-card-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Atividade recente</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {recent.map((r, i) => (
            <li key={i} className="flex items-center justify-between p-4 text-sm">
              <span className="text-card-foreground">
                <span className="font-medium">{r.action}</span> · {r.item}
              </span>
              <span className="text-muted-foreground">{r.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </FeatureShell>
  );
}
