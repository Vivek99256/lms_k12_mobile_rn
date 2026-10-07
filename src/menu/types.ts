/** What GET /api/mobile/bootstrap returns (data). */
export interface BootstrapData {
  user: {
    id: number;
    sub_institute_id: number;
    user_profile_id: number;
    user_profile_name: string;
    is_student: boolean;
    is_admin: number;
    school_name: string;
  };
  menu: BootstrapSection[];
}

export interface BootstrapSection {
  main_title: string;
  menu_type?: string | null;
  color?: string | null;
  background_image?: string | null;
  contents: BootstrapTile[];
}

export interface BootstrapTile {
  title: string;
  icon?: string | null;
  api?: string | null;
  api_param?: string | null;
  screen_name?: string | null;
  render_type?: string | null;
  web_url?: string | null;
  open_mode?: string | null;
}

export type RenderType = 'native' | 'webview' | 'native_dynamic';

/** A menu entry the backend says this user may open. */
export interface MenuTile {
  /** Stable id: the only thing a route needs to carry. Also what the guard checks. */
  key: string;
  title: string;
  section: string;
  icon: string | null;
  api: string | null;
  apiParam: string | null;
  screenName: string | null;
  renderType: RenderType;
  webUrl: string | null;
  openMode: 'in_app' | 'external';
}

export interface MenuSection {
  title: string;
  color: string | null;
  tiles: MenuTile[];
}

export interface MenuModel {
  sections: MenuSection[];
  tiles: Map<string, MenuTile>;
}
