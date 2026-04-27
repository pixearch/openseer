export type NavItem = {
  label: string;
  href: string;
  wired?: boolean;
  /** When true, route still exists but the item is omitted from the app sidebar (MVP). */
  hideFromSidebar?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  href: string;
  /** When true, section routes still work but the section is omitted from the app sidebar (MVP). */
  hideFromSidebar?: boolean;
  icon:
    | "home"
    | "workspace"
    | "graphs"
    | "teams"
    | "documents"
    | "activity"
    | "search"
    | "integrations"
    | "admin"
    | "settings";
  items: NavItem[];
  mvpWired: boolean;
};

export const WORKSPACE_CONTEXT_DEFAULT = "Demo Org · Default workspace";

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: "home",
    mvpWired: true,
    items: [
      { label: "Dashboard", href: "/", wired: true },
      { label: "Recent Work", href: "/home/recent", wired: true, hideFromSidebar: true },
      { label: "Favorites", href: "/home/favorites", hideFromSidebar: true },
      { label: "Quick Start", href: "/home/quick-start", wired: true, hideFromSidebar: true },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    href: "/workspace",
    icon: "workspace",
    mvpWired: true,
    items: [
      { label: "My Workspaces", href: "/workspace/my" },
      { label: "Create Workspace", href: "/workspace/new" },
      { label: "All Workspaces", href: "/workspace", hideFromSidebar: true },
      { label: "Shared Workspaces", href: "/workspace/shared", hideFromSidebar: true },
      { label: "Archived Workspaces", href: "/workspace/archived", hideFromSidebar: true },
    ],
  },
  {
    id: "graphs",
    label: "Graphs",
    href: "/graphs",
    icon: "graphs",
    mvpWired: true,
    items: [
      { label: "My Graphs", href: "/graphs/my" },
      { label: "Create New Graph", href: "/workspace/graph", wired: true },
      { label: "Templates", href: "/graphs/templates" },
      { label: "All Graphs", href: "/graphs", wired: true, hideFromSidebar: true },
      { label: "Shared Graphs", href: "/graphs/shared", hideFromSidebar: true },
      { label: "Archived Graphs", href: "/graphs/archived", hideFromSidebar: true },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    href: "/teams",
    icon: "teams",
    hideFromSidebar: true,
    mvpWired: true,
    items: [
      { label: "All Teams", href: "/teams", wired: true },
      { label: "Team Directory", href: "/teams/directory" },
      { label: "Members", href: "/teams/members" },
      { label: "Roles", href: "/teams/roles" },
      { label: "Ownership", href: "/teams/ownership" },
      { label: "Workload", href: "/teams/workload" },
      { label: "Invite Users", href: "/teams/invite" },
      { label: "Permissions Overview", href: "/teams/permissions" },
      { label: "Create Team", href: "/teams/new" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: "documents",
    hideFromSidebar: true,
    mvpWired: true,
    items: [
      { label: "All Documents", href: "/documents", wired: true },
      { label: "My Documents", href: "/documents/mine" },
      { label: "Shared Documents", href: "/documents/shared" },
      { label: "Attached Evidence", href: "/documents/evidence" },
      { label: "Screenshots", href: "/documents/screenshots" },
      { label: "Video References", href: "/documents/videos" },
      { label: "Drafts", href: "/documents/drafts" },
      { label: "Archived Documents", href: "/documents/archived" },
      { label: "Create New Document", href: "/documents/new" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    href: "/activity",
    icon: "activity",
    hideFromSidebar: true,
    mvpWired: false,
    items: [
      { label: "Recent Activity", href: "/activity/recent" },
      { label: "Change History", href: "/activity/history" },
      { label: "Comments", href: "/activity/comments" },
      { label: "Mentions", href: "/activity/mentions" },
      { label: "Approvals", href: "/activity/approvals" },
      { label: "Audit Trail", href: "/activity/audit" },
    ],
  },
  {
    id: "search",
    label: "Search",
    href: "/search",
    icon: "search",
    hideFromSidebar: true,
    mvpWired: false,
    items: [
      { label: "Global Search", href: "/search/global" },
      { label: "Saved Searches", href: "/search/saved" },
      { label: "Advanced Search", href: "/search/advanced" },
      { label: "Tags", href: "/search/tags" },
      { label: "Filters", href: "/search/filters" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: "integrations",
    hideFromSidebar: true,
    mvpWired: false,
    items: [
      { label: "GitHub", href: "/integrations/github" },
      { label: "Vercel", href: "/integrations/vercel" },
      { label: "Storage", href: "/integrations/storage" },
      { label: "Identity Provider", href: "/integrations/identity" },
      { label: "Future Connectors", href: "/integrations/connectors" },
      { label: "API Keys", href: "/integrations/api-keys" },
      { label: "Webhooks", href: "/integrations/webhooks" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: "admin",
    hideFromSidebar: true,
    mvpWired: false,
    items: [
      { label: "Organizations", href: "/admin/organizations" },
      { label: "Workspaces", href: "/admin/workspaces" },
      { label: "User Management", href: "/admin/users" },
      { label: "Role Management", href: "/admin/roles" },
      { label: "Access Policies", href: "/admin/access" },
      { label: "Data Policies", href: "/admin/data" },
      { label: "Usage Metrics", href: "/admin/metrics" },
      { label: "System Health", href: "/admin/health" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: "settings",
    mvpWired: true,
    items: [
      { label: "Profile", href: "/settings/profile", wired: true },
      { label: "Appearance", href: "/settings/appearance" },
      { label: "Workspace Settings", href: "/settings/workspace" },
      { label: "Notifications", href: "/settings/notifications", hideFromSidebar: true },
      { label: "Preferences", href: "/settings/preferences", hideFromSidebar: true },
      { label: "Security Settings", href: "/settings/security", hideFromSidebar: true },
      { label: "Billing", href: "/settings/billing", hideFromSidebar: true },
      { label: "About", href: "/settings/about", hideFromSidebar: true },
    ],
  },
];

export const CREATE_MENU_ITEMS = [
  { label: "New Graph", href: "/workspace/graph" },
  { label: "New Node", href: "/workspace/graph" },
  { label: "New Document", href: "/documents/new" },
  { label: "New Team", href: "/teams/new" },
  { label: "New Workspace", href: "/workspace/new" },
] as const;

export const NAV_SECTION_IDS = new Set(NAV_SECTIONS.map((s) => s.id));
