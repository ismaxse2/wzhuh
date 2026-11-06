import type { Plugin } from "vite";

export const GITHUB_PAGES_BASE = "/wzhuh/";

/** GitHub Pages serves this document for deep links absent from static output. */
export function pages404Html(base: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wzhuh</title>
  <script>
    (function () {
      var base = ${JSON.stringify(base)};
      var location = window.location;
      var path = location.pathname;
      if (path.indexOf(base) === 0 && path !== base) {
        location.replace(base + "?__ghp=" + encodeURIComponent(path + location.search + location.hash));
      } else {
        location.replace(base);
      }
    })();
  </script>
</head>
<body><p>Открываем Wzhuh…</p><noscript>Для работы приложения включите JavaScript.</noscript></body>
</html>`;
}

export function githubPagesFallback(): Plugin {
  let base = GITHUB_PAGES_BASE;
  let enabled = false;
  return {
    name: "wzhuh-github-pages-fallback",
    apply: "build",
    configResolved(config) {
      enabled = config.mode === "github-pages";
      base = config.base;
    },
    generateBundle() {
      if (enabled)
        this.emitFile({
          type: "asset",
          fileName: "404.html",
          source: pages404Html(base),
        });
    },
  };
}
