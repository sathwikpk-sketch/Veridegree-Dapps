export const MAX_CERTIFICATE_BYTES = 12 * 1024 * 1024;

const FILE_RULES = {
  pdf: { mime: "application/pdf", matches: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 1024)).trimStart().startsWith("%PDF-") },
  png: { mime: "image/png", matches: (bytes: Uint8Array) => [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) },
  jpg: { mime: "image/jpeg", matches: (bytes: Uint8Array) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
  jpeg: { mime: "image/jpeg", matches: (bytes: Uint8Array) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
} as const;

export async function validateCertificateFile(file: File): Promise<string | null> {
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_CERTIFICATE_BYTES) return "Choose a certificate smaller than 12 MB.";

  const extension = file.name.split(".").pop()?.toLowerCase() as keyof typeof FILE_RULES | undefined;
  if (!extension || !(extension in FILE_RULES)) return "Upload a PDF, JPG or PNG certificate.";

  const rule = FILE_RULES[extension];
  if (file.type && file.type !== rule.mime && file.type !== "application/octet-stream") {
    return "The file type does not match its filename. Choose a PDF, JPG or PNG certificate.";
  }

  const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!rule.matches(prefix)) return "The file contents do not match its PDF, JPG or PNG extension.";
  return null;
}
