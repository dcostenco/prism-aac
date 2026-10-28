import { create } from 'zustand';

interface PaidPlanState {
  /** The server's last access reply said its paid-only policy is in force.
   *  Copy that promises free use switches to its paid-plan wording only while
   *  this is on; with the policy off every screen reads as before. */
  active: boolean;
  /** The paid-plan lock is covering the board. Board input (hardware keys,
   *  switch scanning) stands down while it is. */
  locked: boolean;
  setActive: (active: boolean) => void;
  setLocked: (locked: boolean) => void;
}

export const usePaidPlanStore = create<PaidPlanState>(set => ({
  active: false,
  locked: false,
  setActive: active => set({ active }),
  setLocked: locked => set({ locked }),
}));

/** The paid-plan variant of a string key while the policy is in force. */
export function paidPlanKey(key: string, active: boolean): string {
  return active ? `${key}_paid_plan` : key;
}
