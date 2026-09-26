"use client";

import { Camera, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Кадр с видео — в JPEG не больше maxSide по длинной стороне. */
function grabFrame(video: HTMLVideoElement, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить снимок"))), "image/jpeg", quality),
  );
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Нет доступа к камере. Разрешите его в настройках браузера (значок замка рядом с адресом) и попробуйте снова.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Камера не найдена. Откройте сайт на телефоне, чтобы сфотографировать растение.";
  if (name === "NotReadableError") return "Камера занята другим приложением. Закройте его и попробуйте снова.";
  return "Не удалось включить камеру.";
}

/**
 * Съёмка прямо на сайте. Выбора файла из галереи нет намеренно: в коллекцию попадают только
 * растения, сфотографированные у себя дома, а не картинки из интернета.
 */
export function CameraCapture({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (photo: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);

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

  async function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setShooting(true);
    try {
      const blob = await grabFrame(video);
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
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/15" aria-label="Закрыть камеру">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted className="size-full object-contain" aria-label="Видоискатель" />
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="max-w-sm text-[17px]">{error}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-8 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <span className="size-12" aria-hidden />
        <button
          onClick={shoot}
          disabled={!ready || shooting}
          className="grid size-20 place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
          aria-label="Снять"
        >
          <Camera className="size-8" aria-hidden />
        </button>
        <button
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

/** Кнопка «Сфотографировать» с предпросмотром снимка. */
export function CameraField({
  photoUrl,
  onCapture,
  aspect = "aspect-square",
}: {
  photoUrl: string | null;
  onCapture: (photo: Blob) => void;
  /** Пропорции кадра-предпросмотра. */
  aspect?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative block w-full overflow-hidden rounded-[28px]" aria-label={photoUrl ? "Переснять фото" : "Сфотографировать растение"}>
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр снимка */}
            <img src={photoUrl} alt="Фото растения" className={`${aspect} w-full object-cover`} />
            <span className="glass absolute right-4 bottom-4 flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold text-label">
              <Camera className="size-4" aria-hidden /> Переснять
            </span>
          </>
        ) : (
          <span className={`grid ${aspect} w-full place-items-center bg-muted text-secondary`}>
            <span className="flex flex-col items-center gap-2 px-6 text-center">
              <Camera className="size-10" strokeWidth={1.5} aria-hidden />
              <span className="font-medium text-label">Сфотографировать растение</span>
              <span className="text-[13px]">Снимок делается прямо здесь — загрузка из галереи отключена</span>
            </span>
          </span>
        )}
      </button>
      <CameraCapture open={open} onClose={() => setOpen(false)} onCapture={onCapture} />
    </>
  );
}
