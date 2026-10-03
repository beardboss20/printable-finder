import { Camera, ImagePlus, LoaderCircle, Search, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToCompressedDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

const EXAMPLES = ["phone stand", "cable clip", "Ender 3 fan duct", "headphone hook"];

type SearchPanelProps = {
  busy: boolean;
  onSearch: (input: { text: string; imageDataUrl?: string }) => void;
  onPreviewChange?: (preview: string | null) => void;
};

export function SearchPanel({ busy, onSearch, onPreviewChange }: SearchPanelProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function rememberPreview(next: string | null) {
    setPreview(next);
    onPreviewChange?.(next);
  }

  async function applyFile(file: File | undefined) {
    if (!file || busy) return;
    setPhotoError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageDataUrl(dataUrl);
      rememberPreview(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not read that photo.");
    }
  }

  function clearPhoto() {
    setImageDataUrl(undefined);
    rememberPreview(null);
    setPhotoError(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
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
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={(event) => {
          if (busy || event.target instanceof HTMLInputElement) return;
          fileRef.current?.click();
        }}
        className={cn(
          "relative flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl bg-surface px-5 py-8 text-center shadow-[var(--shadow-border)] transition-[box-shadow] duration-200",
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
              A clear, well-lit shot works best. You can also take one with your camera.
            </p>
          </>
        )}
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void applyFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            void applyFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <ImagePlus className="size-4" />
          Choose photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
        >
          <Camera className="size-4" />
          Take photo
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" onClick={clearPhoto} disabled={busy}>
            <X className="size-4" />
            Remove photo
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="describe" className="text-sm font-medium text-muted">
          Describe the item
        </label>
        <Input
          id="describe"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="phone stand, cable clip, Ender 3 fan duct…"
          autoComplete="off"
          maxLength={240}
          disabled={busy}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={busy}
            onClick={() => setText(example)}
            className="rounded-full bg-elevated px-3 py-1.5 text-sm text-muted shadow-[var(--shadow-border)] transition-colors hover:text-fg disabled:opacity-45"
          >
            {example}
          </button>
        ))}
      </div>

      {photoError ? (
        <p role="alert" className="text-sm text-danger">
          {photoError}
        </p>
      ) : null}

      <Button type="submit" size="xl" className="w-full rounded-xl" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="size-5 animate-spin" />
            Searching…
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
