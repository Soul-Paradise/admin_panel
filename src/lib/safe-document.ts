/**
 * Opening user-uploaded bytes from a blob: URL renders them on the admin
 * origin. An HTML or SVG "document" would then run script with the admin's
 * session, so only a short allowlist of inert formats is ever shown inline -
 * and only when the declared type and the file's magic bytes agree.
 * Everything else is handed to the browser as a download.
 */

export type InlineDocumentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

const INLINE_TYPES: ReadonlySet<string> = new Set<InlineDocumentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Identifies the format from the first bytes, or null if not on the allowlist. */
export function sniffDocumentType(bytes: Uint8Array): InlineDocumentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}

/** The inline type to use, or null when the blob must be downloaded instead. */
export async function inlineTypeFor(blob: Blob): Promise<InlineDocumentType | null> {
  const declared = blob.type.split(';')[0].trim().toLowerCase();
  if (!INLINE_TYPES.has(declared)) return null;
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const sniffed = sniffDocumentType(head);
  return sniffed === declared ? sniffed : null;
}

/** Letters, digits, dot, dash, underscore only; never a path or a dotfile. */
export function safeFilename(base: string, extension = 'bin'): string {
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 80) || 'document';
  return `${clean}.${extension}`;
}

/** Saves the bytes as an opaque download - the browser never renders them. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
