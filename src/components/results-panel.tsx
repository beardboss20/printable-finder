import { Check, ExternalLink, Hammer, SearchX, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelCard } from "@/components/model-card";
import { SITE_LABEL } from "@/lib/sites";
import type { SearchOutcome, SiteStatus, Verdict } from "@/lib/types";

const LOADING_WITH_PHOTO = [
  "Identifying the object…",
  "Searching Printables, Thangs, MakerWorld…",
  "Comparing designs to your photo…",
] as const;

const LOADING_TEXT_ONLY = [
  "Identifying the object…",
  "Searching Printables, Thangs, MakerWorld…",
  "Ranking the closest designs…",
] as const;

export function LoadingState({
  elapsedMs,
  hasPhoto,
  preview,
}: {
  elapsedMs: number;
  hasPhoto: boolean;
  preview?: string | null;
}) {
  const lines = hasPhoto ? LOADING_WITH_PHOTO : LOADING_TEXT_ONLY;
  const stage = elapsedMs < 3_500 ? 0 : elapsedMs < 11_000 ? 1 : 2;
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-3xl bg-surface px-6 py-12 text-center shadow-[var(--shadow-border)]"
    >
      {preview ? (
        <img
          src={preview}
          alt="Photo being searched"
          className="mx-auto mb-5 h-20 w-20 rounded-xl object-cover shadow-[var(--shadow-lift)]"
        />
      ) : (
        <div className="layer-stack mx-auto mb-6 flex h-14 w-16 flex-col justify-end gap-1">
          <span className="h-2 rounded-sm bg-fg/70 [animation:layer-rise_1.2s_ease-in-out_infinite]" />
          <span className="h-2 rounded-sm bg-fg/50 [animation:layer-rise_1.2s_ease-in-out_0.15s_infinite]" />
          <span className="h-2 rounded-sm bg-fg/30 [animation:layer-rise_1.2s_ease-in-out_0.3s_infinite]" />
        </div>
      )}
      <p className="font-display text-lg font-semibold tracking-tight">{lines[stage]}</p>
      <p className="mt-2 text-sm text-muted tabular-nums">{seconds}s</p>
    </div>
  );
}

const VERDICT_STYLE: Record<Verdict, { icon: LucideIcon; wrap: string; iconClass: string }> = {
  exact: {
    icon: Check,
    wrap: "bg-ok/15",
    iconClass: "bg-ok text-primary-fg",
  },
  similar: {
    icon: Sparkles,
    wrap: "bg-surface",
    iconClass: "bg-elevated text-fg",
  },
  none: {
    icon: SearchX,
    wrap: "bg-danger/10",
    iconClass: "bg-danger/15 text-danger",
  },
};

function focusDescription() {
  const input = document.getElementById("describe");
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  input.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function ResultsPanel({ outcome }: { outcome: SearchOutcome }) {
  const verdictAttr =
    outcome.status === "needs_description" ? "needs_description" : outcome.verdict;

  if (outcome.status === "needs_description") {
    return (
      <section
        data-testid="results"
        data-verdict={verdictAttr}
        className="rounded-3xl bg-surface px-6 py-10 text-center shadow-[var(--shadow-border)] sm:px-10"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {outcome.verdictTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
          {outcome.verdictDetail}
        </p>
        <Button type="button" size="lg" className="mt-6 rounded-xl" onClick={focusDescription}>
          Add a description
        </Button>
      </section>
    );
  }

  const style = VERDICT_STYLE[outcome.verdict];
  const Icon = style.icon;
  const features =
    outcome.description.features.length > 0
      ? outcome.description.features
      : [outcome.description.shape, outcome.description.materialGuess].filter(Boolean);

  return (
    <section data-testid="results" data-verdict={verdictAttr} className="space-y-6">
      <div className={`rounded-3xl px-5 py-5 shadow-[var(--shadow-border)] sm:px-6 ${style.wrap}`}>
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${style.iconClass}`}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {outcome.verdictTitle}
            </h2>
            {outcome.verdictDetail ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {outcome.verdictDetail}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {outcome.objectName ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            We think this is:{" "}
            <span className="font-display text-lg font-semibold text-fg">{outcome.objectName}</span>
          </p>
          {features.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-elevated px-3 py-1 text-sm text-muted shadow-[var(--shadow-border)]"
                >
                  {feature}
                </span>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={focusDescription}
            className="text-sm text-muted underline decoration-border underline-offset-4 hover:text-fg"
          >
            Not right? Add a description and search again
          </button>
        </div>
      ) : null}

      <SiteStatusLine rows={outcome.siteStatus} />

      {outcome.models.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcome.models.map((model) => (
            <ModelCard key={model.id} model={model} usedVision={outcome.usedVision} />
          ))}
        </div>
      ) : null}

      {outcome.verdict === "none" ? <StarterIdeas outcome={outcome} /> : null}
      <SiteSearchRow outcome={outcome} />
    </section>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-3xl bg-danger/10 px-6 py-8 text-center shadow-[var(--shadow-border)]"
    >
      <h2 className="font-display text-xl font-semibold tracking-tight">Search didn’t finish</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{message}</p>
      <Button type="button" className="mt-5 rounded-xl" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function SiteStatusLine({ rows }: { rows: SiteStatus[] }) {
  if (rows.length === 0) return null;
  const parts = rows.map((row) => {
    const label = SITE_LABEL[row.site];
    return row.status === "ok" ? `${label} (${row.count})` : `${label} unavailable`;
  });
  return <p className="text-sm text-muted">Searched {parts.join(", ")}</p>;
}

function StarterIdeas({ outcome }: { outcome: SearchOutcome }) {
  if (outcome.starterIdeas.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <Hammer className="size-4" />
        Starter ideas{outcome.objectName ? ` for ${outcome.objectName}` : ""}
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
      <Button asChild size="lg" className="rounded-xl">
        <a href="https://www.tinkercad.com" target="_blank" rel="noreferrer">
          Start designing it in Tinkercad
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </div>
  );
}

function SiteSearchRow({ outcome }: { outcome: SearchOutcome }) {
  if (outcome.siteSearches.length === 0) return null;
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
