import { createBrowserRouter } from "react-router-dom";

import { restorePagesRoute } from "./lib/pagesRouting";
import { appRoutes } from "./routes";
restorePagesRoute(
  import.meta.env.MODE === "github-pages",
  import.meta.env.BASE_URL,
);
export const router = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL,
});
