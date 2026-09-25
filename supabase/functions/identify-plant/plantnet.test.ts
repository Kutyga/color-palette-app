// Запуск: node --experimental-strip-types --test supabase/functions/identify-plant/plantnet.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeBase64Image, plantnetUrl, toIdentifications } from "./plantnet.ts";

const sample = {
  query: { project: "all", organs: ["auto"] },
  bestMatch: "Monstera deliciosa Liebm.",
  results: [
    {
      score: 0.12,
      species: {
        scientificNameWithoutAuthor: "Philodendron bipinnatifidum",
        genus: { scientificNameWithoutAuthor: "Philodendron" },
        family: { scientificNameWithoutAuthor: "Araceae" },
        commonNames: ["Филодендрон"],
      },
    },
    {
      score: 0.87,
      species: {
        scientificNameWithoutAuthor: "Monstera deliciosa",
        genus: { scientificNameWithoutAuthor: "Monstera" },
        family: { scientificNameWithoutAuthor: "Araceae" },
        commonNames: ["Монстера деликатесная", "Монстера", "Swiss cheese plant", "лишнее"],
      },
    },
    { score: 0.01, species: {} },
  ],
  remainingIdentificationRequests: 499,
};

test("результаты Pl@ntNet: сортировка, до 3 народных названий, пропуск неполных", () => {
  const r = toIdentifications(sample);
  assert.equal(r.length, 2);
  assert.equal(r[0].name, "Monstera deliciosa");
  assert.equal(r[0].score, 0.87);
  assert.deepEqual(r[0].common_names, ["Монстера деликатесная", "Монстера", "Swiss cheese plant"]);
  assert.equal(r[0].genus, "Monstera");
  assert.equal(r[1].family, "Araceae");
});

test("неожиданный ответ не роняет функцию", () => {
  assert.deepEqual(toIdentifications(null), []);
  assert.deepEqual(toIdentifications({ results: "oops" }), []);
});

test("адрес запроса: ключ, язык и число результатов", () => {
  const url = new URL(plantnetUrl("KEY", "ru", 5));
  assert.equal(url.origin + url.pathname, "https://my-api.plantnet.org/v2/identify/all");
  assert.equal(url.searchParams.get("api-key"), "KEY");
  assert.equal(url.searchParams.get("lang"), "ru");
  assert.equal(url.searchParams.get("nb-results"), "5");
});

test("base64 с префиксом data: и без", () => {
  assert.deepEqual([...decodeBase64Image("AQID")], [1, 2, 3]);
  assert.deepEqual([...decodeBase64Image("data:image/jpeg;base64,AQID")], [1, 2, 3]);
  assert.throws(() => decodeBase64Image("не base64!"));
});
