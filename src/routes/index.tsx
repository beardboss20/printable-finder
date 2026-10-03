import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { ErrorCard, LoadingState, ResultsPanel } from "@/components/results-panel";
import { SearchPanel } from "@/components/search-panel";
import { findPrintableModels } from "@/lib/search";
import type { SearchOutcome } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message.trim() || "Something went sideways. Try again.";
  }
  return "Something went sideways. Try again.";
}

function Home() {
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const lastInput = useRef<{ text: string; imageDataUrl?: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 400);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (busy) return;
    if (outcome?.status === "needs_description") {
      const input = document.getElementById("describe");
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    if (outcome || error) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [busy, outcome, error]);

  async function onSearch(input: { text: string; imageDataUrl?: string }) {
    lastInput.current = input;
    setBusy(true);
    setElapsedMs(0);
    setError(null);
    setOutcome(null);
    try {
      const next = await findPrintableModels({ data: input });
      setOutcome(next);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (lastInput.current) void onSearch(lastInput.current);
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
            Upload a photo or describe an object. We look across popular model sites for a free file
            you can print tonight.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-xl">
          <SearchPanel busy={busy} onSearch={onSearch} onPreviewChange={setPreview} />
        </div>

        <div ref={resultsRef} className="mt-12 w-full scroll-mt-24">
          {busy ? (
            <LoadingState elapsedMs={elapsedMs} hasPhoto={Boolean(preview)} preview={preview} />
          ) : null}
          {!busy && error ? <ErrorCard message={error} onRetry={retry} /> : null}
          {!busy && !error && outcome ? <ResultsPanel outcome={outcome} /> : null}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
