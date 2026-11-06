import { Navigate, useParams } from "react-router-dom";
export function SetRouteRedirect() {
  const { id } = useParams();
  return <Navigate to={`/words?set=${encodeURIComponent(id ?? "")}`} replace />;
}
