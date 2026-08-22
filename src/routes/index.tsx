import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { LoadingState, ResultsPanel } from "@/components/results-panel";
import { SearchPanel } from "@/components/search-panel";
import { findPrintableModels } from "@/lib/search";
import type { SearchOutcome } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1800);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (busy || !outcome) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [busy, outcome]);

  async function onSearch(input: { text: string; imageDataUrl?: string }) {
    setBusy(true);
    setTick(0);
    try {
      const next = await findPrintableModels({ data: input });
      setOutcome(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went sideways. Try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <div className="bed-grid bed-fade pointer-events-none absolute inset-0" />
      <AppHeader />
      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Snap it. Search it. Print it.
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Can I 3D Print This?
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted">
            Upload a photo or describe an object. We look across popular model
            sites for a free file you can print tonight.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-xl">
          <SearchPanel busy={busy} onSearch={onSearch} />
        </div>

        <div ref={resultsRef} className="mt-12 w-full scroll-mt-24">
          {busy ? <LoadingState messageIndex={tick} /> : null}
          {!busy && outcome ? <ResultsPanel outcome={outcome} /> : null}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
