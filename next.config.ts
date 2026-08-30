import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A fila real de 2025 tem 72 mil inscrições. Ela é importada só por módulos
  // marcados com `server-only`, então nunca entra no bundle do cliente.
};

export default nextConfig;
