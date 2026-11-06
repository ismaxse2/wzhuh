import { Check, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";

import { useSpeech, useVocabulary } from "../entities/vocabulary";
import { Select } from "../shared/ui";

export function SettingsPage() {
  const { data, update, reset } = useVocabulary();
  const { speak, enabled, supported, speechError } = useSpeech();
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState("");
  const change = (patch: Partial<typeof data.settings>) => {
    if (update((d) => ({ ...d, settings: { ...d.settings, ...patch } })))
      setSaved("Настройки сохранены");
  };
  return (
    <>
      {saved && (
        <div className="settings-feedback saved-status" role="status">
          <Check size={15} />
          {saved}
        </div>
      )}
      <div className="settings-stack">
        <section className="panel settings-panel">
          <div className="settings-title">
            <div>
              <h2>Сколько слов хотите учить в день</h2>
            </div>
          </div>
          <div className="limit-options">
            {[5, 10, 15, 20, 30].map((limit) => (
              <button
                key={limit}
                aria-label={`${limit} слов за раз`}
                aria-pressed={data.settings.quickAddCount === limit}
                className={
                  data.settings.quickAddCount === limit ? "selected" : ""
                }
                onClick={() => change({ quickAddCount: limit })}
              >
                <strong>{limit}</strong>
                <span>слов за раз</span>
                {data.settings.quickAddCount === limit && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="settings-title">
            <div>
              <h2>Произношение</h2>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Автоматическое озвучивание</strong>
              <p>
                {supported
                  ? "Произносить слово при открытии карточки знакомства"
                  : "Этот браузер не поддерживает Speech Synthesis"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Автоматическое озвучивание"
              aria-checked={data.settings.speechEnabled}
              className={`switch ${data.settings.speechEnabled ? "on" : ""}`}
              onClick={() =>
                change({ speechEnabled: !data.settings.speechEnabled })
              }
            >
              <span />
            </button>
          </div>
          <div className="setting-row accent-setting">
            <div>
              <strong>Вариант английского</strong>
              <p>Доступные голоса зависят от браузера и системы.</p>
            </div>
            <Select
              aria-label="Вариант произношения"
              value={data.settings.accent}
              onChange={(e) =>
                change({ accent: e.target.value as "en-US" | "en-GB" })
              }
            >
              <option value="en-US">American · en-US</option>
              <option value="en-GB">British · en-GB</option>
            </Select>
          </div>
          <button
            className="button secondary"
            disabled={!enabled}
            onClick={() =>
              speak("A little progress every day adds up to big results.")
            }
          >
            <Volume2 size={16} /> Послушать пример
          </button>
          {speechError && (
            <p role="status" className="retry-failure">
              {speechError}
            </p>
          )}
        </section>
        <section className="panel settings-panel">
          <div className="settings-title">
            <div>
              <h2>Данные и прогресс</h2>
              <p>Ваши данные сохраняются только в этом браузере.</p>
            </div>
          </div>
          <div className="data-note">
            ВНИМАНИЕ! При очистке данных браузера прогресс будет удалён.
          </div>
          <div className="setting-row">
            <div>
              <strong>Начать с чистого листа</strong>
              <p>Удалить прогресс, историю и настройки.</p>
            </div>
            <button
              className="button danger-outline"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={15} /> Сбросить
            </button>
          </div>
          {confirm && (
            <div className="reset-confirm" role="alert">
              <h3>Удалить весь прогресс?</h3>
              <p>
                Это действие нельзя отменить. Все слова снова станут новыми.
              </p>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => setConfirm(false)}
                >
                  Отмена
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    if (reset()) {
                      setConfirm(false);
                      setSaved("Прогресс сброшен");
                    }
                  }}
                >
                  Да, удалить данные
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
