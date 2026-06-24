"use client";
import { EffectComposer, SSAO, Bloom, DepthOfField, SMAA, Vignette } from "@react-three/postprocessing";

/* The cinematic stack from the blueprint: SSAO + Bloom + DoF + SMAA. */
export default function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO radius={0.12} intensity={18} luminanceInfluence={0.4} />
      <DepthOfField focusDistance={0.01} focalLength={0.04} bokehScale={2.2} />
      <Bloom intensity={0.28} luminanceThreshold={0.9} luminanceSmoothing={0.6} mipmapBlur />
      <Vignette eskil={false} offset={0.2} darkness={0.6} />
      <SMAA />
    </EffectComposer>
  );
}
