import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import type { ReactNode } from "react";

export function FeatureShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao menu
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Início
          </Link>
        </nav>
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-2 text-muted-foreground">{description}</p>
          )}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
