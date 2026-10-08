"use client";

import { CloudUpload, LoaderCircle, Sparkles, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { PapitaMascot } from "@/components/PapitaMascot";
import { analyzeFiles, ClientApiError } from "@/lib/api-client";
import { fingerprintFiles } from "@/lib/fingerprint";
import { ACCEPTED_EXTENSIONS, extensionOf, FORMAT_GROUPS, formatBytes, LIMITS } from "@/lib/labels";
import { createMaterial, findMaterialByFingerprint, touchMaterial } from "@/lib/repo";
import { setFlashNotice } from "@/lib/flash";

const ANALYSIS_MESSAGES = [
  "Leyendo tus archivos con mucho cuidado…",
  "Mirando cada imagen, tabla y diagrama…",
  "Buscando los temas más importantes…",
  "Anotando definiciones, fórmulas y datos clave…",
  "Organizando todo en un mapa de conceptos…",
  "Ya casi, papita. Estoy revisando que no se me escape nada…",
];

type Status = "idle" | "hashing" | "analyzing" | "error";

function validator(file: File) {
  if (!ACCEPTED_EXTENSIONS.has(extensionOf(file.name)) && !file.type.startsWith("image/")) {
    return { code: "formato", message: "Todavía no sé leer este formato." };
  }
  return null;
}

function rejectionMessage(rejection: FileRejection): string {
  const reason = rejection.errors[0];
  if (reason?.code === "file-too-large") {
    return `"${rejection.file.name}" pesa más de ${formatBytes(LIMITS.maxFileBytes)}.`;
  }
  return `"${rejection.file.name}": ${reason?.message ?? "no se puede usar."}`;
}

export function UploadDropzone() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const busy = status === "hashing" || status === "analyzing";

  useEffect(() => {
    if (status !== "analyzing") return;
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      setMessageIndex(Math.min(Math.floor(seconds / 6), ANALYSIS_MESSAGES.length - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    multiple: true,
    maxSize: LIMITS.maxFileBytes,
    validator,
    disabled: busy,
    noClick: files.length > 0,
    onDrop: (accepted, rejected) => {
      const merged = [...files];
      for (const file of accepted) {
        const duplicate = merged.some((existing) => existing.name === file.name && existing.size === file.size);
        if (!duplicate) merged.push(file);
      }
      const notes = rejected.map(rejectionMessage);
      if (merged.length > LIMITS.maxFiles) notes.push(`Solo puedo analizar ${LIMITS.maxFiles} archivos a la vez.`);
      setError(null);
      setWarnings(notes);
      setFiles(merged.slice(0, LIMITS.maxFiles));
    },
  });

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const tooHeavy = totalBytes > LIMITS.maxTotalBytes;

  async function handleAnalyze() {
    if (files.length === 0 || busy) return;
    setError(null);
    setStatus("hashing");
    try {
      const { fingerprint, hashes } = await fingerprintFiles(files);
      const known = await findMaterialByFingerprint(fingerprint);
      if (known) {
        await touchMaterial(known.id);
        setFlashNotice("Ya conocía este material. Tus próximos quizzes seguirán sin repetir preguntas.");
        router.push(`/material/${known.id}`);
        return;
      }

      setStatus("analyzing");
      setElapsed(0);
      setMessageIndex(0);
      const result = await analyzeFiles(files);
      const material = await createMaterial({
        fingerprint,
        files: files.map((file, index) => ({
          name: file.name,
          size: file.size,
          type: file.type,
          hash: hashes[index],
        })),
        corpus: result.corpus,
        analysis: result.analysis,
        notes: result.notes,
      });
      router.push(`/material/${material.id}`);
    } catch (caught) {
      const message =
        caught instanceof ClientApiError ? caught.message : "Algo salió mal al analizar tus archivos.";
      const details = caught instanceof ClientApiError ? caught.details : [];
      if (!(caught instanceof ClientApiError)) console.error(caught);
      setError({ message, details });
      setStatus("error");
    }
  }

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[2rem] border-2 border-papa-200 bg-white/80 p-8 text-center shadow-lg shadow-papa-200/40">
        <PapitaMascot mood="thinking" size={130} className="animate-float" />
        <p className="font-display text-xl font-semibold text-papa-900" aria-live="polite">
          {status === "hashing"
            ? "Preparando tus archivos…"
            : files.reduce((sum, file) => sum + file.size, 0) > LIMITS.gatewayBytes && elapsed < 12
              ? "Subiendo tu archivo…"
              : ANALYSIS_MESSAGES[messageIndex]}
        </p>
        {status === "analyzing" && (
          <p className="text-sm text-papa-800/80">
            Analizando {files.length} {files.length === 1 ? "archivo" : "archivos"} · {elapsed} s. Los documentos
            grandes pueden tardar uno o dos minutos.
          </p>
        )}
        <LoaderCircle className="size-6 animate-spin text-papa-500" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        {...getRootProps()}
        className={`relative cursor-pointer rounded-[2rem] border-2 border-dashed p-6 text-center transition sm:p-8 ${
          isDragActive
            ? "border-brote-500 bg-brote-50/80"
            : "border-papa-300 bg-white/70 hover:border-papa-400 hover:bg-white"
        }`}
      >
        <input {...getInputProps()} aria-label="Subir archivos" />
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-16 items-center justify-center rounded-3xl bg-papa-100 text-papa-600">
              <CloudUpload className="size-8" aria-hidden />
            </span>
            <p className="font-display text-xl font-semibold text-papa-900">
              {isDragActive ? "¡Suéltalos aquí!" : (
                <>
                  <span className="sm:hidden">Toca para elegir tus archivos</span>
                  <span className="hidden sm:inline">Arrastra tus archivos aquí</span>
                </>
              )}
            </p>
            <p className="text-sm text-papa-800/80">
              <span className="sm:hidden">PDF, Word, PowerPoint, Excel, fotos o texto. Puedes elegir varios.</span>
              <span className="hidden sm:inline">o haz clic para elegirlos. Puedes subir varios a la vez.</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-left">
            <ul className="flex flex-col gap-2">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center gap-3 rounded-2xl border border-papa-100 bg-white px-3 py-2"
                >
                  <FileTypeIcon fileName={file.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-papa-900">{file.name}</p>
                    <p className="text-xs text-papa-800/70">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFiles((current) => current.filter((item) => item !== file));
                    }}
                    className="rounded-full p-2 text-papa-800/70 transition hover:bg-tomate-50 hover:text-tomate-600"
                    aria-label={`Quitar ${file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-papa-800/80">
              <span>
                {files.length} {files.length === 1 ? "archivo" : "archivos"} · {formatBytes(totalBytes)}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
                className="rounded-full px-3 py-1 font-bold text-papa-700 transition hover:bg-papa-100"
              >
                + Agregar más
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-label="Formatos aceptados">
        {FORMAT_GROUPS.map((group) => (
          <span
            key={group.label}
            title={group.extensions.map((extension) => `.${extension}`).join(" ")}
            className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-papa-800 ring-1 ring-papa-200"
          >
            {group.label}
          </span>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="rounded-2xl bg-papa-100/70 px-4 py-3 text-sm text-papa-900">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {error && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-tomate-100 bg-tomate-50 px-4 py-3 text-tomate-700">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-bold">{error.message}</p>
            {error.details.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tooHeavy && (
        <p className="text-center text-sm font-semibold text-tomate-600">
          En total puedes subir hasta {formatBytes(LIMITS.maxTotalBytes)}. Quita algún archivo.
        </p>
      )}

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={files.length === 0 || tooHeavy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-papa-500 px-8 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-papa-500/30 transition hover:-translate-y-0.5 hover:bg-papa-600 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-papa-200 disabled:shadow-none sm:mx-auto sm:w-auto"
      >
        <Sparkles className="size-5" aria-hidden />
        Analizar y preparar mi quiz
      </button>
    </div>
  );
}
