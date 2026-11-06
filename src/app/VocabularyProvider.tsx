import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  emptyData,
  storageService,
  VocabularyContext,
} from "../entities/vocabulary";

function initial() {
  try {
    return {
      data: storageService.load(),
      error: null as string | null,
      blocked: false,
    };
  } catch {
    return {
      data: emptyData(),
      error:
        "Не удалось прочитать сохранённые данные. Они оставлены без изменений. Проверьте доступ к хранилищу или сбросьте данные в настройках.",
      blocked: true,
    };
  }
}
export function VocabularyProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(initial);
  const [data, setData] = useState(loaded.data);
  const current = useRef(data);
  const [error, setError] = useState(loaded.error);
  const [blocked, setBlocked] = useState(loaded.blocked);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const update = useCallback(
    (change: Parameters<typeof setData>[0]) => {
      if (blocked) {
        setError(
          "Хранилище недоступно: сначала восстановите доступ или сбросьте данные в настройках.",
        );
        return false;
      }
      const next =
        typeof change === "function" ? change(current.current) : change;
      if (next === current.current) return true;
      try {
        storageService.save(next);
        current.current = next;
        setData(next);
        setError(null);
        setNow(new Date());
        return true;
      } catch {
        setError(
          "Не удалось сохранить изменения. Возможно, хранилище заполнено или отключено. Ответ не записан — попробуйте ещё раз.",
        );
        return false;
      }
    },
    [blocked],
  );
  const reset = () => {
    try {
      const next = emptyData();
      storageService.save(next);
      current.current = next;
      setData(next);
      setBlocked(false);
      setError(null);
      return true;
    } catch {
      setError(
        "Не удалось сбросить данные. Разрешите локальное хранилище в браузере.",
      );
      return false;
    }
  };
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "wzhuh:user:v1") return;
      try {
        const next = storageService.load();
        current.current = next;
        setData(next);
        setError(null);
        setBlocked(false);
      } catch {
        setBlocked(true);
        setError("Изменения в другой вкладке не удалось прочитать.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <VocabularyContext
      value={{
        data,
        update,
        error,
        blocked,
        dismissError: () => setError(null),
        reset,
        now,
      }}
    >
      {children}
    </VocabularyContext>
  );
}
