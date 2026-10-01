/** Фитильный полив: кому подходит по группе и профилю ухода. */

import { describe, expect, it } from "vitest";
import { speciesBySlug } from "../../knowledge";
import { wickAdvice } from "../wick";

const fit = (slug: string) => {
  const s = speciesBySlug(slug)!;
  return wickAdvice(s.group, s.care).fit;
};

describe("фитильный полив", () => {
  it("влаголюбивым подходит, засухоустойчивым — нет", () => {
    expect(fit("goeppertia-orbifolia")).toBe("good");
    expect(fit("spathiphyllum-wallisii")).toBe("good");
    expect(fit("nephrolepis-exaltata")).toBe("good");
    expect(fit("monstera-deliciosa")).toBe("careful");
    expect(fit("zamioculcas-zamiifolia")).toBe("no");
    expect(fit("crassula-ovata")).toBe("no");
    expect(fit("phalaenopsis-hybrid")).toBe("no");
    expect(fit("hoya-carnosa")).toBe("no");
  });
});
