import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

function useQuery() {
  const { search } = useLocation();

  const [query, setQuery] = useState({});

  useEffect(() => {
    const q = {};

    new URLSearchParams(search).forEach((value, key) => {
      q[key] = value;
    });

    setQuery(q);
  }, [search]);

  return query;
}

export { useQuery };
