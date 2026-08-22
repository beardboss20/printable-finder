import { Link } from "@tanstack/react-router";
import { AuthSlot } from "@/components/auth-slot";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated shadow-[var(--shadow-border)]">
            <svg viewBox="0 0 24 24" className="size-5 text-fg" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                d="M4 15.5 12 20l8-4.5v-7L12 4 4 8.5z"
              />
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                d="M4 8.5 12 13l8-4.5M12 13v7"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold tracking-tight sm:text-base">
              Can I 3D Print This?
            </span>
            <span className="hidden text-xs text-muted sm:block">
              Snap it. Search it. Print it.
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AuthSlot />
        </div>
      </div>
    </header>
  );
}
