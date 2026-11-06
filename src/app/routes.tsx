import { Link, Navigate, type RouteObject } from "react-router-dom";

import { DashboardPage } from "../pages/DashboardPage";
import { DictionaryPage } from "../pages/DictionaryPage";
import { LearningPage } from "../pages/LearningPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ProgressPage } from "../pages/ProgressPage";
import { SettingsPage } from "../pages/SettingsPage";
import { WordsPage } from "../pages/WordsPage";
import { Layout } from "./layout/Layout";
import { LessonLayout } from "./layout/LessonLayout";
import { SessionGate } from "./SessionGate";
import { SetRouteRedirect } from "./SetRouteRedirect";
export const appRoutes: RouteObject[] = [
  {
    element: <SessionGate />,
    errorElement: (
      <div className="empty-state">
        <h1>Не удалось открыть страницу</h1>
        <p>Попробуйте перезагрузить приложение.</p>
        <a href="/" className="button primary">
          На главную
        </a>
      </div>
    ),
    children: [
      {
        element: <LessonLayout />,
        children: [{ path: "/words/learn", element: <LearningPage /> }],
      },
      {
        element: <Layout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/words", element: <WordsPage /> },
          { path: "/dictionary", element: <DictionaryPage /> },
          { path: "/words/sets/:id", element: <SetRouteRedirect /> },
          {
            path: "/profile",
            element: <ProfilePage />,
            children: [
              { index: true, element: <ProgressPage /> },
              { path: "settings", element: <SettingsPage /> },
            ],
          },
          { path: "/progress", element: <Navigate to="/profile" replace /> },
          {
            path: "/settings",
            element: <Navigate to="/profile/settings" replace />,
          },
          {
            path: "*",
            element: (
              <div className="empty-state">
                <h1>Страница не найдена</h1>
                <Link to="/" className="button primary">
                  На главную
                </Link>
              </div>
            ),
          },
        ],
      },
    ],
  },
];
