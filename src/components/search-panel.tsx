import { ImagePlus, LoaderCircle, Search, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToCompressedDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

const EXAMPLES = ["phone stand", "cable clip", "Ender 3 fan duct", "headphone hook"];

type SearchPanelProps = {
  busy: boolean;
  onSearch: (input: { text: string; imageDataUrl?: string }) => void;
};

export function SearchPanel({ busy, onSearch }: SearchPanelProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function applyFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageDataUrl(dataUrl);
      setPreview(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not read that photo.");
    }
  }

  function clearPhoto() {
    setPreview(null);
    setImageDataUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    void applyFile(event.dataTransfer.files?.[0]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!text.trim() && !imageDataUrl) {
      setPhotoError("Drop a photo or type what you want to print.");
      return;
    }
    onSearch({ text: text.trim(), imageDataUrl });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "group relative flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl bg-surface px-5 py-8 text-center shadow-[var(--shadow-border)] transition-[box-shadow] duration-200",
          dragOver && "shadow-[var(--shadow-border-hover)]",
        )}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Selected object"
              className="absolute inset-0 size-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-bg/45" />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <img
                src={preview}
                alt=""
                className="h-28 w-28 rounded-xl object-cover shadow-[var(--shadow-lift)]"
              />
              <p className="text-sm font-medium">Photo ready. Add a note if you want.</p>
            </div>
          </>
        ) : (
          <>
            <span className="mb-3 grid size-12 place-items-center rounded-xl bg-elevated shadow-[var(--shadow-border)]">
              <ImagePlus className="size-5 text-muted" />
            </span>
            <p className="font-display text-lg font-semibold tracking-tight">
              Drop a photo of the object
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Or tap to choose one. A clear, well-lit shot works best.
            </p>
          </>
        )}
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void applyFile(e.target.files?.[0])}
        />
      </label>

      {preview ? (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
            <X className="size-4" />
            Remove photo
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="describe" className="text-sm font-medium text-muted">
          Describe the item
        </label>
        <Input
          id="describe"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="phone stand, cable clip, Ender 3 fan duct…"
          autoComplete="off"
          maxLength={240}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full bg-elevated px-3 py-1.5 text-sm text-muted shadow-[var(--shadow-border)] transition-colors hover:text-fg"
          >
            {example}
          </button>
        ))}
      </div>

      {photoError ? <p className="text-sm text-danger">{photoError}</p> : null}

      <Button type="submit" size="xl" className="w-full rounded-xl" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="size-5 animate-spin" />
            Hunting for printable files…
          </>
        ) : (
          <>
            <Search className="size-5" />
            Can I 3D Print This?
          </>
        )}
      </Button>
    </form>
  );
}
