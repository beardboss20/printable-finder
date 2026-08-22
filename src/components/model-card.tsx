import { Box, Download, ExternalLink, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE_LABEL } from "@/lib/sites";
import type { PrintableModel } from "@/lib/types";
import { formatCount } from "@/lib/utils";
import { useState } from "react";

export function ModelCard({ model }: { model: PrintableModel }) {
  const [broken, setBroken] = useState(false);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 hover:shadow-[var(--shadow-border-hover)]">
      <div className="relative aspect-[4/3] bg-elevated">
        {model.imageUrl && !broken ? (
          <img
            src={model.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <Box className="size-10" />
          </div>
        )}
        <Badge className="absolute left-3 top-3">{SITE_LABEL[model.site]}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-base font-semibold leading-snug tracking-tight">
          {model.title}
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted">
          {model.likes != null ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Heart className="size-3.5" />
              {formatCount(model.likes)}
            </span>
          ) : null}
          {model.downloads != null ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Download className="size-3.5" />
              {formatCount(model.downloads)}
            </span>
          ) : null}
          {model.author ? <span className="truncate">by {model.author}</span> : null}
        </div>
        <Button asChild variant="secondary" className="w-full rounded-lg">
          <a href={model.url} target="_blank" rel="noreferrer">
            View & Download
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </article>
  );
}
