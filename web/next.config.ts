import type { NextConfig } from "next";

// Статический сайт: собирается в out/ и размещается на любом хостинге (GitHub Pages, Vercel,
// Netlify). Данные пользователя приходят из Supabase прямо в браузере.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // /today/ → today/index.html: так страницы открываются по прямой ссылке на любом статическом хостинге.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
