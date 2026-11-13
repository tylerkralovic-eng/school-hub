"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { processBatch, registerUploads, submitText } from "@/app/actions/ingest";
import { Icon } from "@/components/Icon";
import { FormError, SubmitButton } from "@/components/forms";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

type Who = { value: string; label: string };
type Prepared = { name: string; mime: string; blob: Blob; preview?: string; size: number };

const MAX_EDGE = 2400;

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback (e.g. HEIC on Safari) via an <img> element.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  }
}

/** Downscale photos on the phone: faster uploads, lower AI cost, handles HEIC where the browser can decode it. */
async function prepare(file: File): Promise<Prepared> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return { name: file.name, mime: "application/pdf", blob: file, size: file.size };
  }
  let img;
  try {
    img = await decode(file);
  } catch {
    throw new Error(`Can't read "${file.name}". Use a JPEG, PNG or PDF.`);
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.86));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { name, mime: "image/jpeg", blob, size: blob.size, preview: URL.createObjectURL(blob) };
}

export function AddForm({ who, aiReady }: { who: Who[]; aiReady: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"files" | "text">("files");
  const [target, setTarget] = useState("");
  const [files, setFiles] = useState<Prepared[]>([]);
  const [phase, setPhase] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [textState, textAction] = useActionState(submitText, undefined);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setPhase("Preparing…");
    try {
      const prepared = await Promise.all([...list].slice(0, 10 - files.length).map(prepare));
      const tooBig = prepared.find((p) => p.size > 20 * 1024 * 1024);
      if (tooBig) throw new Error(`"${tooBig.name}" is larger than 20 MB.`);
      setFiles((f) => [...f, ...prepared].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't prepare that file.");
    } finally {
      setPhase(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (filesRef.current) filesRef.current.value = "";
    }
  }

  async function submitFiles() {
    setError(null);
    try {
      setPhase("Uploading…");
      const metas = await Promise.all(
        files.map(async (f) => ({ name: f.name, mime: f.mime as "image/jpeg", size: f.size, sha256: await sha256Hex(await f.blob.arrayBuffer()) })),
      );
      const reg = await registerUploads(metas, target);
      if ("error" in reg) throw new Error(reg.error);
      const supabase = createClient();
      let n = 0;
      for (const [i, u] of reg.uploads.entries()) {
        if (!u.path) continue;
        n++;
        setPhase(`Uploading ${n} of ${reg.uploads.filter((x) => x.path).length}…`);
        const { error: upErr } = await supabase.storage.from("documents").upload(u.path, files[i].blob, { contentType: files[i].mime, upsert: false });
        if (upErr) throw new Error(`Upload failed for ${u.name}. Check your connection and try again.`);
      }
      const allRepeat = reg.uploads.every((u) => u.duplicate);
      if (!allRepeat) {
        setPhase("Reading with AI — usually under a minute…");
        const res = await processBatch(reg.batchId);
        if (!res.ok) throw new Error(res.error);
      }
      router.push(allRepeat ? `/review/${reg.uploads[0].batchId}?repeat=1` : `/review/${reg.batchId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase(null);
    }
  }

  const busy = Boolean(phase);

  return (
    <div className="space-y-5">
      {!aiReady && (
        <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          AI extraction isn&apos;t configured on this server yet, so files can&apos;t be read. Add an ANTHROPIC_API_KEY to enable it.
        </p>
      )}
      <div role="tablist" aria-label="What are you adding?" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
        {(["files", "text"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            {m === "files" ? "Photo or PDF" : "Paste text"}
          </button>
        ))}
      </div>

      <fieldset>
        <legend className="mb-2 px-1 text-sm font-medium text-slate-700">Who is it for? <span className="font-normal text-slate-500">(optional — helps matching)</span></legend>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {[{ value: "", label: "Not sure" }, ...who].map((w) => (
            <button key={w.value} type="button" aria-pressed={target === w.value} onClick={() => setTarget(w.value)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${target === w.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </fieldset>

      {mode === "files" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-5 text-sm font-semibold text-slate-800 shadow-sm active:scale-[0.98] disabled:opacity-50">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Icon name="camera" className="h-6 w-6" /></span>
              Take a photo
            </button>
            <button type="button" disabled={busy} onClick={() => filesRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-5 text-sm font-semibold text-slate-800 shadow-sm active:scale-[0.98] disabled:opacity-50">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Icon name="image" className="h-6 w-6" /></span>
              Photos, screenshots, PDFs
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={(e) => onPick(e.target.files)} />
          <input ref={filesRef} type="file" accept="image/*,application/pdf" multiple className="sr-only" aria-label="Choose photos or PDFs" data-testid="file-input" onChange={(e) => onPick(e.target.files)} />

          {files.length > 0 && (
            <Card className="divide-y divide-slate-100">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Icon name="file" className="h-6 w-6" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="p-2 text-slate-400">
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </Card>
          )}
          <FormError message={error} />
          {phase ? (
            <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm font-medium text-indigo-900">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" aria-hidden="true" />
              {phase}
            </div>
          ) : (
            <button type="button" disabled={!files.length || !aiReady} onClick={submitFiles} className={`${buttonClass.primary} w-full`}>
              {files.length ? `Read ${files.length} ${files.length === 1 ? "file" : "files"}` : "Choose a photo or PDF"}
            </button>
          )}
          <p className="text-center text-xs text-slate-500">Your files are stored privately for your family. You review everything before it&apos;s added.</p>
        </>
      ) : (
        <form action={textAction} className="space-y-3">
          <input type="hidden" name="who" value={target} />
          <label htmlFor="paste" className="sr-only">Message text</label>
          <textarea id="paste" name="text" rows={9} required placeholder="Paste a teacher email, a Remind message, a text from school…" className={`${inputClass} resize-y leading-relaxed`} />
          <FormError message={textState?.error} />
          <SubmitButton className="w-full" pendingText="Reading with AI…" disabled={!aiReady}>Find dates & to-dos</SubmitButton>
        </form>
      )}
    </div>
  );
}
