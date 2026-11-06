import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../", import.meta.url));
const rank: Record<string, number> = {
  app: 0,
  pages: 1,
  features: 2,
  entities: 3,
  shared: 4,
};
const clean = (path: string) => path.split(sep).join("/");
function moduleOf(path: string) {
  const parts = path.split("/");
  return ["features", "entities", "shared"].includes(parts[0])
    ? parts.slice(0, 2).join("/")
    : parts[0];
}
function boundaryError(owner: string, target: string): string | null {
  const from = owner.split("/")[0],
    to = target.split("/")[0];
  if (to === "data")
    return from === "entities" ? null : "data belongs to the vocabulary entity";
  if (rank[from] === undefined || rank[to] === undefined) return null;
  if (rank[from] > rank[to]) return "upward dependency";
  if (
    from === to &&
    ["features", "entities"].includes(from) &&
    moduleOf(owner) !== moduleOf(target)
  )
    return "cross-slice dependency";
  if (
    moduleOf(owner) !== moduleOf(target) &&
    ["features", "entities", "shared"].includes(to)
  ) {
    const rest = target.split("/").slice(2).join("/");
    if (["features", "entities"].includes(to) && rest !== "index.ts")
      return "private module import";
    if (
      to === "shared" &&
      ["ui", "lib"].includes(target.split("/")[1]) &&
      rest !== "index.ts"
    )
      return "private shared import";
  }
  return null;
}
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

describe("FSD lite boundaries", () => {
  it("enforces downward imports and public slice APIs in production source", () => {
    const errors: string[] = [];
    for (const file of files(src).filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) &&
        !/\.test\./.test(file) &&
        !clean(file).includes("/test/"),
    )) {
      const owner = clean(relative(src, file));
      const ast = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function inspect(node: ts.Node) {
        const specifier =
          ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
            ? node.moduleSpecifier
            : undefined;
        if (
          specifier &&
          ts.isStringLiteral(specifier) &&
          specifier.text.startsWith(".")
        ) {
          const raw = resolve(dirname(file), specifier.text);
          const target = [
            raw,
            raw + ".ts",
            raw + ".tsx",
            join(raw, "index.ts"),
          ].find((path) => existsSync(path) && statSync(path).isFile());
          if (!target) errors.push(`${owner}: unresolved ${specifier.text}`);
          else {
            const error = boundaryError(owner, clean(relative(src, target)));
            if (error)
              errors.push(
                `${owner} -> ${clean(relative(src, target))}: ${error}`,
              );
          }
        }
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
    expect(errors).toEqual([]);
    for (const old of [
      "components",
      "hooks",
      "utils",
      "services",
      "styles",
      "features/vocabulary",
    ])
      expect(existsSync(join(src, old)), `obsolete directory ${old}`).toBe(
        false,
      );
  });
  it.each([
    [
      "shared/ui/Button.tsx",
      "entities/vocabulary/index.ts",
      "upward dependency",
    ],
    [
      "entities/vocabulary/model/types.ts",
      "app/VocabularyProvider.tsx",
      "upward dependency",
    ],
    [
      "features/lesson/ui/ExerciseCard.tsx",
      "features/word-sets/index.ts",
      "cross-slice dependency",
    ],
    [
      "pages/DictionaryPage.tsx",
      "entities/vocabulary/model/types.ts",
      "private module import",
    ],
    [
      "features/lesson/ui/ExerciseCard.tsx",
      "shared/ui/Button.tsx",
      "private shared import",
    ],
    [
      "features/lesson/ui/ExerciseCard.tsx",
      "entities/vocabulary/index.ts",
      null,
    ],
  ])("checks %s -> %s", (owner, target, error) =>
    expect(boundaryError(owner, target)).toBe(error),
  );
});
