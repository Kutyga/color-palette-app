"""Звук видеоурока: голос, фоновая музыка и сведение.

Голос — Vosk TTS (Apache 2.0), диктор «Наташа» из SOVA (Apache 2.0, коммерческое использование
разрешено). Каждое предложение озвучивается отдельно, поэтому субтитры точно совпадают с речью.
Музыка — генерируется здесь же (мягкий эмбиент из аккордов и колокольчиков): своя, без чужих прав.

Вход: JSON {"scenes": [{"voice": "..."}], "out": "папка"}; выход в папке:
  timeline.json — длительность сцен и время каждой фразы (для титров),
  audio.wav     — голос + музыка, 44.1 кГц, стерео.
Запуск: python -I lessons-audio.py <модель Vosk> <вход.json> [speaker_id]
"""

import json
import re
import sys
import wave

import numpy as np
from vosk_tts import Model, Synth

SR = 44100
LEAD = 0.6  # тишина в начале сцены, с
GAP = 0.32  # пауза между предложениями
TAIL = 0.9  # пауза в конце сцены
INTRO = 1.2  # музыка до первой фразы


def tts_text(s: str) -> str:
    """Vosk знает не все знаки: тире — пауза, кавычки и скобки убираем."""
    s = re.sub(r"\s*[–—]\s*", ", ", s)
    s = re.sub(r"[«»\"()]", "", s)
    return s.strip()


def sentences(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.!?…])\s+", text) if p.strip()]


def read_wav(path: str) -> np.ndarray:
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels()).mean(axis=1)
        rate = w.getframerate()
    if rate != SR:  # передискретизация линейной интерполяцией — для речи достаточно
        t = np.arange(int(len(data) * SR / rate)) * rate / SR
        data = np.interp(t, np.arange(len(data)), data).astype(np.float32)
    # обрезаем тишину по краям, чтобы паузы задавали мы сами
    loud = np.where(np.abs(data) > 0.01)[0]
    return data[loud[0] : loud[-1] + 1] if len(loud) else data


# ---------------------------------------------------------------------------
# Музыка: Am9 — Fmaj7 — C(add9) — G6, по 8 секунд; мягкая подложка, колокольчики, «реверберация».
# ---------------------------------------------------------------------------

CHORDS = [
    [57, 60, 64, 67, 71],  # Am9
    [53, 57, 60, 64, 69],  # Fmaj7
    [48, 55, 60, 62, 64],  # Cadd9
    [55, 59, 62, 64, 67],  # G6
]


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Мягкий фильтр низких частот через спектр (быстро, без scipy)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(spec, len(x)).astype(np.float32)


def music(seconds: float, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    left = np.zeros(n, np.float32)
    right = np.zeros(n, np.float32)
    bar = 8.0
    for k in range(int(seconds // bar) + 2):
        chord = CHORDS[k % len(CHORDS)]
        start = k * bar - 1.5
        s0, s1 = max(0, int(start * SR)), min(n, int((start + bar + 3) * SR))
        if s0 >= s1:
            continue
        tt = t[s0:s1] - start
        env = np.clip(tt / 2.5, 0, 1) * np.clip((bar + 3 - tt) / 2.5, 0, 1)
        for i, m in enumerate(chord):
            f = hz(m - 12 if i == 0 else m)
            for det, pan in ((-0.12, 0.3), (0.0, 0.5), (0.13, 0.7)):
                ff = f * 2 ** (det / 12)
                wave_ = np.sin(2 * np.pi * ff * tt + rng.uniform(0, 6.28)) + 0.18 * np.sin(2 * np.pi * 2 * ff * tt)
                left[s0:s1] += (0.035 * env * wave_ * (1 - pan)).astype(np.float32)
                right[s0:s1] += (0.035 * env * wave_ * pan).astype(np.float32)
        # колокольчики: редкие ноты аккорда октавой выше с быстрым затуханием
        for b in range(8):
            if rng.random() < 0.45:
                continue
            bt = k * bar + b * 1.0 + rng.uniform(0, 0.15)
            b0 = int(bt * SR)
            if b0 >= n:
                continue
            ln = min(n - b0, int(2.6 * SR))
            tb = np.arange(ln) / SR
            note = hz(chord[rng.integers(1, len(chord))] + 12)
            tone = np.sin(2 * np.pi * note * tb + 0.6 * np.sin(2 * np.pi * note * 2 * tb)) * np.exp(-tb * 2.4) * 0.05
            p = rng.uniform(0.25, 0.75)
            left[b0 : b0 + ln] += (tone * (1 - p)).astype(np.float32)
            right[b0 : b0 + ln] += (tone * p).astype(np.float32)
    left, right = lowpass(left, 2600), lowpass(right, 2600)
    # «реверберация»: несколько затухающих задержек с перекрёстной стереобазой
    for d, g in ((0.113, 0.32), (0.197, 0.25), (0.311, 0.2), (0.457, 0.14)):
        k = int(d * SR)
        left[k:] += g * right[:-k]
        right[k:] += g * left[:-k]
    fade = np.minimum(1, np.minimum(t / 2.0, (seconds - t) / 3.0)).astype(np.float32)
    mix = np.stack([left * fade, right * fade], axis=1)
    return mix / (np.abs(mix).max() + 1e-6) * 0.5


def main() -> None:
    model_dir, spec_path = sys.argv[1], sys.argv[2]
    speaker = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    spec = json.load(open(spec_path, encoding="utf-8"))
    out = spec["out"]
    synth = Synth(Model(model_path=model_dir))

    voice_parts: list[np.ndarray] = [np.zeros(int(INTRO * SR), np.float32)]
    cursor = INTRO
    timeline = []
    for si, scene in enumerate(spec["scenes"]):
        start = cursor
        cursor += LEAD
        voice_parts.append(np.zeros(int(LEAD * SR), np.float32))
        lines = []
        for li, sentence in enumerate(sentences(scene["voice"])):
            path = f"{out}/s{si}_{li}.wav"
            synth.synth(tts_text(sentence), path, speaker_id=speaker)
            clip = read_wav(path)
            lines.append({"text": sentence, "start": round(cursor, 3), "end": round(cursor + len(clip) / SR, 3)})
            voice_parts += [clip, np.zeros(int(GAP * SR), np.float32)]
            cursor += len(clip) / SR + GAP
        voice_parts.append(np.zeros(int(TAIL * SR), np.float32))
        cursor += TAIL
        timeline.append({"start": round(start, 3), "end": round(cursor, 3), "lines": lines})
        print(f"сцена {si}: {cursor - start:.1f} с", flush=True)

    voice = np.concatenate(voice_parts)
    voice = voice / (np.abs(voice).max() + 1e-6) * 0.9
    total = len(voice) / SR + 1.5
    bg = music(total)
    n = len(bg)
    voice = np.pad(voice, (0, n - len(voice)))
    # приглушаем музыку, пока звучит голос (плавная огибающая)
    talk = np.convolve((np.abs(voice) > 0.02).astype(np.float32), np.ones(int(0.4 * SR)) / int(0.4 * SR), "same")
    duck = 1.0 - 0.55 * np.clip(talk * 3, 0, 1)
    mix = bg * duck[:, None] + voice[:, None] * 0.95
    mix = np.clip(mix / max(1.0, np.abs(mix).max()), -1, 1)
    with wave.open(f"{out}/audio.wav", "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    json.dump({"total": round(total, 3), "scenes": timeline}, open(f"{out}/timeline.json", "w", encoding="utf-8"), ensure_ascii=False)


main()
