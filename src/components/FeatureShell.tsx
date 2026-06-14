import { HubChromeTabs } from "@/components/HubChromeTabs";
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
    <div
      className="min-h-screen bg-background"
      style={{ backgroundImage: "var(--gradient-surface)" }}
    >
      <HubChromeTabs />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>
          )}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
