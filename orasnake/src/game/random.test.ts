import { describe, expect, it } from "vitest";
import { shuffled } from "./random";

describe("shuffled", () => {
  it("returns a shuffled copy without mutating the input", () => {
    const items = ["a", "b", "c", "d"];
    const randomValues = [0, 0.5, 0];
    const result = shuffled(items, () => randomValues.shift() ?? 0);

    expect(result).toEqual(["c", "d", "b", "a"]);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps every item exactly once", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffled(items, () => 0.99);

    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual(items);
  });
});
