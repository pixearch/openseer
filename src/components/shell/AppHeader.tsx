"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { HotkeysModal } from "@/components/shell/HotkeysModal";
import { CREATE_MENU_ITEMS, WORKSPACE_CONTEXT_DEFAULT } from "@/lib/nav/navigation";

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [hotkeysKey, setHotkeysKey] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setCreateOpen(false);
    },
    [router]
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 sm:px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
        aria-label="Toggle navigation"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <Link href="/" className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-600 to-indigo-700 text-xs font-bold text-white">
          OS
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-zinc-100 sm:inline">
          OpenSeer
        </span>
      </Link>

      <div className="hidden min-w-0 max-w-[220px] truncate rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 md:block">
        {WORKSPACE_CONTEXT_DEFAULT}
      </div>

      <div className="mx-2 hidden min-w-0 flex-1 lg:block">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search graphs, projects, documents…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/80 py-1.5 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-700"
            disabled
            title="Global search (MVP placeholder)"
          />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative" ref={createRef}>
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            className="flex h-9 items-center gap-1 rounded-md bg-sky-700 px-2.5 text-sm font-medium text-white hover:bg-sky-600 sm:px-3"
          >
            <span className="hidden sm:inline">Create</span>
            <span className="sm:hidden">+</span>
            <svg className="h-4 w-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {createOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default bg-transparent"
                aria-label="Close create menu"
                onClick={() => setCreateOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                {CREATE_MENU_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => go(item.href)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          title="Notifications (MVP)"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-500 ring-2 ring-zinc-950" />
        </button>

        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            className="flex h-9 items-center rounded-md px-2 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            aria-haspopup="menu"
            aria-expanded={helpOpen}
          >
            Help
          </button>
          {helpOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default bg-transparent"
                aria-label="Close help menu"
                onClick={() => setHelpOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    setHelpOpen(false);
                    setHotkeysKey((k) => k + 1);
                    setHotkeysOpen(true);
                  }}
                >
                  Hotkeys
                </button>
              </div>
            </>
          ) : null}
        </div>
        <HotkeysModal
          key={hotkeysKey}
          open={hotkeysOpen}
          onClose={() => setHotkeysOpen(false)}
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            aria-label="Profile menu"
          >
            SC
          </button>
          {profileOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default bg-transparent"
                aria-label="Close profile menu"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <Link
                  href="/settings/profile"
                  className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setProfileOpen(false)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-500"
                  disabled
                >
                  Sign out (MVP)
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
