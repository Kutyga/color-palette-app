"use client";

/** Съёмка камерой устройства: полноэкранный видоискатель и поле «фото» для форм (где можно — и из файлов). */

import { Camera, ImagePlus, RefreshCw, X, Zap, ZapOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Кадр с видео — ровно та рамка, что видна в видоискателе (по центру, пропорции ratio = ширина/высота),
 * в JPEG не больше maxSide по длинной стороне. Так снимок не обрезается потом неожиданно.
 */
function grabFrame(video: HTMLVideoElement, ratio: number, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const [sw, sh] = vw / vh > ratio ? [vh * ratio, vh] : [vw, vw / ratio];
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить снимок"))), "image/jpeg", quality),
  );
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Нет доступа к камере. Разрешите его в настройках браузера (значок замка рядом с адресом) и попробуйте снова.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Камера не найдена. Откройте сайт на телефоне, чтобы сфотографировать растение.";
  if (name === "NotReadableError") return "Камера занята другим приложением. Закройте его и попробуйте снова.";
  return "Не удалось включить камеру.";
}

/**
 * Съёмка прямо на сайте. В коллекцию попадают только растения, сфотографированные у себя дома,
 * а не картинки из интернета — поэтому там выбора файла нет (см. CameraField allowFiles).
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  ratio = 1,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (photo: Blob) => void;
  /** Пропорции снимка (ширина/высота): рамка видоискателя и сохранённое фото совпадают. */
  ratio?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  // Вспышка (фонарик камеры): есть не на всех телефонах и не во всех браузерах — кнопка только там, где работает.
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  // iPhone не даёт сайту включать вспышку, но системная камера (input capture) с ней работает и
  // открывается сразу на съёмку, без галереи — правило «только снимок» сохраняется.
  const [ios] = useState(() => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent));
  const systemCameraRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Этот браузер не умеет снимать с камеры. Откройте сайт в Safari или Chrome на телефоне.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        stop();
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorch({ supported: caps?.torch === true, on: false });
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(cameraError(e));
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, stop]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false }); // телефон отказал — прячем кнопку
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setShooting(true);
    try {
      const blob = await grabFrame(video, ratio);
      stop();
      onCapture(blob);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setShooting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Камера">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[15px] font-medium">Сфотографируйте растение</p>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-white/15"
          aria-label="Закрыть камеру"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="relative grid min-h-0 flex-1 place-items-center">
        {/* Видоискатель — ровно в пропорциях будущего снимка: что в рамке, то и сохранится. */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ aspectRatio: ratio, width: `min(100%, calc((100dvh - 15rem) * ${ratio}))` }}
        >
          <video ref={videoRef} playsInline muted className="size-full object-cover" aria-label="Видоискатель" />
        </div>
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="max-w-sm text-[17px]">{error}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-8 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {torch.supported ? (
          <button
            type="button"
            onClick={toggleTorch}
            className={`grid size-12 place-items-center rounded-full ${torch.on ? "bg-white text-black" : "bg-white/15"}`}
            aria-label={torch.on ? "Выключить вспышку" : "Включить вспышку"}
            aria-pressed={torch.on}
          >
            {torch.on ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
          </button>
        ) : ios ? (
          <>
            <button
              type="button"
              onClick={() => systemCameraRef.current?.click()}
              className="grid size-12 place-items-center rounded-full bg-white/15"
              aria-label="Системная камера со вспышкой"
            >
              <Zap className="size-5" />
            </button>
            <input
              ref={systemCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Снимок системной камерой"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const blob = await fileToJpeg(file);
                  stop();
                  onCapture(blob);
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </>
        ) : (
          <span className="size-12" aria-hidden />
        )}
        <button
          type="button"
          onClick={shoot}
          disabled={!ready || shooting}
          className="grid size-20 place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
          aria-label="Снять"
        >
          <Camera className="size-8" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setFacing(facing === "environment" ? "user" : "environment")}
          className="grid size-12 place-items-center rounded-full bg-white/15"
          aria-label="Сменить камеру"
        >
          <RefreshCw className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** Фото из файла — тоже в JPEG не больше maxSide по длинной стороне (как снимок с камеры). */
async function fileToJpeg(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось открыть файл — выберите фото в формате JPEG или PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить фото"))), "image/jpeg", quality),
  );
}

