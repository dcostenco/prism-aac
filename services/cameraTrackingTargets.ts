import type { TrackingTarget } from './bodyPoseService';

// One catalogue for the Settings chips and guided setup. Auto-side options
// remain modes, not a single concrete landmark observed during detection.
export const CAMERA_TRACKING_TARGETS: Array<{
  id: TrackingTarget; label: string; setupLabel: string; emoji: string;
}> = [
  { id: 'any_wrist', label: 'Any Wrist (auto)', setupLabel: 'Any Wrist (auto)', emoji: '🤚' },
  { id: 'any_index', label: 'Any Index (auto)', setupLabel: 'Any Index (auto)', emoji: '👆' },
  { id: 'any_hand', label: 'Any Hand (auto)', setupLabel: 'Any Hand (auto)', emoji: '🖐' },
  { id: 'right_index', label: 'Right Index Finger', setupLabel: 'Right Finger', emoji: '👆' },
  { id: 'left_index', label: 'Left Index Finger', setupLabel: 'Left Finger', emoji: '☝️' },
  { id: 'right_wrist', label: 'Right Wrist', setupLabel: 'Right Hand', emoji: '🤚' },
  { id: 'left_wrist', label: 'Left Wrist', setupLabel: 'Left Hand', emoji: '🖐' },
  { id: 'right_elbow', label: 'Right Elbow', setupLabel: 'Right Elbow', emoji: '💪' },
  { id: 'left_elbow', label: 'Left Elbow', setupLabel: 'Left Elbow', emoji: '💪' },
  { id: 'nose', label: 'Nose (Head)', setupLabel: 'Head', emoji: '🙂' },
  { id: 'right_shoulder', label: 'Right Shoulder', setupLabel: 'Right Shoulder', emoji: '💪' },
  { id: 'left_shoulder', label: 'Left Shoulder', setupLabel: 'Left Shoulder', emoji: '💪' },
];
