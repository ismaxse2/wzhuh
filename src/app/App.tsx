import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { TypographySettings } from "./TypographySettings";
import { VocabularyProvider } from "./VocabularyProvider";
export function App() {
  return (
    <VocabularyProvider>
      <TypographySettings />
      <RouterProvider router={router} />
    </VocabularyProvider>
  );
}
