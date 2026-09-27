/** Файлы на устройстве пользователя: скачивание выгрузки и чтение прайса (CSV или Excel). */
import { parseCsv } from "./domain/shop";

/** Скачивает текст как файл (CSV — с BOM уже внутри текста). */
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel сохраняет CSV то в UTF-8, то в Windows-1251. */
async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1251").decode(buf);
  }
}

/** Таблица из файла прайса: .xlsx — через read-excel-file (подгружается по требованию), иначе CSV. */
export async function readTable(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  if (/\.xls$/i.test(file.name)) throw new Error("Старый формат .xls не поддерживается — сохраните файл как .xlsx или .csv");
  return parseCsv(await readTextFile(file));
}
