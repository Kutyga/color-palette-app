"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { Button } from "./ui";

/** Вошедшего пользователя главная сразу ведёт в его сад. */
export function RedirectSignedIn() {
  const { session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "ready") router.replace("/today/");
  }, [session.status, router]);
  return null;
}

export function HomeActions() {
  const { startDemo } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link
        href="/login/?mode=signup"
        className="inline-flex min-h-12 items-center rounded-full bg-leaf px-7 text-[17px] font-semibold text-white hover:brightness-110"
      >
        Начать бесплатно
      </Link>
      <Button
        variant="ghost"
        className="min-h-12 text-[17px]"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await startDemo();
          router.push("/today/");
        }}
      >
        Попробовать без регистрации
      </Button>
    </div>
  );
}
