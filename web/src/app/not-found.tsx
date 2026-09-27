/** Страница 404. */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-[64px]">🪴</p>
        <h1 className="mt-2 text-[28px] font-bold">Такой страницы нет</h1>
        <p className="text-secondary mt-2">Возможно, растение пересадили по другому адресу.</p>
        <Link href="/" className="bg-leaf mt-6 inline-flex rounded-full px-6 py-3 font-semibold text-white">
          На главную
        </Link>
      </div>
    </div>
  );
}
