import { ArrowRight, Check, Keyboard, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import {
  allWords,
  buildLetters,
  checkAnswer,
  checkSpellingAnswer,
  choicesFor,
  completeExercise,
  contextChoicesFor,
  type Exercise,
  SpeechButton,
  useSpeech,
  useVocabulary,
  type Word,
  WordTranslation,
} from "../../../entities/vocabulary";
import { ContextSentence } from "./ContextSentence";

const exerciseTitles: Record<Exercise, string> = {
  introduction: "Познакомьтесь со словом",
  recognition: "Выберите перевод",
  reverse: "Выберите английское слово",
  builder: "Соберите слово из букв",
  spelling: "Напишите слово по-английски",
  context: "Выберите пропущенное слово",
};
export function ExerciseCard({
  word,
  step,
  onNext,
}: {
  word: Word;
  step: number;
  onNext: (nextStep: number) => void;
}) {
  const { data, update } = useVocabulary();
  const session = data.activeSession!;
  // Freeze the task while its answer advances the persisted lesson queue.
  const [task] = useState(() =>
    session.tasks.find((t) => t.id === session.queue[step].taskId)!,
  );
  const exercise = task.exercise;
  useSpeech(exercise === "introduction" ? word.word : undefined);
  const [choices] = useState(() =>
    exercise === "context"
      ? contextChoicesFor(word)
      : choicesFor(word, allWords, exercise === "reverse"),
  );
  const [letters] = useState(() => buildLetters(word.word));
  const [selected, setSelected] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const id = session.queue[step].id;
  const expected =
    exercise === "recognition"
      ? word.translation
      : exercise === "context"
        ? (word.contextAnswer ?? word.word)
        : word.word;
  const frozen = submitted;
  const assembled = selected
    .map((id) => letters.find((l) => l.id === id)!.value)
    .join("");
  const value =
    exercise === "builder"
      ? assembled
      : exercise === "recognition" ||
          exercise === "reverse" ||
          exercise === "context"
        ? (choice ?? "")
        : answer;
  const submit = () => {
    if (frozen) return;
    const correct =
      exercise === "introduction" ||
      (exercise === "spelling"
        ? checkSpellingAnswer(value, word)
        : checkAnswer(value, expected));
    let nextStep = step;
    const saved = update((d) => {
      const next = completeExercise(d, {
        id,
        sessionId: session.id,
        taskId: task.id,
        correct,
      });
      nextStep = next.activeSession?.index ?? step;
      return next;
    });
    if (!saved) return;
    if (correct) onNext(nextStep);
    else setSubmitted(true);
  };
  const partOfSpeech: Record<string, string> = {
    noun: "существительное",
    verb: "глагол",
    adjective: "прилагательное",
    adverb: "наречие",
    interjection: "междометие",
  };
  return (
    <section className="exercise-card panel">
      <div className="exercise-title">{exerciseTitles[exercise]}</div>
      {exercise === "introduction" ? (
        <>
          <div className="intro-word">
            <h1 lang="en">{word.word}</h1>
            <SpeechButton text={word.word} />
          </div>
          <div className="transcription">
            {word.transcription}{" "}
            <span>
              · {partOfSpeech[word.partOfSpeech] ?? word.partOfSpeech}
            </span>
          </div>
          <h2 className="translation">
            <WordTranslation word={word} />
          </h2>
          <div className="example-box">
            <div>
              <span lang="en">{word.example}</span>
              <SpeechButton text={word.example} label="Прослушать пример" />
            </div>
            <p>{word.exampleTranslation}</p>
          </div>
        </>
      ) : (
        <>
          <div className="prompt">
            <h1 lang={exercise === "recognition" ? "en" : "ru"}>
              {exercise === "recognition"
                ? word.word
                : exercise === "context"
                  ? null
                  : word.translation}
            </h1>
            {exercise === "recognition" && (
              <span className="transcription">{word.transcription}</span>
            )}
            {exercise === "context" && (
              <ContextSentence word={word} revealed={submitted} />
            )}
          </div>
          {(exercise === "recognition" ||
            exercise === "reverse" ||
            exercise === "context") && (
            <div className="answer-choices">
              {choices.map((option, i) => (
                <button
                  key={option}
                  disabled={submitted}
                  onClick={() => setChoice(option)}
                  className={`answer-choice ${choice === option ? "chosen" : ""} ${submitted && option === expected ? "correct" : ""} ${submitted && choice === option && option !== expected ? "incorrect" : ""}`}
                >
                  <span className="option-number">{i + 1}</span>
                  {option}
                  {submitted && option === expected && <Check size={18} />}
                </button>
              ))}
            </div>
          )}
          {exercise === "builder" && (
            <>
              <div className="letter-answer" aria-label="Собранное слово">
                {selected.length ? (
                  selected.map((id) => {
                    const l = letters.find((l) => l.id === id)!;
                    return (
                      <button
                        key={id}
                        className="letter-tile selected-tile"
                        disabled={frozen}
                        aria-label={`Убрать букву ${l.value}`}
                        onClick={() => {
                          setSelected((s) => s.filter((v) => v !== id));
                        }}
                      >
                        {l.value === " " ? "␣" : l.value}
                      </button>
                    );
                  })
                ) : (
                  <span>Нажимайте на буквы ниже</span>
                )}
              </div>
              <div className="letter-pool">
                {letters.map((l) => (
                  <button
                    key={l.id}
                    className={`letter-tile ${selected.includes(l.id) ? "used" : ""}`}
                    disabled={frozen || selected.includes(l.id)}
                    onClick={() => {
                      setSelected((s) => [...s, l.id]);
                    }}
                    aria-label={`Добавить букву ${l.value}`}
                  >
                    {l.value === " " ? "␣" : l.value}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-button reset-letters"
                disabled={frozen}
                onClick={() => {
                  setSelected([]);
                }}
              >
                <RotateCcw size={14} /> Сбросить буквы
              </button>
            </>
          )}
          {exercise === "spelling" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (value.trim()) submit();
              }}
            >
              <div className="spelling-input">
                <Keyboard size={20} />
                <input
                  id="word-answer"
                  aria-label="Ваш ответ на английском"
                  autoFocus
                  value={answer}
                  disabled={frozen}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                  }}
                  lang="en"
                  placeholder="Введите слово…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              <button type="submit" hidden disabled={frozen}>
                Проверить
              </button>
            </form>
          )}
        </>
      )}
      {submitted && (
        <div
          role="status"
          aria-live="polite"
          className="answer-feedback failure"
        >
          <X size={21} />
          <div>
            <strong>Правильный ответ:</strong>
            <p lang={exercise === "recognition" ? "ru" : "en"}>{expected}</p>
          </div>
          <SpeechButton text={word.word} />
        </div>
      )}
      <div className="exercise-actions">
        {!submitted ? (
          <button
            className="button primary wide"
            disabled={exercise !== "introduction" && !value.trim()}
            onClick={submit}
          >
            {exercise === "introduction" ? "Продолжить" : "Проверить ответ"}
            <ArrowRight size={17} />
          </button>
        ) : (
          <>
            <button
              className="button primary"
              onClick={() => onNext(session.index)}
            >
              Продолжить урок <ArrowRight size={17} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
