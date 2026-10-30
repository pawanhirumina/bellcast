"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChannelComposer } from "./channel-composer";
import { Composer } from "./composer";
import { OfflineBanner } from "./offline-banner";
import { SearchProvider } from "./search-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSettings = pathname === "/app/settings";
  const topic = pathname.startsWith("/app/t/")
    ? decodeURIComponent(pathname.split("/")[3] ?? "")
    : null;

  return (
    <SearchProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
        <div className="hidden w-[248px] shrink-0 md:block">
          <Sidebar onCompose={() => setComposerOpen(true)} />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 w-[280px] max-w-[85vw]">
              <Sidebar
                onCompose={() => {
                  setMobileOpen(false);
                  setComposerOpen(true);
                }}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <Topbar
            topic={topic}
            isSettings={isSettings}
            onMenu={() => setMobileOpen(true)}
            onCompose={() => setComposerOpen(true)}
          />
          <OfflineBanner />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {!isSettings ? (
            <ChannelComposer
              key={topic ?? "activity"}
              topic={topic}
              onAdvanced={() => setComposerOpen(true)}
            />
          ) : null}
        </div>

        {composerOpen ? (
          <Composer
            defaultTopic={topic ?? "general"}
            onClose={() => setComposerOpen(false)}
          />
        ) : null}
      </div>
    </SearchProvider>
  );
}
