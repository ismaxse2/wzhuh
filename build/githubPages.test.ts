import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import viteConfig from "../vite.config";
import { GITHUB_PAGES_BASE, pages404Html } from "./githubPages";

describe("GitHub Pages build mode", () => {
  it.each([
    ["development", "serve", false, "/"],
    ["production", "build", false, "/"],
    ["production", "serve", true, "/"],
    ["github-pages", "build", false, "/wzhuh/"],
    ["github-pages", "serve", true, "/wzhuh/"],
  ] as const)(
    "%s %s preview=%s uses %s",
    async (mode, command, isPreview, base) => {
      if (typeof viteConfig !== "function")
        throw Error("Expected mode-aware Vite config");
      const config = await viteConfig({
        mode,
        command,
        isPreview,
        isSsrBuild: false,
      });
      expect(config.base).toBe(base);
    },
  );
  it("emits a redirect preserving path, query and fragment", () => {
    const html = pages404Html(GITHUB_PAGES_BASE);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    const replace = vi.fn();
    const location = {
      pathname: "/wzhuh/words",
      search: "?set=food-200&q=%26",
      hash: "#слово",
      replace,
    };
    runInNewContext(script, { window: { location } });
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      "/wzhuh/?__ghp=" +
        encodeURIComponent(location.pathname + location.search + location.hash),
    );
  });
  it.each(["/wzhuh/", "/outside"])(
    "never loops while redirecting %s",
    (pathname) => {
      const script = pages404Html(GITHUB_PAGES_BASE).match(
        /<script>([\s\S]*?)<\/script>/,
      )![1];
      const replace = vi.fn();
      runInNewContext(script, {
        window: { location: { pathname, search: "", hash: "", replace } },
      });
      expect(replace).toHaveBeenCalledExactlyOnceWith("/wzhuh/");
    },
  );
});
