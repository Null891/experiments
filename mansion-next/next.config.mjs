/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,           // R3F + Strict double-invoke can duplicate 3D objects
  transpilePackages: ["three"],
};
export default nextConfig;
