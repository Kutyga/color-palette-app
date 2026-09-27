/**
 * Распознавание по фото через Edge Function identify-plant: вид растения (Pl@ntNet)
 * и болезни (Pl@ntNet + Gemini). Квота — 20 запросов в день на пользователя.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { AiDiagnosis, PhotoDiagnosis } from "../../domain/diagnosis";
import type { Prediction } from "../../domain/identification";
import { blobToBase64 } from "../../image";
import type { PlantIdentifier } from "../repositories";

import type { Row } from "./shared";

export class PlantNetIdentifier implements PlantIdentifier {
  constructor(private db: SupabaseClient) {}

  private async call(jpeg: Blob, mode: "species" | "diseases", plantHint?: string | null) {
    const { data, error } = await this.db.functions.invoke("identify-plant", {
      body: { image_base64: await blobToBase64(jpeg), organ: "auto", mode, plant_hint: plantHint ?? undefined },
    });
    if (error) {
      const status = error instanceof FunctionsHttpError ? error.context.status : 0;
      if (status === 429) throw new Error("Лимит распознаваний на сегодня исчерпан — попробуйте завтра.");
      if (status === 401) throw new Error("Войдите, чтобы распознавать растения.");
      throw new Error("Сервис распознавания недоступен, попробуйте позже.");
    }
    return data as { results?: Row[]; diseases?: Row[]; ai?: AiDiagnosis | null } | null;
  }

  async diagnose(jpeg: Blob, plantHint?: string | null): Promise<PhotoDiagnosis> {
    const data = await this.call(jpeg, "diseases", plantHint);
    return {
      guesses: (data?.diseases ?? []).map((r) => ({ eppo: String(r.eppo), score: Number(r.score), name: String(r.name ?? r.eppo) })),
      ai: data?.ai ?? null,
    };
  }

  async identify(jpeg: Blob): Promise<Prediction[]> {
    const data = await this.call(jpeg, "species");
    const results = ((data as { results?: Row[] } | null)?.results ?? []) as Row[];
    return results.map((r) => ({
      label: r.name as string,
      score: Number(r.score),
      commonName: ((r.common_names as string[] | null) ?? [])[0] ?? null,
    }));
  }
}
