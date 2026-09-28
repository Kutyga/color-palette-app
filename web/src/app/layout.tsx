/** Корневой макет: метаданные, цвет темы и провайдеры сессии и данных. */

import type { Metadata, Viewport } from "next";
import { InstallHint } from "@/components/install-hint";
import { Providers } from "@/components/session";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Подоконник — уход за комнатными растениями", template: "%s · Подоконник" },
  description: "Коллекция растений с напоминаниями о поливе, база знаний по 244 комнатным растениям, лента садоводов и достижения.",
  applicationName: "Подоконник",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`,
    // iPhone берёт значок для экрана «Домой» только из PNG.
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png`,
  },
  appleWebApp: { title: "Подоконник", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Соединение с Supabase открывается заранее, пока грузятся скрипты: первые данные приходят быстрее.
const API_ORIGIN = /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  : null;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <head>{API_ORIGIN && <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />}</head>
      <body>
        <Providers>
          <ToastProvider>
            {children}
            <InstallHint />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
