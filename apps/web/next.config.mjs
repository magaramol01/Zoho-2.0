import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Monorepo root = 2 levels up from apps/web
const monorepoRoot = path.resolve(__dirname, '../../');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Ensures standalone output mirrors: standalone/apps/web/server.js
  outputFileTracingRoot: monorepoRoot,
}

export default nextConfig
