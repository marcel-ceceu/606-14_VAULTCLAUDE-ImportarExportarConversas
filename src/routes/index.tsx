import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquareText,
  BookOpen,
  User,
  Sparkles,
  Search,
  Vault,
  Copy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vault Hub — Central de aplicações" },
      {
        name: "description",
        content:
          "Central de aplicações do Vault Hub: importe conversas do Claude para o Obsidian, leia seu vault e gerencie informações pessoais.",
      },
    ],
  }),
  component: Index,
});

type AppCard = {
  to: "/importar-claude" | "/leitura-vault" | "/informacoes-pessoais" | "/insights" | "/vault-copy";
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  category: "Importação" | "Leitura" | "Perfil" | "Análise" | "Extração";
  iconBg: string;
  iconFg: string;
};

const apps: AppCard[] = [
  {
    to: "/importar-claude",
    title: "Importar Conversas Claude",
    shortTitle: "Importar Claude",
    description: "Traga conversas do Claude para notas organizadas no seu PC, em dois passos simples.",
    icon: MessageSquareText,
    category: "Importação",
    iconBg: "bg-[oklch(0.48_0.18_280)]",
    iconFg: "text-white",
  },
  {
    to: "/leitura-vault",
    title: "Leitura do Vault",
    shortTitle: "Ler Vault",
    description: "Navegue e leia notas importadas do seu vault.",
    icon: BookOpen,
    category: "Leitura",
    iconBg: "bg-[oklch(0.62_0.18_200)]",
    iconFg: "text-white",
  },
  {
    to: "/informacoes-pessoais",
    title: "Informações Pessoais",
    shortTitle: "Perfil",
    description: "Gerencie dados, preferências e contexto pessoal.",
    icon: User,
    category: "Perfil",
    iconBg: "bg-[oklch(0.6_0.18_340)]",
    iconFg: "text-white",
  },
  {
    to: "/insights",
    title: "Insights",
    shortTitle: "Insights",
    description: "Visão geral das importações e atividade recente.",
    icon: Sparkles,
    category: "Análise",
    iconBg: "bg-[oklch(0.68_0.16_150)]",
    iconFg: "text-white",
  },
  {
    to: "/vault-copy",
    title: "Vault Copy",
    shortTitle: "Vault Copy",
    description: "Extraia, consolide e exporte conversas do vault (.zip / .md / llms.txt).",
    icon: Copy,
    category: "Extração",
    iconBg: "bg-[oklch(0.55_0.2_280)]",
    iconFg: "text-white",
  },
];

function Index() {
  return (
    <div
      className="min-h-screen bg-background"
      style={{ backgroundImage: "var(--gradient-surface)" }}
    >
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-md"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              <Vault className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-foreground">
                Vault Hub
              </p>
              <p className="text-xs text-muted-foreground">
                Central de aplicações
              </p>
            </div>
          </div>

          <div className="relative hidden w-96 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar aplicações…"
              className="w-full rounded-lg border border-border bg-background/70 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden h-2 w-2 rounded-full bg-emerald-500 sm:inline-block" />
            <span className="hidden sm:inline">Sincronizado</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-12">
        <section className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Aplicações
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Suas ferramentas, em um clique
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Selecione uma aplicação para abrir seu fluxo dedicado. Cada cartão é
              isolado e tratado de forma independente.
            </p>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground lg:block">
            <p>{apps.length} aplicações</p>
            <p>Atualizado agora</p>
          </div>
        </section>

        {/* Android-style launcher grid: dense, uniform tiles */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {apps.map(({ to, title, shortTitle, description, icon: Icon, category, iconBg, iconFg }) => (
            <Link
              key={to}
              to={to}
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg} ${iconFg} shadow-md transition-transform group-hover:scale-105`}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.25} />
                </div>
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {category}
                </span>
              </div>

              <div className="mt-5">
                <h2 className="text-base font-semibold leading-snug text-card-foreground">
                  {title}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {shortTitle}
                </span>
                <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Abrir →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-16 flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p>Vault Hub · v0.1 · dados em mock</p>
          <p>Foco desktop · pronto para integração</p>
        </footer>
      </main>
    </div>
  );
}
