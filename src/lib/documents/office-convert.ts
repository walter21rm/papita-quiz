import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type OfficeApp = "word" | "powerpoint" | "excel";

const CONVERSION_TIMEOUT_MS = 120_000;
const OFFICE_NOT_AVAILABLE_EXIT_CODE = 3;

const unavailableApps = new Set<OfficeApp>();
let queue: Promise<unknown> = Promise.resolve();

export function officeConversionEnabled(): boolean {
  const setting = (process.env.OFFICE_PDF_CONVERSION ?? "auto").trim().toLowerCase();
  return process.platform === "win32" && setting !== "off" && setting !== "false";
}

class OfficeUnavailableError extends Error {}

function runScript(inputPath: string, outputPath: string, app: OfficeApp): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "office-to-pdf.ps1");
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-InputPath",
    inputPath,
    "-OutputPath",
    outputPath,
    "-App",
    app,
  ];
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      args,
      { timeout: CONVERSION_TIMEOUT_MS, windowsHide: true },
      (error, _stdout, stderr) => {
        if (!error) {
          resolve();
          return;
        }
        const message = String(stderr ?? "").trim() || error.message;
        if (error.code === OFFICE_NOT_AVAILABLE_EXIT_CODE) reject(new OfficeUnavailableError(message));
        else reject(new Error(message));
      },
    );
  });
}

/**
 * Converts a document with the locally installed Microsoft Office.
 * Returns null when Office is not available or the conversion fails, so callers can fall back.
 */
export async function convertWithOffice(
  buffer: Buffer,
  extension: string,
  app: OfficeApp,
  target: "pdf" | "xlsx",
): Promise<Buffer | null> {
  if (!officeConversionEnabled() || unavailableApps.has(app)) return null;

  const job = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "papita-quiz-"));
    const inputPath = path.join(dir, `entrada.${extension}`);
    const outputPath = path.join(dir, `salida.${target}`);
    try {
      await writeFile(inputPath, buffer);
      await runScript(inputPath, outputPath, app);
      return await readFile(outputPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };

  // Office automation is not safe to run concurrently, so conversions are serialized.
  const result = queue.then(job, job);
  queue = result.catch(() => undefined);

  try {
    return await result;
  } catch (error) {
    if (error instanceof OfficeUnavailableError) unavailableApps.add(app);
    console.warn(`[papita-quiz] Conversión con Office (${app}) falló:`, error instanceof Error ? error.message : error);
    return null;
  }
}
