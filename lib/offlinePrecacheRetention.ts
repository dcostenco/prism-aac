import { PRISM_AAC_BASE_PATH, PRISM_AAC_STATIC_PATH } from './appPaths';

export const AAC_PRECACHE_PREFIX = 'prism-aac-precache-v2-';
export const AAC_LEGACY_AAC_PRECACHE_PREFIX = 'prism-aac-precache-';
export const AAC_LEGACY_PRECACHE_PREFIX = 'serwist-precache-';
export const AAC_CORE_NAVIGATION_CACHE = 'prism-core-navigation-v2';
export const AAC_LEGACY_CORE_NAVIGATION_CACHES = ['prism-core-navigation', 'prism-navigation'] as const;
export const AAC_OFFLINE_NAVIGATION_LOCK = 'prism-aac-offline-navigation-state';
export const AAC_BUILD_REPORT = 'aac-offline-build';
export const AAC_BUILD_REQUEST = 'aac-request-offline-build';
export const AAC_BUILD_ID = /^[a-zA-Z0-9._-]{1,128}$/;

export function isAacUrl(value: string, origin: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === origin && (url.pathname === PRISM_AAC_BASE_PATH || url.pathname.startsWith(PRISM_AAC_BASE_PATH + '/'));
  } catch { return false; }
}

export function documentAssets(html: string, documentUrl: string): string[] {
  const origin = new URL(documentUrl).origin;
  return [...new Set([...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].flatMap(match => {
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), documentUrl);
      return url.origin === origin && url.pathname.startsWith(PRISM_AAC_STATIC_PATH) ? [url.href] : [];
    } catch { return []; }
  }))];
}

/** Retire only builds no longer needed by the saved document or open clients. */
export async function retireUnusedPrecache(
  storage: CacheStorage,
  origin: string,
  currentCacheName: string,
  openClientBuilds: Array<string | null>,
  durablePicturesReady: () => Promise<boolean>,
  locks?: Pick<LockManager, 'request'> | null,
): Promise<string[]> {
  if (!locks || typeof locks.request !== 'function') return [];
  try {
    return await locks.request(AAC_OFFLINE_NAVIGATION_LOCK, { mode: 'exclusive' }, () =>
      retireUnusedPrecacheLocked(storage, origin, currentCacheName, openClientBuilds, durablePicturesReady));
  } catch {
    return [];
  }
}

async function retireUnusedPrecacheLocked(
  storage: CacheStorage,
  origin: string,
  currentCacheName: string,
  openClientBuilds: Array<string | null>,
  durablePicturesReady: () => Promise<boolean>,
): Promise<string[]> {
  // Older clients cannot report a version. Wait for them to close or update.
  if (openClientBuilds.some(build => !build || !AAC_BUILD_ID.test(build))) return [];
  const names = await storage.keys();
  if (!names.includes(AAC_CORE_NAVIGATION_CACHE) || !names.includes(currentCacheName)) return [];
  const documentUrl = origin + PRISM_AAC_BASE_PATH;
  const document = await (await storage.open(AAC_CORE_NAVIGATION_CACHE)).match(documentUrl);
  if (!document) return [];
  const assets = documentAssets(await document.text(), documentUrl);
  if (!assets.length) return [];

  const candidates: Array<{ name: string; cache: Cache; legacyPictures: boolean; coordinated: boolean }> = [];
  for (const name of names) {
    const coordinated = name.startsWith(AAC_PRECACHE_PREFIX) || name.startsWith(AAC_LEGACY_PRECACHE_PREFIX);
    if (!coordinated && !name.startsWith(AAC_LEGACY_AAC_PRECACHE_PREFIX)) continue;
    const cache = await storage.open(name);
    const keys = await cache.keys();
    if (!keys.length && !name.startsWith(AAC_PRECACHE_PREFIX)) continue;
    if (keys.some(key => !isAacUrl(key.url, origin))) continue;
    candidates.push({ name, cache, coordinated, legacyPictures: keys.some(key => {
      const url = new URL(key.url);
      return url.pathname.startsWith(PRISM_AAC_BASE_PATH + '/symbols/') && /\.png$/i.test(url.pathname);
    }) });
  }
  // Old AAC workers never used this lock queue, so their caches remain outside
  // retirement even after all currently reported clients have upgraded.
  const retained = new Set([currentCacheName, ...candidates.filter(candidate => !candidate.coordinated).map(candidate => candidate.name)]);
  // Prefer the newest complete cache. Immutable webpack references identify
  // the chunk graph, including lazy chunks needed after an offline reload.
  let documentBuildFound = false;
  const documentCandidates = [...candidates].reverse().sort((left, right) =>
    Number(right.name === currentCacheName) - Number(left.name === currentCacheName));
  for (const candidate of documentCandidates) {
    const complete = (await Promise.all(assets.map(asset => candidate.cache.match(asset, { ignoreSearch: true, ignoreVary: true })))).every(Boolean);
    if (complete) { retained.add(candidate.name); documentBuildFound = true; break; }
  }
  if (!documentBuildFound) return [];
  for (const build of openClientBuilds) {
    const matching = candidates.filter(candidate => candidate.name === AAC_PRECACHE_PREFIX + build
      || candidate.name === AAC_LEGACY_AAC_PRECACHE_PREFIX + build
      || candidate.name === AAC_LEGACY_PRECACHE_PREFIX + build);
    // A reported build with no identifiable cache must not cause data loss.
    if (!matching.length) return [];
    for (const candidate of matching) retained.add(candidate.name);
  }
  const picturesReady = candidates.some(candidate => candidate.legacyPictures && !retained.has(candidate.name))
    ? await durablePicturesReady() : false;
  const deleted = [];
  for (const candidate of candidates) {
    if (!candidate.coordinated || retained.has(candidate.name) || (candidate.legacyPictures && !picturesReady)) continue;
    if (await storage.delete(candidate.name)) deleted.push(candidate.name);
  }
  return deleted;
}
