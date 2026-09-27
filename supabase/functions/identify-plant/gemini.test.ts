// Запуск: node --experimental-strip-types --test supabase/functions/identify-plant/gemini.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { bytesToBase64, CAUSE_IDS, describeGeminiFailure, geminiRequest, isRetryableGeminiStatus, toAiDiagnosis } from "./gemini.ts";

const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

test("ответ Gemini: причины из справочника, незнакомые — other, уверенность в 0…1, не больше трёх", () => {
  const d = toAiDiagnosis(
    reply({
      is_plant: true,
      healthy: false,
      plant: "Калатея",
      summary: "Клещ и сухой воздух",
      problems: [
        { cause: "dry_air", title: "Сухой воздух", confidence: 0.4, evidence: "сухие кончики" },
        { cause: "spider_mite", title: "Паутинный клещ", confidence: 1.7, evidence: "паутинка" },
        { cause: "alien", title: "Что-то новое", confidence: 0.3, evidence: "" },
        { cause: "thrips", title: "", confidence: 0.9, evidence: "" },
        { cause: "aphids", title: "Тля", confidence: 0.1, evidence: "" },
      ],
    }),
  );
  assert.equal(d?.healthy, false);
  assert.deepEqual(
    d?.problems.map((p) => [p.cause, p.confidence]),
    [["spider_mite", 1], ["dry_air", 0.4], ["other", 0.3]],
  );
});

test("здоровое растение, не растение, мусор", () => {
  assert.deepEqual(toAiDiagnosis(reply({ is_plant: true, healthy: true, plant: null, summary: "Всё хорошо", problems: [] })), {
    isPlant: true, healthy: true, plant: null, summary: "Всё хорошо", problems: [],
  });
  const notPlant = toAiDiagnosis(reply({ is_plant: false, healthy: true, summary: "Это кот", problems: [{ cause: "stress", title: "x", confidence: 1, evidence: "" }] }));
  assert.equal(notPlant?.isPlant, false);
  assert.equal(notPlant?.healthy, false);
  assert.deepEqual(notPlant?.problems, []);
  assert.equal(toAiDiagnosis({ candidates: [{ content: { parts: [{ text: "не json" }] } }] }), null);
  assert.equal(toAiDiagnosis({}), null);
});

test("запрос: фото, подсказка о растении и схема с перечнем причин", () => {
  const r = geminiRequest("QUJD", "Монстера Мося");
  const parts = r.contents[0].parts as Record<string, unknown>[];
  assert.deepEqual(parts[0], { inline_data: { mime_type: "image/jpeg", data: "QUJD" } });
  assert.match(String(parts[1].text), /Монстера Мося/);
  assert.equal(r.generationConfig.responseMimeType, "application/json");
  assert.ok(CAUSE_IDS.every((id) => r.systemInstruction.parts[0].text.includes(id)));
  assert.equal(bytesToBase64(new Uint8Array([65, 66, 67])), "QUJD");
  assert.ok(isRetryableGeminiStatus(503) && !isRetryableGeminiStatus(400));
});

test("ответ в обёртке ```json, с «мыслями» модели; обрезанный — null с понятной причиной", () => {
  const obj = { is_plant: true, healthy: true, plant: null, summary: "Ок", problems: [] };
  const wrapped = { candidates: [{ content: { parts: [{ text: "думаю…", thought: true }, { text: "```json\n" + JSON.stringify(obj) + "\n```" }] } }] };
  assert.equal(toAiDiagnosis(wrapped)?.summary, "Ок");
  const cut = { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"is_plant": true, "summ' }] } }] };
  assert.equal(toAiDiagnosis(cut), null);
  assert.match(describeGeminiFailure(cut), /finishReason=MAX_TOKENS/);
});
