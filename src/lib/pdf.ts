import { PDFDocument } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;

async function blobToPngOrJpeg(file: Blob, name: string): Promise<{ bytes: ArrayBuffer; kind: "png" | "jpg" }> {
  let blob: Blob = file;
  const lower = name.toLowerCase();
  if (lower.endsWith(".heic") || lower.endsWith(".heif") || /heic|heif/.test(file.type)) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = (Array.isArray(out) ? out[0] : out) ?? file;
  }
  if (blob.type === "image/png") return { bytes: await blob.arrayBuffer(), kind: "png" };
  if (blob.type === "image/jpeg") return { bytes: await blob.arrayBuffer(), kind: "jpg" };
  // webp, gif, anything else: rasterize through a canvas
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read image"));
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const png = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
    return { bytes: await png.arrayBuffer(), kind: "png" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addImagePage(doc: PDFDocument, bytes: ArrayBuffer, kind: "png" | "jpg") {
  const img = kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const page = doc.addPage(A4);
  const maxW = A4[0] - MARGIN * 2;
  const maxH = A4[1] - MARGIN * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1e9);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
}

/** Convert any supported upload into a PDF Blob (A4, margins, aspect kept). PDFs pass through untouched. */
export async function fileToPdf(file: File): Promise<Blob> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return file;
  const { bytes, kind } = await blobToPngOrJpeg(file, file.name);
  const doc = await PDFDocument.create();
  await addImagePage(doc, bytes, kind);
  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** Build the order summary: page 1 is the rendered summary sheet, followed by every uploaded PDF. */
export async function buildSummaryPdf(sheetPng: string, attachments: Blob[]): Promise<Blob> {
  const doc = await PDFDocument.create();
  const pngBytes = await (await fetch(sheetPng)).arrayBuffer();
  await addImagePage(doc, pngBytes, "png");
  for (const a of attachments) {
    try {
      const src = await PDFDocument.load(await a.arrayBuffer(), { ignoreEncryption: true });
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    } catch (e) {
      console.warn("Skipping attachment that could not be merged", e);
    }
  }
  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}
