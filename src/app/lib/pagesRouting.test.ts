import { describe, expect, it, vi } from "vitest";

import { restoredPagesUrl, restorePagesRoute } from "./pagesRouting";

const origin = "https://example.github.io";
const base = "/wzhuh/";
const transport = (path: string) =>
  `${origin}${base}?__ghp=${encodeURIComponent(path)}`;
describe("GitHub Pages route restoration", () => {
  it.each([
    "/wzhuh/dictionary",
    "/wzhuh/profile/settings",
    "/wzhuh/words/learn",
    "/wzhuh/words?set=food-200&view=all",
    "/wzhuh/missing",
    "/wzhuh/dictionary?q=чай%20и%20кофе&next=a%26b%3Dc#слово",
    "/wzhuh/dictionary?q=100%25&query=%252F&space=a+b#example",
  ])("restores %s without decoding query contents twice", (path) => {
    const expected = new URL(path, origin);
    expect(restoredPagesUrl(transport(path), base)).toBe(
      expected.pathname + expected.search + expected.hash,
    );
  });
  it.each([
    "https://evil.example/wzhuh/dictionary",
    "//evil.example/wzhuh/dictionary",
    "/other/dictionary",
    "/wzhuh/../outside",
    "/wzhuh/%2e%2e/outside",
    "/wzhuh/..\\outside",
    "/wzhuh/dictionary\n",
    "",
    "/wzhuh/?__ghp=again",
  ])("rejects unsafe or recursive destination %s", (path) =>
    expect(restoredPagesUrl(transport(path), base)).toBe(base),
  );
  it("removes invalid or repeated transport parameters while preserving unrelated query and hash", () => {
    expect(
      restoredPagesUrl(
        `${origin}/wzhuh/?set=food-200&__ghp=bad&__ghp=bad#notice`,
        base,
      ),
    ).toBe("/wzhuh/?set=food-200#notice");
  });
  it("does not touch normal routes or normal query strings", () => {
    expect(
      restoredPagesUrl(`${origin}/wzhuh/words?set=food-200`, base),
    ).toBeNull();
    expect(restoredPagesUrl(`${origin}/wzhuh/`, base)).toBeNull();
    expect(
      restoredPagesUrl(`${origin}/wzhuh/dictionary?__ghp=ordinary`, base),
    ).toBeNull();
  });
  it("uses replaceState and preserves history state before the router starts", () => {
    const replaceState = vi.fn();
    const state = { key: "existing", idx: 0 };
    const browser = {
      location: { href: transport("/wzhuh/profile/settings") },
      history: { replaceState, state },
    };
    expect(restorePagesRoute(true, base, browser)).toBe(true);
    expect(replaceState).toHaveBeenCalledExactlyOnceWith(
      state,
      "",
      "/wzhuh/profile/settings",
    );
  });
  it("does nothing outside the github-pages mode", () => {
    const replaceState = vi.fn();
    expect(
      restorePagesRoute(false, "/", {
        location: { href: transport("/wzhuh/dictionary") },
        history: { replaceState, state: null },
      }),
    ).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
