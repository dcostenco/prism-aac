import { expect, type Page } from '@playwright/test';

export interface CameraSnapshot {
  calls: number;
  frames: number;
  trackId: string;
  retiredTrackIds: string[];
  videos: { id: number; time: number; paused: boolean; ready: number; connected: boolean;
    tracks: { id: string; state: string }[] }[];
}

// Record detached inference videos too: a correct PIP cannot prove the
// detector is using that stream. Preserve the native setter's behavior.
export function installCameraVideoProbe() {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')!;
  const videos = new Set<HTMLVideoElement>();
  Object.assign(window, { __cameraInputVideos: videos });
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    ...descriptor,
    set(value) {
      descriptor.set!.call(this, value);
      if (this instanceof HTMLVideoElement) videos.add(this);
    },
  });
}

export function cameraInputAdvanced(previous: CameraSnapshot | null, current: CameraSnapshot): boolean {
  if (!previous || current.calls < 1 || !current.trackId ||
      current.trackId !== previous.trackId || current.frames <= previous.frames) return false;
  // Only discard an explicitly stopped fixture input after removal AND
  // replacement. Ended current inputs and unknown/native streams fail closed.
  const inputs = current.videos.filter(video => !(!video.connected && video.tracks.length > 0 &&
    video.tracks.every(track => track.state === 'ended' && track.id !== current.trackId &&
      current.retiredTrackIds.includes(track.id))));
  return inputs.length > 0 && inputs.every(video => {
    const before = previous.videos.find(item => item.id === video.id);
    return before !== undefined && video.time > before.time && !video.paused && video.ready >= 2 &&
      video.tracks.length > 0 && video.tracks.every(track =>
        track.id === current.trackId && track.state === 'live');
  });
}

export async function expectPhotographicCameraInput(page: Page, key: string) {
  let previous: CameraSnapshot | null = null;
  await expect.poll(async () => {
    const current = await page.evaluate(key => {
      const globals = window as unknown as Record<string, unknown>;
      const state = globals[key] as { calls: number; frames: number; trackId: string; retiredTrackIds: string[] };
      const videos = [...globals.__cameraInputVideos as Set<HTMLVideoElement>];
      return { calls: state.calls, frames: state.frames, trackId: state.trackId, retiredTrackIds: state.retiredTrackIds,
        videos: videos.flatMap((video, id) => video.srcObject instanceof MediaStream ? [{
          id, time: video.currentTime, paused: video.paused, ready: video.readyState, connected: video.isConnected,
          tracks: video.srcObject.getVideoTracks().map(track => ({ id: track.id, state: track.readyState })),
        }] : []),
      };
    }, key);
    const advanced = cameraInputAdvanced(previous, current);
    previous = current;
    return advanced;
  }, { message: 'All camera videos, including detector input, must advance the photographic stream',
    timeout: 10_000 }).toBe(true);
}
