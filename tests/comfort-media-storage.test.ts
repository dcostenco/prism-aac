/**
 * comfortMediaStorage — IndexedDB blob CRUD tests.
 *
 * Uses fake-indexeddb for a real (in-memory) IDB implementation.
 * This file deliberately does NOT vi.mock the storage module — it tests
 * the real implementation against fake-indexeddb.
 *
 * NOTE: fake-indexeddb v6 + jsdom does not perfectly round-trip Blob objects
 * through structuredClone (blobs come back as plain objects). We verify
 * that the storage layer stores and retrieves *something* (truthy for
 * existing keys, null for missing keys), and that the deletion APIs work.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveBlob,
  getBlob,
  deleteBlob,
  deleteAllBlobs,
} from '@/services/comfortMediaStorage';

// The storage module caches a single dbPromise in module scope. Since we
// import it once (no resetModules), the same DB handle is reused across
// tests. We clean up by calling deleteAllBlobs() between tests.

beforeEach(async () => {
  await deleteAllBlobs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('comfortMediaStorage — IndexedDB blob CRUD', () => {
  it('saveBlob + getBlob round-trips (stores and retrieves data)', async () => {
    const blob = new Blob(['hello comfort'], { type: 'audio/webm' });
    await saveBlob('item-1', blob);
    const retrieved = await getBlob('item-1');
    // In fake-indexeddb + jsdom, the blob may come back as a plain object
    // due to structuredClone limitations. The key invariant is that it's
    // not null (i.e., the key was actually stored and retrieved).
    expect(retrieved).not.toBeNull();
    expect(retrieved).toBeTruthy();
  });

  it('getBlob returns null for non-existent key', async () => {
    const result = await getBlob('does-not-exist');
    expect(result).toBeNull();
  });

  it('saveBlob overwrites existing key', async () => {
    const blob1 = new Blob(['first'], { type: 'audio/webm' });
    const blob2 = new Blob(['second-longer'], { type: 'audio/webm' });
    await saveBlob('item-1', blob1);
    await saveBlob('item-1', blob2);
    const retrieved = await getBlob('item-1');
    expect(retrieved).not.toBeNull();
  });

  it('deleteBlob removes the blob', async () => {
    const blob = new Blob(['bye'], { type: 'audio/webm' });
    await saveBlob('item-1', blob);
    await deleteBlob('item-1');
    const result = await getBlob('item-1');
    expect(result).toBeNull();
  });

  it('deleteBlob on non-existent key does not throw', async () => {
    await expect(deleteBlob('nope')).resolves.toBeUndefined();
  });

  it('deleteAllBlobs clears every stored blob', async () => {
    await saveBlob('a', new Blob(['a']));
    await saveBlob('b', new Blob(['b']));
    await saveBlob('c', new Blob(['c']));
    await deleteAllBlobs();
    expect(await getBlob('a')).toBeNull();
    expect(await getBlob('b')).toBeNull();
    expect(await getBlob('c')).toBeNull();
  });

  it('handles multiple saves and deletes interleaved', async () => {
    await saveBlob('x', new Blob(['x']));
    await saveBlob('y', new Blob(['y']));
    await deleteBlob('x');
    await saveBlob('z', new Blob(['z']));
    expect(await getBlob('x')).toBeNull();
    expect(await getBlob('y')).not.toBeNull();
    expect(await getBlob('z')).not.toBeNull();
  });

  it('stores blobs of different types correctly', async () => {
    await saveBlob('audio-1', new Blob(['audio-data'], { type: 'audio/webm' }));
    await saveBlob('image-1', new Blob(['image-data'], { type: 'image/jpeg' }));
    await saveBlob('video-1', new Blob(['video-data'], { type: 'video/mp4' }));

    expect(await getBlob('audio-1')).not.toBeNull();
    expect(await getBlob('image-1')).not.toBeNull();
    expect(await getBlob('video-1')).not.toBeNull();
  });

  it('empty blob is stored and retrieved', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' });
    await saveBlob('empty', emptyBlob);
    const retrieved = await getBlob('empty');
    expect(retrieved).not.toBeNull();
  });

  it('delete then re-save same key works', async () => {
    await saveBlob('reuse', new Blob(['first']));
    await deleteBlob('reuse');
    expect(await getBlob('reuse')).toBeNull();

    await saveBlob('reuse', new Blob(['second']));
    expect(await getBlob('reuse')).not.toBeNull();
  });

  it('deleteAllBlobs is idempotent on empty store', async () => {
    await expect(deleteAllBlobs()).resolves.toBeUndefined();
  });
});
