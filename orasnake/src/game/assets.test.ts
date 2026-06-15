import { describe, expect, it } from "vitest";
import { publicAssetPath } from "./assets";

describe("publicAssetPath", () => {
  it("resolves root-relative public assets under the configured Vite base", () => {
    expect(publicAssetPath("/feature-icons-glow/ai.svg", "/oragame/snake/")).toBe(
      "/oragame/snake/feature-icons-glow/ai.svg"
    );
  });

  it("normalizes base and asset slashes", () => {
    expect(publicAssetPath("feature-icons-glow/vector-search.svg", "/oragame/snake")).toBe(
      "/oragame/snake/feature-icons-glow/vector-search.svg"
    );
  });

  it("keeps local development paths rooted at the dev server", () => {
    expect(publicAssetPath("/feature-icons-glow/json.svg", "/")).toBe("/feature-icons-glow/json.svg");
  });

  it("leaves fully qualified URLs unchanged", () => {
    expect(publicAssetPath("https://example.com/icon.svg", "/oragame/snake/")).toBe("https://example.com/icon.svg");
  });
});
