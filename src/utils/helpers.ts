/** Same role routing the web and Flutter apps use. */
export function dashboardEndpoint(roleName: string): string {
  const r = roleName.trim().toLowerCase();
  if (r === 'student') return 'student-dashboard/summary';
  if (r === 'teacher') return 'teacher-dashboard/summary';
  return 'admin-dashboard/summary';
}

/** `sub_title_api_param` is stored as JSON or as a query string; accept both. */
export function parseApiParam(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
    }
  } catch {
    // not JSON; fall through to query-string parsing
  }
  return Object.fromEntries(new URLSearchParams(raw.replace(/^\?/, '')).entries());
}
