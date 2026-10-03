import { Box, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE_LABEL } from "@/lib/sites";
import type { RankedModel } from "@/lib/types";

export function ModelCard({ model, usedVision }: { model: RankedModel; usedVision: boolean }) {
  const [broken, setBroken] = useState(false);
  const percent = Math.round(Math.max(0, Math.min(1, model.matchScore)) * 100);
  const siteLabel = SITE_LABEL[model.site];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 hover:shadow-[var(--shadow-border-hover)]">
      <div className="relative aspect-[4/3] bg-elevated">
        {model.imageUrl && !broken ? (
          <img
            src={model.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <Box className="size-10" />
          </div>
        )}
        <Badge className="absolute left-3 top-3">{siteLabel}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-base font-semibold leading-snug tracking-tight">
          {model.title}
        </h3>
        {model.author ? <p className="truncate text-xs text-muted">by {model.author}</p> : null}
        {usedVision ? (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-fg tabular-nums">{percent}% match</span>
            {model.matchReason ? ` — ${model.matchReason}` : null}
          </p>
        ) : (
          <p className="text-xs font-medium text-muted">Title match</p>
        )}
        <Button asChild variant="secondary" className="mt-auto w-full rounded-lg">
          <a href={model.url} target="_blank" rel="noreferrer">
            Open on {siteLabel}
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </article>
  );
}
