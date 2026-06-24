"use client";
import { Canvas } from "@react-three/fiber";
import { Environment, PointerLockControls, AdaptiveDpr, Preload } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import Player from "./Player";
import Mansion from "./Mansion";
import PostFX from "./PostFX";
import HUD from "./HUD";
import { useMansion } from "../lib/store";

/* The hybrid stack: 3D <Canvas> + external HTML <HUD/> overlay, bound by Zustand. */
export default function Experience() {
  const active = useMansion((s) => s.activeRoom);
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 64, near: 0.05, far: 500, position: [-20, 1.65, 1.4] }}
      >
        <color attach="background" args={["#e9e2d4"]} />
        <fog attach="fog" args={["#e9e2d4", 40, 110]} />
        <Suspense fallback={null}>
          {/* RoomEnvironment-style image-based lighting */}
          <Environment preset="apartment" environmentIntensity={0.7} />
          <hemisphereLight args={["#fff4e6", "#47402f", 0.45]} />
          <directionalLight position={[-34, 44, 16]} intensity={1.1} color="#ffe6bf" castShadow />
          <Physics gravity={[0, -9.81, 0]}>
            <Player />
            <Mansion />
          </Physics>
          <Preload all />
        </Suspense>
        <PostFX />
        <PointerLockControls makeDefault />
      </Canvas>

      <HUD />
      {active && (
        <div className="overlay">
          <button className="back" onClick={() => useMansion.getState().close()}>⟵ Back to the Mansion</button>
          <iframe title={active.name} src={`/experiences/${active.page}${active.finale ? "?seen=" + useMansion.getState().visited.size : ""}`} />
        </div>
      )}
    </>
  );
}
