/** Supports 4.5–5 fps camera delivery with ±20% jitter and a 15 Hz poll.
 * Duplicate polls never authorize inference or selection. This bound only
 * decides when to interrupt continuity; it is not a decoded-frame detector. */
export const CAMERA_FRAME_STALE_MS = 500;
