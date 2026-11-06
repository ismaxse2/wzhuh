import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useVocabulary } from "../entities/vocabulary";
export function SessionGate() {
  const { data } = useVocabulary();
  const { pathname } = useLocation();
  if (data.activeSession?.status === "active" && pathname !== "/words/learn")
    return <Navigate to="/words/learn" replace />;
  return <Outlet />;
}
