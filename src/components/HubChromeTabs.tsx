import { Link, useRouterState } from "@tanstack/react-router";
import { Copy, MessageSquareText, Vault } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS = [
  {
    to: "/importar-claude" as const,
    label: "Importar Claude",
    icon: MessageSquareText,
  },
  {
    to: "/vault-copy" as const,
    label: "Vault Copy",
    icon: Copy,
  },
];

function TabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={[
        "group relative flex max-w-[220px] min-w-[140px] flex-1 items-center gap-2 rounded-t-lg border px-4 py-2.5 text-sm font-medium transition-colors sm:max-w-none sm:flex-none",
        active
          ? "z-10 -mb-px border-border border-b-background bg-background text-foreground shadow-sm"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
      <span className="truncate">{label}</span>
      {active && (
        <span
          className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
      )}
    </Link>
  );
}

export function HubChromeTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="border-b border-border/60 bg-card/70 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground shadow-sm"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Vault className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Vault Hub</p>
            <p className="text-[11px] text-muted-foreground">Importar · Exportar</p>
          </div>
        </div>

        <nav
          className="flex items-end gap-1 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Secções do Vault Hub"
        >
          {TABS.map((tab) => (
            <TabLink
              key={tab.to}
              {...tab}
              active={pathname === tab.to || pathname.startsWith(`${tab.to}/`)}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}
