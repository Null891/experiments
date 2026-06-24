"use client";
import { useMansion } from "../lib/store";

/* The "outside" UI layer — plain React DOM over the canvas, bound to the
   same Zustand store the 3D world uses. Crosshair + room prompt + progress. */
export default function HUD() {
  const near = useMansion((s) => s.nearRoom);
  const visited = useMansion((s) => s.visited);
  return (
    <div className="hud">
      <div className="crosshair" />
      <div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
        fontSize: 12, letterSpacing: 2, opacity: 0.85 }}>
        75 ROOMS · EXPLORED {visited.size}/74
      </div>
      {near && (
        <div className="prompt">
          <b>{near.finale ? "✦ " : "#" + String(near.id + 1).padStart(2, "0") + " · "}{near.name}</b>
          <span>{near.blurb}</span>
        </div>
      )}
    </div>
  );
}
