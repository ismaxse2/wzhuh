import { CheckCircle2, RotateCcw, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  endLesson,
  startLesson,
  useVocabulary,
  wordById,
} from "../entities/vocabulary";
import { ExerciseCard, StartButton } from "../features/lesson";

export function LearningPage() {
  const { data } = useVocabulary();
  if (!data.activeSession)
    return (
      <div className="empty-state panel">
        <Sparkles size={36} />
        <h1>Начнём полный урок?</h1>
        <p>
          Выберите слова из личного словаря. Все стадии проходят за один урок,
          без ожидания.
        </p>
        <StartButton />
        <Link to="/dictionary" className="text-link">
          Открыть словарь
        </Link>
      </div>
    );
  return <LearningSessionView key={data.activeSession.id} />;
}
function LearningSessionView() {
  const { data, update } = useVocabulary();
  const session = data.activeSession!;
  const [step, setStep] = useState(session.index);
  const summary = data.sessions.find((s) => s.id === session.id);
  if (session.status !== "active") {
    const early = session.status === "endedEarly";
    const words = session.wordIds.flatMap((id) => {
      const w = wordById.get(id);
      return w ? [w] : [];
    });
    return (
      <div className="completion panel">
        <span className="completion-icon">
          <CheckCircle2 size={38} />
        </span>
        <h1>{early ? "Урок завершён досрочно" : "Урок завершён!"}</h1>
        {summary && (
          <div className="completion-stats">
            {[
              ["Упражнений", summary.exercises],
              ["Верных ответов", summary.correct],
              ["Ошибок", summary.incorrect],
              ["Впервые изучено", summary.learnedWords],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
        <Link to="/" className="button primary completion-finish">
          Завершить
        </Link>
        <Link
          to="/words/learn"
          className="text-link"
          onClick={(event) => {
            if (!update((d) => startLesson(d, words))) event.preventDefault();
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Повторить
        </Link>
      </div>
    );
  }
  const attempt = session.queue[step];
  const task = attempt && session.tasks.find((t) => t.id === attempt.taskId);
  const word = task && wordById.get(task.vocabularyId);
  return (
    <div className="lesson-session">
      <header className="lesson-header">
        <button
          type="button"
          className="brand lesson-brand"
          aria-label="Wzhuh — завершить урок"
          onClick={() => update((d) => endLesson(d))}
        >
          <span className="brand-mark">
            <Zap size={23} fill="currentColor" />
          </span>
          wzhuh<span className="brand-dot">.</span>
        </button>
      </header>
      <div className="lesson-session-body">
        <div className="learning-layout">
          <div>
            <div className="learning-progress">
              <div>
                <strong>
                  {session.completedTaskIds.length} / {session.tasks.length}{" "}
                  заданий
                </strong>
              </div>
              <div className="progress-track">
                <div
                  style={{
                    width: `${(session.completedTaskIds.length / session.tasks.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            {word ? (
              <ExerciseCard
                key={attempt.id}
                word={word}
                step={step}
                onNext={setStep}
              />
            ) : (
              <div className="empty-state panel">
                <h2>Слово больше не доступно</h2>
                <p>
                  Завершите этот урок и выберите доступные слова из словаря.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="lesson-actions">
        <button
          type="button"
          className="text-button lesson-end-button"
          onClick={() => update((d) => endLesson(d))}
        >
          <X size={16} aria-hidden="true" />
          Завершить урок
        </button>
      </div>
    </div>
  );
}
