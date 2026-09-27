/** Общий каркас страниц приложения (навигация и проверка входа — в AppShell). */

import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
