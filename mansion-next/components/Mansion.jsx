"use client";
import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import rooms from "../lib/rooms.json";
import { useMansion } from "../lib/store";

/* Procedural floor-plan: galleries of enclosed rooms with solid (physics) walls.
   Each room's display is an in-world <Html transform> panel (the "embedded" UI). */
const ROOM_W = 8.6, ROOM_D = 7.2, H = 4.6, CORR = 6.4, PER_SIDE = 6;
const STRIP = 2 * ROOM_D + CORR + 0.6;

function layout() {
  const out = [];
  const experiences = rooms.filter((r) => !r.finale);
  let i = 0;
  const strips = Math.ceil(experiences.length / (PER_SIDE * 2));
  for (let s = 0; s < strips; s++) {
    const Cz = s * STRIP;
    for (let c = 0; c < PER_SIDE && i < experiences.length; c++)
      out.push({ room: experiences[i++], x: -PER_SIDE * ROOM_W / 2 + ROOM_W / 2 + c * ROOM_W, z: Cz - CORR / 2 - ROOM_D / 2, f: 1 });
    for (let c = 0; c < PER_SIDE && i < experiences.length; c++)
      out.push({ room: experiences[i++], x: -PER_SIDE * ROOM_W / 2 + ROOM_W / 2 + c * ROOM_W, z: Cz + CORR / 2 + ROOM_D / 2, f: -1 });
  }
  return out;
}

function Wall({ position, size }) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#ece5d6" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

function Room({ x, z, f, room }) {
  const open = useMansion((s) => s.open);
  const setNear = useMansion((s) => s.setNear);
  const backZ = z - f * ROOM_D / 2;
  return (
    <group>
      <Wall position={[x, H / 2, backZ]} size={[ROOM_W, H, 0.2]} />
      <Wall position={[x + ROOM_W / 2, H / 2, z]} size={[0.2, H, ROOM_D]} />
      {/* display panel — embedded in-world UI */}
      <Html transform position={[x, 1.95, backZ + f * 0.12]} rotation={[0, f > 0 ? 0 : Math.PI, 0]}
        distanceFactor={3} occlude>
        <div onClick={() => open(room)} onPointerEnter={() => setNear(room)}
          style={{ width: 360, padding: 22, background: "#f6f1e6", border: `6px solid ${room.color}`,
            borderRadius: 6, fontFamily: "Georgia, serif", textAlign: "center", cursor: "pointer" }}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: "#998a6b" }}>ROOM {String(room.id + 1).padStart(2, "0")}</div>
          <div style={{ fontSize: 30, fontWeight: 700, margin: "6px 0", color: "#2a241a" }}>{room.name}</div>
          <div style={{ fontSize: 13, color: "#7a6f57" }}>{room.blurb}</div>
          <div style={{ marginTop: 10, fontWeight: 800, color: room.color }}>ENTER →</div>
        </div>
      </Html>
    </group>
  );
}

export default function Mansion() {
  const cells = useMemo(layout, []);
  const W = PER_SIDE * ROOM_W + 16, Z = (cells.at(-1)?.z ?? 0) + 20;
  return (
    <group>
      {/* marble floor (physics ground) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, Z / 2 - 10]} receiveShadow>
          <planeGeometry args={[W, Z]} />
          <meshStandardMaterial color="#dcd2bd" roughness={0.28} metalness={0} envMapIntensity={1.3} />
        </mesh>
      </RigidBody>
      {cells.map((c, i) => <Room key={i} {...c} />)}
    </group>
  );
}
