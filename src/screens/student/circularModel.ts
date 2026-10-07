import { resolveUrl } from '../../api/url';
import { isSafeHttpUrl } from '../../utils/links';

/**
 * The URL to open for a circular's attachment, or null (then no button is shown).
 * The server builds `file_name` as an absolute URL from its own host name. It is opened only if that host
 * is an ERP host the app trusts (`resolveUrl`, F1): production file links are then re-based onto the
 * configured API host, so a dev build never opens production files; any other host is refused.
 * No token is attached - storage files are public.
 */
export function safeAttachmentUrl(raw: string): string | null {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const resolved = resolveUrl(url);
    return isSafeHttpUrl(resolved) ? resolved : null;
  } catch {
    return null;
  }
}
