/** Synthetic SDK output for orchestration tests, never pixel-recognition proof. */
export function handForPose(pose: Array<{ x: number; y: number; visibility: number }> | undefined,
  width: number, height: number, crop: { x: number; y: number; side: number }, dx = 0, dy = 0) {
  const wrist = [pose?.[15], pose?.[16]].find(point => point && point.visibility >= 0.3);
  if (!wrist) return { landmarks: [] };
  const x = ((wrist.x + dx) * width - crop.x) / crop.side;
  const y = ((wrist.y + dy) * height - crop.y) / crop.side;
  return { landmarks: [Array.from({ length: 21 }, (_, i) => ({
    x: Math.max(0, Math.min(1, x + (i === 5 ? -0.05 : i === 17 ? 0.05 : 0))),
    y: Math.max(0, Math.min(1, y - (i === 9 ? 0.1 : 0))), z: 0,
  }))] };
}
