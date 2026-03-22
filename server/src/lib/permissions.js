export function parsePermissions(raw) {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const perms = parsePermissions(user.permissions);
  return Boolean(perms[key]);
}

export function getAmeerContext(user) {
  const perms = parsePermissions(user?.permissions);
  if (perms.is_ameer && perms.ameer_id) {
    return Number(perms.ameer_id);
  }
  return null;
}
