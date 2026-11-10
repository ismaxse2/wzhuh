import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import { describe, expect, it } from "vitest";
const src = fileURLToPath(new URL("../", import.meta.url));
function styles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? styles(join(dir, entry.name))
      : entry.name.endsWith(".css")
        ? [join(dir, entry.name)]
        : [],
  );
}
describe("stylesheet ownership and tokens", () => {
  it("scales all text independently of fixed layout dimensions", () => {
    for (const file of styles(src))
      postcss.parse(readFileSync(file, "utf8")).walkDecls((declaration) => {
        if (declaration.prop.startsWith("--text-"))
          expect(declaration.value, declaration.prop).toMatch(/^[\d.]+rem$/);
        if (declaration.prop === "font-size" && /px/.test(declaration.value)) {
          expect(file).toBe(join(src, "shared/styles/base.css"));
          expect(declaration.value).toBe("16px");
          expect(declaration.parent?.type).toBe("rule");
          expect((declaration.parent as { selector?: string }).selector).toBe(
            ":root",
          );
        }
      });
  });
  it("keeps the app style entry limited to imports and resolves local CSS imports", () => {
    const entry = postcss.parse(
      readFileSync(join(src, "app/styles/index.css"), "utf8"),
    );
    expect(
      entry.nodes.every(
        (node) =>
          node.type === "comment" ||
          (node.type === "atrule" && node.name === "import"),
      ),
    ).toBe(true);
    for (const file of styles(src))
      postcss
        .parse(readFileSync(file, "utf8"))
        .walkAtRules("import", (rule) => {
          const path = rule.params.match(/^["'](\.[^"']+)["']/)?.[1];
          if (path)
            expect(
              existsSync(resolve(dirname(file), path)),
              `${file}: ${path}`,
            ).toBe(true);
        });
  });
  it("resolves CSS variables without cycles or missing tokens", () => {
    const definitions = new Map<string, string>();
    const references: { file: string; value: string }[] = [];
    for (const file of styles(src))
      postcss.parse(readFileSync(file, "utf8")).walkDecls((declaration) => {
        if (declaration.prop.startsWith("--"))
          definitions.set(declaration.prop, declaration.value);
        references.push({ file, value: declaration.value });
      });
    function check(value: string, stack: string[] = []) {
      for (const match of value.matchAll(/var\((--[\w-]+)/g)) {
        const key = match[1];
        expect(definitions.has(key), `undefined ${key}`).toBe(true);
        expect(stack, `cyclic token ${key}`).not.toContain(key);
        if (definitions.has(key) && !stack.includes(key))
          check(definitions.get(key)!, [...stack, key]);
      }
    }
    for (const { file, value } of references) {
      expect(() => check(value), file).not.toThrow();
    }
    expect(definitions.get("--space-4")).toBe("16px");
    expect(definitions.get("--text-base")).toBe("1rem");
    expect(definitions.get("--content-max-width")).toBe("1100px");
    expect(definitions.get("--accent")).toBe("var(--color-accent)");
  });
});
