import "./lesson-layout.css";

import { Outlet } from "react-router-dom";

import { AppNotices } from "../ui/AppNotices";
export function LessonLayout() {
  return (
    <div className="lesson-shell">
      <AppNotices />
      <main className="lesson-main">
        <Outlet />
      </main>
    </div>
  );
}
