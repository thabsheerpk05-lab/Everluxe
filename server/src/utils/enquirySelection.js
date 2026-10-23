export function normalizeSelectionIds(...groups) {
  return [...new Set(groups.flatMap((group) => Array.isArray(group) ? group : []).map(Number).filter(Number.isInteger))];
}

export function allSelectionsPublished(requestedIds, records) {
  return requestedIds.length === records.length && records.every((record) => record.status === "PUBLISHED" && record.availability === "AVAILABLE");
}
