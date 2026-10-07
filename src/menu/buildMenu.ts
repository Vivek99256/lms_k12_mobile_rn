import { BootstrapSection, MenuModel, MenuSection, MenuTile, RenderType } from './types';

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const asRender = (v: string | null | undefined): RenderType =>
  v === 'webview' || v === 'native_dynamic' ? v : 'native';

/**
 * Turns the backend's menu into the model the navigator uses. Pure, so it is unit-tested.
 * Keys are `section/title` (plus a counter for duplicates) so they survive a refresh.
 */
export function buildMenu(sections: BootstrapSection[]): MenuModel {
  const tiles = new Map<string, MenuTile>();
  const out: MenuSection[] = [];
  const byTitle = new Map<string, MenuSection>();
  // The legacy homescreen endpoints repeat a section (with all its tiles) when its rows are
  // not adjacent, so identical tiles are dropped and same-titled sections are merged.
  const seen = new Set<string>();

  for (const s of sections) {
    const list: MenuTile[] = [];
    for (const c of s.contents ?? []) {
      const identity = [s.main_title, c.title, c.screen_name, c.api, c.web_url].join('|');
      if (seen.has(identity)) continue;
      seen.add(identity);

      const base = `${slug(s.main_title)}/${slug(c.title || c.screen_name || c.api || 'item')}`;
      let key = base;
      for (let n = 2; tiles.has(key); n++) key = `${base}-${n}`;

      const tile: MenuTile = {
        key,
        title: c.title || s.main_title,
        section: s.main_title,
        icon: c.icon ?? null,
        api: c.api?.trim() || null,
        apiParam: c.api_param?.trim() || null,
        screenName: c.screen_name?.trim() || null,
        renderType: asRender(c.render_type),
        webUrl: c.web_url?.trim() || null,
        openMode: c.open_mode === 'external' ? 'external' : 'in_app',
      };
      tiles.set(key, tile);
      list.push(tile);
    }
    if (!list.length) continue;
    const existing = byTitle.get(s.main_title);
    if (existing) {
      existing.tiles.push(...list);
    } else {
      const section = { title: s.main_title, color: s.color ?? null, tiles: list };
      byTitle.set(s.main_title, section);
      out.push(section);
    }
  }
  return { sections: out, tiles };
}

/**
 * The legacy /api/homescreen and /teacher_homescreen shape, used only while a backend
 * without /api/mobile/bootstrap is deployed. Banner sections carry no tiles and are skipped.
 */
export interface LegacySection {
  main_title: string;
  menu_type?: string;
  main_itle_color?: string | null;
  contents?: {
    sub_title: string;
    sub_title_icon?: string | null;
    sub_title_api?: string | null;
    sub_title_api_param?: string | null;
    screen_name?: string | null;
    render_type?: string | null;
    web_url?: string | null;
    open_mode?: string | null;
  }[];
}

export function fromLegacy(sections: LegacySection[]): BootstrapSection[] {
  return sections
    .filter((s) => Array.isArray(s.contents))
    .map((s) => ({
      main_title: s.main_title,
      menu_type: s.menu_type,
      color: s.main_itle_color ?? null,
      contents: (s.contents ?? []).map((c) => ({
        title: c.sub_title,
        icon: c.sub_title_icon,
        api: c.sub_title_api,
        api_param: c.sub_title_api_param,
        screen_name: c.screen_name,
        render_type: c.render_type,
        web_url: c.web_url,
        open_mode: c.open_mode,
      })),
    }));
}
