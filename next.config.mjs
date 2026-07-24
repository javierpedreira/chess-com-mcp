import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nothing special needed: the MCP server is a stateless route handler.
  reactStrictMode: true,
  // Pin the file-tracing root to this project so build traces don't pick up a
  // parent lockfile (avoids the "inferred workspace root" warning).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
