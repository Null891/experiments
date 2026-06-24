"use client";
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import * as THREE from "three";

/* First-person WASD on a Rapier kinematic capsule (no wall clipping). */
const SPEED = 6, SPRINT = 10.5;

export default function Player() {
  const body = useRef();
  const keys = useRef({});
  const { camera } = useThree();

  useEffect(() => {
    const down = (e) => (keys.current[e.code] = true);
    const up = (e) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame(() => {
    if (!body.current) return;
    const k = keys.current;
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (k.KeyW || k.ArrowUp) dir.add(fwd);
    if (k.KeyS || k.ArrowDown) dir.sub(fwd);
    if (k.KeyD || k.ArrowRight) dir.add(right);
    if (k.KeyA || k.ArrowLeft) dir.sub(right);
    dir.y = 0; if (dir.lengthSq() > 0) dir.normalize();
    const speed = k.ShiftLeft || k.ShiftRight ? SPRINT : SPEED;
    const v = body.current.linvel();
    body.current.setLinvel({ x: dir.x * speed, y: v.y, z: dir.z * speed }, true);
    const p = body.current.translation();
    camera.position.set(p.x, p.y + 0.7, p.z);    // eye height
  });

  return (
    <RigidBody ref={body} colliders={false} mass={1} type="dynamic" position={[-20, 1.2, 1.4]}
      enabledRotations={[false, false, false]} canSleep={false}>
      <CapsuleCollider args={[0.5, 0.42]} />
    </RigidBody>
  );
}
