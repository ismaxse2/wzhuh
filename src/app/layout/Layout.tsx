import { BookOpen, UserRound, Zap } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { SetModalHost } from "../../features/word-sets";
import { AppNotices } from "../ui/AppNotices";
export function Layout() {
  const { pathname } = useLocation();
  const dictionaryActive = pathname === "/dictionary";
  const profileActive =
    pathname === "/profile" || pathname.startsWith("/profile/");
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link
            to="/"
            className="brand site-brand"
            aria-label="Wzhuh — на главную"
          >
            <span className="brand-mark">
              <Zap size={23} fill="currentColor" />
            </span>
            wzhuh<span className="brand-dot">.</span>
          </Link>
          <nav className="site-nav" aria-label="Основная навигация">
            <Link
              to="/dictionary"
              aria-label="Мой словарь"
              title="Мой словарь"
              className={`site-nav-link ${dictionaryActive ? "active" : ""}`}
              aria-current={dictionaryActive ? "page" : undefined}
            >
              <BookOpen size={19} aria-hidden="true" />
              <span className="site-nav-label">Мой словарь</span>
            </Link>
            <Link
              to="/profile"
              aria-label="Профиль"
              title="Профиль"
              className={`site-nav-link ${profileActive ? "active" : ""}`}
              aria-current={profileActive ? "page" : undefined}
            >
              <UserRound size={19} aria-hidden="true" />
              <span className="site-nav-label">Профиль</span>
            </Link>
          </nav>
        </div>
      </header>
      <div className="workspace">
        <AppNotices />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <SetModalHost />
    </div>
  );
}
