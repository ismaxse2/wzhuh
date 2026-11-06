import { X } from "lucide-react";

import { useVocabulary } from "../../entities/vocabulary";
import { Button, IconButton } from "../../shared/ui";
export function AppNotices() {
  const { data, error, dismissError, update } = useVocabulary();
  return (
    <>
      {" "}
      {data.migrationNotice && (
        <div className="migration-notice" role="status">
          <span>
            Теперь все стадии проходят за один урок без ожидания. Ваши слова
            перенесены в «На изучении», история сохранена. Прежний урок начнётся
            со знакомства.
          </span>
          <Button
            variant="secondary"

            onClick={() => update((d) => ({ ...d, migrationNotice: false }))}
          >
            Понятно
          </Button>
        </div>
      )}
      {error && (
        <div className="storage-error" role="alert">
          <span>{error}</span>
          <IconButton aria-label="Закрыть сообщение" onClick={dismissError}>
            <X size={18} />
          </IconButton>
        </div>
      )}
    </>
  );
}
