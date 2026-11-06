import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { VocabularyProvider } from "./VocabularyProvider";
export function App() {
  return (
    <VocabularyProvider>
      <RouterProvider router={router} />
    </VocabularyProvider>
  );
}
