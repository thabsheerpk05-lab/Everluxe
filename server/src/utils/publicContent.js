export const PUBLIC_STATUS = "PUBLISHED";

export function publishedWhere(extra = {}) {
  return { ...extra, status: PUBLIC_STATUS };
}
