"use client";
import dynamic from "next/dynamic";

/* R3F must run client-side only — disable SSR for the whole experience. */
const Experience = dynamic(() => import("../components/Experience"), { ssr: false });

export default function Page() {
  return <main><Experience /></main>;
}
