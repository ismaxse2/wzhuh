import {
  ArrowRight,
  BookCheck,
  BookOpen,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import {
  allWords,
  reviewLessonWords,
  startLesson,
  useVocabulary,
  wordSets,
} from "../entities/vocabulary";
import { LessonSelection } from "../features/lesson";
import { SetCard } from "../features/word-sets";
export function DashboardPage() {
  const { data, now, update, blocked } = useVocabulary();
  const navigate = useNavigate();
  const reviewWords = reviewLessonWords(data, allWords, now);
  const startReview = () => {
    if (!reviewWords.length) return;
    if (
      update((current) => startLesson(current, reviewWords, "dictionary", now))
    )
      navigate("/words/learn");
  };
  const words = Object.values(data.progress);
  const learning = words.filter((p) => p.status === "learning").length;
  const learned = words.filter((p) => p.status === "learned").length;
  return (
    <>
      <LessonSelection />
      <section className="stat-grid dashboard-stat-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <span>На изучении</span>
            <strong>
              {learning}
              <small> слов</small>
            </strong>
          </div>
          <TrendingUp size={17} className="muted" />
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <BookCheck size={19} />
          </span>
          <div>
            <span>Изучены</span>
            <strong>
              {learned}
              <small> слов</small>
            </strong>
          </div>
          {!!reviewWords.length && (
            <button
              className="text-button review-link"
              disabled={blocked}
              onClick={startReview}
            >
              <RotateCcw size={15} /> Повторять
            </button>
          )}
        </div>
      </section>
      <section className="sets-section">
        <div className="section-heading">
          <div>
            <h2 className="dashboard-sets-heading">Наборы слов</h2>
          </div>
          <Link to="/words" className="text-link">
            Все наборы <ArrowRight size={16} />
          </Link>
        </div>
        <div className="set-grid dashboard-sets">
          {wordSets.slice(0, 6).map((set) => (
            <SetCard key={set.id} set={set} />
          ))}
        </div>
      </section>
    </>
  );
}
