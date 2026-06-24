import { create } from "zustand";

/* Global state shared between the external HTML HUD and the in-canvas 3D world. */
export const useMansion = create((set) => ({
  activeRoom: null,                 // room the player is teleporting into / viewing
  visited: new Set(),
  nearRoom: null,                   // room the player is standing in front of
  directoryOpen: false,
  setNear: (room) => set({ nearRoom: room }),
  open: (room) => set((s) => { const v = new Set(s.visited); if (room && !room.finale) v.add(room.id); return { activeRoom: room, visited: v }; }),
  close: () => set({ activeRoom: null }),
  toggleDirectory: (force) => set((s) => ({ directoryOpen: force === undefined ? !s.directoryOpen : force })),
}));
