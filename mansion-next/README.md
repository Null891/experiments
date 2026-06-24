# The Mansion — Next.js + React-Three-Fiber edition

This is the **framework-stack** version from the blueprint: Next.js (App Router) + React-Three-Fiber
+ `@react-three/drei` + `@react-three/rapier` (WASM physics) + `@react-three/postprocessing`
+ Zustand. It mirrors the vanilla Three.js mansion in the parent folder.

> ⚠️ It was scaffolded but **not installed/run in this sandbox** (the npm registry here sits behind a
> TLS-intercepting proxy and there's no browser to run a dev server). Run it in a normal Node
> environment.

## Run

```bash
cd mansion-next
npm install
# the room iframes load from /experiences — copy the sites into public/:
#   (mac/linux)  mkdir -p public && cp -r ../experiences public/experiences
#   (windows)    mkdir public 2>nul & xcopy /E /I ..\experiences public\experiences
npm run dev          # http://localhost:3000
```

## How it maps to the blueprint

| Blueprint piece | Here |
|---|---|
| Next.js routing/wrapper | `app/` (App Router), `page.jsx` dynamically imports the canvas with `ssr:false` |
| React Three Fiber + drei | `components/Experience.jsx` — `<Canvas>`, `<Environment>`, `<PointerLockControls>`, `<Preload>` |
| Rapier physics (no wall clipping) | `<Physics>` + a `CapsuleCollider` player in `Player.jsx`; walls are `RigidBody type="fixed"` |
| WASD kinematic controller | `Player.jsx` — velocity from keys, eye height synced to the capsule each frame |
| Embedded in-world UI | `<Html transform>` display panels in `Mansion.jsx` (the "inside" UI) |
| External HUD | `HUD.jsx` — plain React DOM bound to the same Zustand store (the "outside" UI) |
| Zustand state bridge | `lib/store.js` — `nearRoom`, `visited`, `activeRoom` shared between DOM ↔ canvas |
| SSAO + Bloom + DoF + SMAA | `PostFX.jsx` via `@react-three/postprocessing` |
| Occlusion / streaming | `<Preload all/>` + `<Html occlude>`; extend with per-room `<Suspense>` + `useGLTF.preload` |
| Room data | `lib/rooms.json` (generated from the parent `js/registry.js` — all 75 rooms) |

## What to add next (to reach the full blueprint)
- Author the Roman/Victorian geometry in **Blender → glTF + Draco**, load with `useGLTF`.
- Custom **GLSL** materials (marble/dust) via `shaderMaterial` from drei.
- Per-room `<Suspense>` + frustum/occlusion culling so only nearby rooms stay mounted.
- WebXR: wrap with `@react-three/xr` `createXRStore()` + `<XR>` and an Enter-VR button.
