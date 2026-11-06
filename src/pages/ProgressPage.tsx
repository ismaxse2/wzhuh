import { BookOpen, CheckCircle2, Clock3, Target, Trophy } from "lucide-react";

import {
  learnedToday,
  reviewQueue,
  useVocabulary,
} from "../entities/vocabulary";
import { dayKey, formatDate } from "../shared/lib";
export function ProgressPage() {
  const { data, now } = useVocabulary();
  const progress = Object.values(data.progress);
  const answers = data.answers.filter((a) => a.exercise !== "introduction");
  const correct = answers.filter((a) => a.correct).length;
  const incorrect = answers.length - correct;
  const accuracy = answers.length
    ? Math.round((correct / answers.length) * 100)
    : 0;
  const today = learnedToday(data, now);
  const learned = progress.filter((p) => p.status === "learned").length;
  const learning = progress.length - learned;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6 + i);
    return {
      date: d,
      total: data.answers.filter((a) => dayKey(a.at) === dayKey(d)).length,
    };
  });
  const max = Math.max(5, ...week.map((d) => d.total));
  return (
    <>
      <div className="progress-stats">
        {[
          [BookOpen, "На изучении", learning],
          [Target, "Изучено сегодня", today],
          [Trophy, "Изучены", learned],
          [Clock3, "Рекомендуем повторить", reviewQueue(data, now).length],
        ].map(([Icon, label, value]) => {
          const Component = Icon as typeof BookOpen;
          return (
            <div className="panel progress-stat" key={String(label)}>
              <Component size={21} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <div className="progress-columns">
        <div className="progress-right">
          <section className="panel activity-panel">
            <div className="section-inline">
              <h2>Практика за неделю</h2>
              <span className="soft-badge">7 дней</span>
            </div>
            <div className="activity-chart">
              {week.map(({ date, total }) => (
                <div key={dayKey(date)}>
                  <span>{total}</span>
                  <div className="bar-slot">
                    <div
                      className={dayKey(date) === dayKey(now) ? "current" : ""}
                      style={{ height: `${Math.max(3, (total / max) * 100)}%` }}
                    />
                  </div>
                  <small>
                    {new Intl.DateTimeFormat("ru-RU", {
                      weekday: "short",
                    }).format(date)}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="panel accuracy-panel">
            <div>
              <h2>Точность ответов</h2>
              <strong>
                {accuracy}
                <small>%</small>
              </strong>
            </div>
            <div className="accuracy-counts">
              <span>
                <i className="dot green" />
                {correct} правильно
              </span>
              <span>
                <i className="dot red" />
                {incorrect} ошибок
              </span>
            </div>
          </section>
        </div>
      </div>
      <section className="panel sessions-panel">
        <h2>Последние сессии</h2>
        {data.sessions.length ? (
          <div>
            {data.sessions
              .slice(-5)
              .reverse()
              .map((s) => (
                <div className="session-row" key={s.id}>
                  <span className="stat-icon">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <strong>{formatDate(s.completedAt)}</strong>
                    <small>
                      {s.outcome === "endedEarly" ? "Завершён досрочно · " : ""}
                      {s.exercises} упражнений · {s.learnedWords} впервые
                      изучено
                    </small>
                  </div>
                  <span>
                    {s.correct} верно · {s.incorrect} ошибок
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="muted">
            Завершённые сессии появятся здесь после первой практики.
          </p>
        )}
      </section>
    </>
  );
}
