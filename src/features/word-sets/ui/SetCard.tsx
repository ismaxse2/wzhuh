import { Link, useLocation } from "react-router-dom";

import { SetProgress, type WordSet } from "../../../entities/vocabulary";
export function SetCard({ set }: { set: WordSet }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("set", set.id);
  return (
    <Link
      to={{ pathname: location.pathname, search: `?${params.toString()}` }}
      className="set-card"
      aria-haspopup="dialog"
      preventScrollReset
    >
      <SetProgress set={set} />
      <h3>{set.title}</h3>
      <p>{set.description}</p>
    </Link>
  );
}
