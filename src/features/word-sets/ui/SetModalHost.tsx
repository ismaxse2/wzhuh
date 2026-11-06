import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import { setById } from "../../../entities/vocabulary";
import { SetWordsModal } from "./SetWordsModal";
export function SetModalHost() {
  const [params, setParams] = useSearchParams();
  const id = params.get("set");
  const close = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("set");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setParams]);
  return id !== null ? (
    <SetWordsModal key={id} set={setById(id)} onClose={close} />
  ) : null;
}