/**
 * Кнопка «Сфотографировать» с предпросмотром снимка. С allowFiles — ещё и «Выбрать из файлов»
 * (объявления, розыгрыши, лента, осмотр). В свою коллекцию фото только с камеры.
 */
export function CameraField({
  photoUrl,
  onCapture,
  aspect = "aspect-square",
  allowFiles = false,
}: {
  photoUrl: string | null;
  onCapture: (photo: Blob) => void;
  /** Пропорции кадра-предпросмотра. */
  aspect?: string;
  allowFiles?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    try {
      onCapture(await fileToJpeg(file));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block w-full overflow-hidden rounded-[28px]"
        aria-label={photoUrl ? "Переснять фото" : "Сфотографировать растение"}
      >
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр снимка */}
            <img src={photoUrl} alt="Фото растения" className={`${aspect} bg-muted w-full object-contain`} />
            <span className="glass text-label absolute right-4 bottom-4 flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold">
              <Camera className="size-4" aria-hidden /> Переснять
            </span>
          </>
        ) : (
          <span className={`grid ${aspect} bg-muted text-secondary w-full place-items-center`}>
            <span className="flex flex-col items-center gap-2 px-6 text-center">
              <Camera className="size-10" strokeWidth={1.5} aria-hidden />
              <span className="text-label font-medium">Сфотографировать растение</span>
              <span className="text-[13px]">
                {allowFiles ? "Или выберите готовое фото из файлов" : "Снимок делается прямо здесь — загрузка из галереи отключена"}
              </span>
            </span>
          </span>
        )}
      </button>
      {allowFiles && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="bg-muted mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full font-semibold"
          >
            <ImagePlus className="size-5" aria-hidden /> Выбрать из файлов
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Фото из файлов"
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = ""; // тот же файл можно выбрать снова
            }}
          />
          {fileError && (
            <p className="text-alert mt-2 text-[14px]" role="alert">
              {fileError}
            </p>
          )}
        </>
      )}
      <CameraCapture open={open} onClose={() => setOpen(false)} onCapture={onCapture} ratio={aspect.includes("4/3") ? 4 / 3 : 1} />
    </>
  );
}

/** Выбранный снимок формы: JPEG и локальная ссылка для предпросмотра. */
export interface PickedPhoto {
  blob: Blob;
  url: string;
}

/**
 * Несколько фото для публикации: пока пусто — обычное поле съёмки; дальше — плитки снимков
 * (первый — обложка) и «Добавить»: камера или сразу несколько файлов.
 */
export function PhotosField({
  photos,
  onAdd,
  onRemove,
  max,
  aspect = "aspect-[4/3]",
}: {
  photos: PickedPhoto[];
  onAdd: (blob: Blob) => void;
  onRemove: (index: number) => void;
  max: number;
  aspect?: string;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFiles(files: FileList | null) {
    setFileError(null);
    for (const file of [...(files ?? [])].slice(0, max - photos.length)) {
      try {
        onAdd(await fileToJpeg(file));
      } catch (e) {
        setFileError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  if (photos.length === 0) return <CameraField allowFiles aspect={aspect} photoUrl={null} onCapture={onAdd} />;
  return (
    <>
      <ul className="grid grid-cols-3 gap-2" aria-label="Фото публикации">
        {photos.map((p, i) => (
          <li key={p.url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр снимка */}
            <img src={p.url} alt={`Фото ${i + 1}`} className="bg-muted aspect-square w-full rounded-2xl object-cover" />
            {i === 0 && (
              <span className="glass absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold">Обложка</span>
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Убрать фото ${i + 1}`}
              className="glass absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {photos.length < max && (
          <li className="bg-muted flex aspect-square flex-col overflow-hidden rounded-2xl text-[13px] font-semibold">
            <button type="button" onClick={() => setCameraOpen(true)} className="flex flex-1 items-center justify-center gap-1.5">
              <Camera className="size-4" aria-hidden /> Снять
            </button>
            <span className="bg-separator h-px" aria-hidden />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5">
              <ImagePlus className="size-4" aria-hidden /> Из файлов
            </button>
          </li>
        )}
      </ul>
      <p className="text-secondary mt-2 text-center text-[13px]">
        {photos.length} из {max} фото
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Ещё фото из файлов"
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {fileError && (
        <p className="text-alert mt-2 text-[14px]" role="alert">
          {fileError}
        </p>
      )}
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={onAdd} ratio={aspect.includes("4/3") ? 4 / 3 : 1} />
    </>
  );
}
