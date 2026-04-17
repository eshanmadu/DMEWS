/** Format a city row from /locations/sri-lanka/cities for display & matching. */
export function formatLkCityLabel(c) {
  if (!c) return "";
  const main = (c.name_en || "").trim();
  const sub = (c.sub_name_en || "").trim();
  if (!main) return "";
  return sub ? `${main} (${sub})` : main;
}
