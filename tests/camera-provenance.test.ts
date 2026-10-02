import { describe, expect, it } from 'vitest';
import { cameraInputAdvanced, type CameraSnapshot } from '../e2e/helpers/camera-provenance';

function snapshot(frames = 1, time = 1): CameraSnapshot {
  return { calls: 1, frames, trackId: 'fixture', retiredTrackIds: [], videos: [
    { id: 0, time, paused: false, ready: 2, connected: true, tracks: [{ id: 'fixture', state: 'live' }] },
  ] };
}

describe('photographic input evidence must not credit a preview alone', () => {
  it('requires two observations with advancing frames and playback', () => {
    expect(cameraInputAdvanced(null, snapshot())).toBe(false);
    expect(cameraInputAdvanced(snapshot(), snapshot(2, 2))).toBe(true);
  });
  it('rejects historical frames and frozen playback independently', () => {
    expect(cameraInputAdvanced(snapshot(), snapshot(1, 2))).toBe(false);
    expect(cameraInputAdvanced(snapshot(), snapshot(2, 1))).toBe(false);
  });
  it('accepts healthy replacement without crediting removed, stopped fixture history', () => {
    const current = snapshot(2, 2);
    current.retiredTrackIds = ['old-fixture'];
    current.videos.push({ ...current.videos[0], id: 1, time: 0, paused: true, connected: false,
      tracks: [{ id: 'old-fixture', state: 'ended' }] });
    expect(cameraInputAdvanced(snapshot(), current)).toBe(true);
    current.videos[1].connected = true;
    expect(cameraInputAdvanced(snapshot(), current)).toBe(false);
    current.videos[1].connected = false;
    current.retiredTrackIds = [];
    expect(cameraInputAdvanced(snapshot(), current)).toBe(false);
  });
  it('rejects ended current input even when explicitly stopped and detached', () => {
    const current = snapshot(2, 2);
    current.retiredTrackIds = ['fixture'];
    current.videos[0].connected = false;
    current.videos[0].tracks[0].state = 'ended';
    expect(cameraInputAdvanced(snapshot(), current)).toBe(false);
  });
  it.each(['paused', 'unready', 'ended', 'native', 'no-tracks', 'no-videos', 'unused', 'switched'])(
    'rejects %s input even while the fixture counter advances', failure => {
      const current = snapshot(2, 2);
      if (failure === 'paused') current.videos[0].paused = true;
      if (failure === 'unready') current.videos[0].ready = 1;
      if (failure === 'ended') current.videos[0].tracks[0].state = 'ended';
      if (failure === 'native') current.videos.push({ ...current.videos[0], id: 1,
        tracks: [{ id: 'native-detector', state: 'live' }] });
      if (failure === 'no-tracks') current.videos[0].tracks = [];
      if (failure === 'no-videos') current.videos = [];
      if (failure === 'unused') current.calls = 0;
      if (failure === 'switched') current.trackId = 'replacement';
      expect(cameraInputAdvanced(snapshot(), current)).toBe(false);
    });
});
