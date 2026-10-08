import { File, FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { extensionOf, FORMAT_GROUPS } from "@/lib/labels";

const ICON_BY_GROUP = {
  PDF: FileText,
  Word: FileText,
  PowerPoint: Presentation,
  Excel: FileSpreadsheet,
  Imágenes: FileImage,
  Texto: FileText,
} as const;

const COLOR_BY_GROUP: Record<string, string> = {
  PDF: "text-tomate-600 bg-tomate-50",
  Word: "text-cielo-600 bg-cielo-50",
  PowerPoint: "text-papa-600 bg-papa-100",
  Excel: "text-brote-600 bg-brote-50",
  Imágenes: "text-papa-700 bg-papa-50",
  Texto: "text-papa-800 bg-papa-50",
};

export function fileGroup(fileName: string): string | undefined {
  const extension = extensionOf(fileName);
  return FORMAT_GROUPS.find((group) => group.extensions.includes(extension))?.label;
}

export function FileTypeIcon({ fileName, className = "" }: { fileName: string; className?: string }) {
  const group = fileGroup(fileName);
  const Icon = group ? ICON_BY_GROUP[group as keyof typeof ICON_BY_GROUP] : File;
  const color = group ? COLOR_BY_GROUP[group] : "text-papa-800 bg-papa-50";
  return (
    <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${color} ${className}`}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
