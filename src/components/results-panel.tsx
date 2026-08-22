import { ExternalLink, Hammer, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelCard } from "@/components/model-card";
import type { SearchOutcome } from "@/lib/types";

const LOADING_LINES = [
  "Hunting for printable files…",
  "Checking Printables and Thangs…",
  "Slicing the search space…",
  "Looking for a free STL…",
];

export function LoadingState({ messageIndex }: { messageIndex: number }) {
  return (
    <div className="rounded-3xl bg-surface px-6 py-12 text-center shadow-[var(--shadow-border)]">
      <div className="layer-stack mx-auto mb-6 flex h-14 w-16 flex-col justify-end gap-1">
        <span className="h-2 rounded-sm bg-fg/70 [animation:layer-rise_1.2s_ease-in-out_infinite]" />
        <span className="h-2 rounded-sm bg-fg/50 [animation:layer-rise_1.2s_ease-in-out_0.15s_infinite]" />
        <span className="h-2 rounded-sm bg-fg/30 [animation:layer-rise_1.2s_ease-in-out_0.3s_infinite]" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">
        {LOADING_LINES[messageIndex % LOADING_LINES.length]}
      </p>
      <p className="mt-2 text-sm text-muted">This usually takes a few seconds.</p>
    </div>
  );
}

export function ResultsPanel({ outcome }: { outcome: SearchOutcome }) {
  if (outcome.models.length === 0) {
    return <NoMatch outcome={outcome} />;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          Results
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {outcome.summary}
        </h2>
        {outcome.note ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted">{outcome.note}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {outcome.models.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>

      <SiteSearchRow outcome={outcome} />
    </section>
  );
}

function NoMatch({ outcome }: { outcome: SearchOutcome }) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-surface px-6 py-10 text-center shadow-[var(--shadow-border)] sm:px-10">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-elevated shadow-[var(--shadow-border)]">
          <Printer className="size-5" />
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          No solid free printable match found for this.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
          {outcome.note ||
            "Nothing close enough turned up on the usual model sites. You can still design a simple version in a few minutes."}
        </p>
        <Button asChild size="lg" className="mt-6 rounded-xl">
          <a href="https://www.tinkercad.com" target="_blank" rel="noreferrer">
            Start designing it in Tinkercad
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>

      {outcome.starterIdeas.length > 0 ? (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Hammer className="size-4" />
            Starter ideas for {outcome.objectName}
          </h3>
          <ol className="space-y-3">
            {outcome.starterIdeas.map((idea, index) => (
              <li
                key={idea}
                className="flex gap-3 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium tabular-nums">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed">{idea}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <SiteSearchRow outcome={outcome} />
    </section>
  );
}

function SiteSearchRow({ outcome }: { outcome: SearchOutcome }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Search the same idea on every site</p>
      <div className="flex flex-wrap gap-2">
        {outcome.siteSearches.map((link) => (
          <a
            key={link.site}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full bg-elevated px-4 text-sm shadow-[var(--shadow-border)] transition-colors hover:text-fg"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
