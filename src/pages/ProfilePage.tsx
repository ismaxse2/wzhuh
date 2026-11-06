import { NavLink, Outlet } from "react-router-dom";

import { Tabs } from "../shared/ui";
export function ProfilePage() {
  return (
    <>
      <div className="page-heading">
        <h1>Профиль</h1>
      </div>
      <Tabs
        as="nav"
        variant="navigation"
        className="profile-tabs"
        aria-label="Разделы профиля"
      >
        <NavLink
          to="/profile"
          end
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Прогресс
        </NavLink>
        <NavLink
          to="/profile/settings"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Настройки
        </NavLink>
      </Tabs>
      <Outlet />
    </>
  );
}
