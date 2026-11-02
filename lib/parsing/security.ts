import type { ProjectFileRecord } from "@/lib/types/project-data";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_UNCOMPRESSED_ZIP_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 10_000;
export const MAX_PDF_PAGES = 200;
export const MAX_EXCEL_CELLS = 20_000;

const allowedMimes: Record<string, string[]> = {
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", ""],
  xls: ["application/vnd.ms-excel", "application/octet-stream", ""],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", ""],
  pdf: ["application/pdf", "application/octet-stream", ""],
  png: ["image/png", "application/octet-stream", ""],
  jpg: ["image/jpeg", "application/octet-stream", ""],
  jpeg: ["image/jpeg", "application/octet-stream", ""],
};

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateUploadMetadata(name: string, mimeType: string, size: number) {
  const extension = fileExtension(name);
  if (!Object.hasOwn(allowedMimes, extension)) throw new FileValidationError("仅支持 XLSX、XLS、DOCX、PDF、PNG 或 JPG 文件。");
  if (size <= 0) throw new FileValidationError("文件为空，未保存来源记录。");
  if (size > MAX_FILE_BYTES) throw new FileValidationError(`文件超过 ${MAX_FILE_BYTES / 1024 / 1024} MB 的本地解析上限。`);
  if (!allowedMimes[extension].includes(mimeType)) throw new FileValidationError(`文件扩展名 .${extension} 与 MIME 类型 ${mimeType || "(空)"} 不匹配。`);
  return extension;
}

function hasSignature(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function inspectZipCentralDirectory(bytes: Uint8Array) {
  if (!hasSignature(bytes, [0x50, 0x4b])) throw new FileValidationError("文件不是有效的 Office ZIP 容器，可能已损坏。");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let entries = 0;
  let totalUncompressed = 0;
  for (let offset = 0; offset <= bytes.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    entries += 1;
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw new FileValidationError("暂不支持 ZIP64 Office 文件，请拆分后重试。");
    totalUncompressed += uncompressed;
    if (entries > MAX_ZIP_ENTRIES) throw new FileValidationError(`Office 文件条目超过 ${MAX_ZIP_ENTRIES} 个，已阻止解析。`);
    if (totalUncompressed > MAX_UNCOMPRESSED_ZIP_BYTES) throw new FileValidationError(`Office 文件解压后超过 ${MAX_UNCOMPRESSED_ZIP_BYTES / 1024 / 1024} MB，已阻止解析。`);
    if (compressed > 0 && uncompressed / compressed > 1_000) throw new FileValidationError("Office 文件压缩比异常，已按 ZIP bomb 风险阻止解析。");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 45 + nameLength + extraLength + commentLength;
  }
  if (!entries) throw new FileValidationError("Office 文件中央目录缺失，文件可能已损坏。");
  return { entries, totalUncompressed };
}

export async function validateFileBytes(file: ProjectFileRecord) {
  const extension = validateUploadMetadata(file.name, file.mimeType, file.size);
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  if (["xlsx", "docx"].includes(extension)) inspectZipCentralDirectory(bytes);
  if (extension === "pdf" && !hasSignature(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) throw new FileValidationError("文件头不是有效 PDF，文件可能已损坏或扩展名不正确。");
  if (extension === "xls") throw new FileValidationError("当前安全解析器仅支持 XLSX；旧版二进制 XLS 请先另存为 XLSX。原文件仍保留。");
  return { bytes, extension };
}

export async function checksumBlob(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
