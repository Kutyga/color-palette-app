# Видеоуроки курса «Новичкам»

Ролики лежат в `public/lessons/<slug>.mp4` (+ обложка `.jpg`) и раздаются с хостинга вместе с сайтом.
К уроку видео подключается в `src/lib/guides.ts` → `LESSON_VIDEOS`. Текст урока — статья из `GUIDES`.

## Из чего собирается ролик

| Часть                                     | Чем                                                                                 | Лицензия                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| Сценарий: сцены, заголовки, текст озвучки | `src/data/lessons.json`                                                             | наш                                              |
| Голос                                     | Vosk TTS 0.9 (модель `vosk-tts-ru-0.9-multi`), диктор `female_1` — «Наташа» из SOVA | Apache 2.0, коммерческое использование разрешено |
| Музыка                                    | генерируется в `scripts/lessons-audio.py` (аккорды + колокольчики)                  | своя, без чужих прав                             |
| Графика                                   | анимированные сцены HTML/SVG/CSS в `scripts/build-lessons.mjs`                      | своя                                             |
| Шрифты                                    | Unbounded, Manrope (`scripts/lesson-assets/`)                                       | SIL OFL                                          |

Голос озвучивает каждое предложение отдельно — субтитры в кадре совпадают с речью точно.
Браузер останавливает все CSS-анимации на нужном моменте и снимает кадр за кадром (30 к/с, 1080×1920).

## Как собрать

```bash
# один раз: Python-окружение с Vosk TTS и ffmpeg
python3 -m venv ~/lessons-venv
~/lessons-venv/bin/pip install vosk-tts imageio-ffmpeg numpy
# модель (≈900 МБ): huggingface.co/drakulavich/vosk-tts-ru-0.9-multi — файлы config.json, dictionary,
# model.onnx, bert/model.onnx, bert/vocab.txt в одну папку

cd web
PYTHON=~/lessons-venv/bin/python \
VOSK_MODEL=~/vosk-tts-ru-0.9-multi \
FFMPEG=$(~/lessons-venv/bin/python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
npm run lessons -- start        # slug урока; без него — все уроки
```

- `PREVIEW=папка` — вместо видео сохранить по два кадра с каждой сцены (быстрая проверка графики).
- `AUDIO_DIR=папка` — взять готовый звук (`timeline.json`, `audio.wav`) и только перерисовать картинку.

Новый урок: добавить сцены в `lessons.json` (рисунки сцен — объект `ART` в `build-lessons.mjs`),
собрать ролик, прописать его в `LESSON_VIDEOS` с длительностью.
