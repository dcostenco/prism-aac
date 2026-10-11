import { createHash } from 'node:crypto';
import { TRANSPORT_IMAGE } from './transport-image';

export const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const IMAGES = { 'one.png': TRANSPORT_IMAGE, 'two.png': Buffer.concat([TRANSPORT_IMAGE, Buffer.from([0])]) };
export function makePack(images: Record<string, Buffer> = IMAGES) {
  const index: Record<string, { offset: number; length: number; sha256: string }> = {};
  let offset = 0;
  const entries = Object.entries(images).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, bytes] of entries) { index[name] = { offset, length: bytes.length, sha256: hash(bytes) }; offset += bytes.length; }
  const json = Buffer.from(JSON.stringify({ files: index }));
  const header = Buffer.alloc(12); header.write('PAACPK01'); header.writeUInt32BE(json.length, 8);
  const bytes = Buffer.concat([header, json, ...entries.map(([, image]) => image)]);
  const midpoint = Math.ceil(bytes.length / 2);
  const chunks = [bytes.subarray(0, midpoint), bytes.subarray(midpoint)];
  return { bytes: Uint8Array.from(bytes).buffer, chunks, manifest: { format: 1, version: hash(bytes), byteLength: bytes.length,
    fileCount: entries.length, indexByteLength: json.length,
    chunks: chunks.map((chunk, i) => ({ id: String(i).padStart(4, '0'), byteLength: chunk.length, sha256: hash(chunk) })) } };
}
export const FIXTURE_PACK = makePack();
export const OLD_PACK = makePack({ 'one.png': IMAGES['one.png'] });
export const RETIRED_ENTRY_PACK = makePack({ ...IMAGES, 'retired.png': IMAGES['one.png'] });
export const REVISED_ENTRY_PACK = makePack({ 'one.png': IMAGES['one.png'], 'two.png': Buffer.concat([IMAGES['two.png'], Buffer.from([1])]) });
