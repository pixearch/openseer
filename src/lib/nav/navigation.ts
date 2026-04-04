export type NavItem = {
  label: string;
  href: string;
  /** MVP: section receives fuller treatment in UI */
  wired?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  href: string;
  icon: "home" | "workspace" | "graphs" | "projects" | "knowledge" | "teams" | "documents" | "proposals" | "financials" | "risks" | "activity" | "search" | "integrations" | "admin" | "settings";
  items: NavItem[];
  /** Priority sections for MVP wiring */
  mvpWired: boolean;
};

export const WORKSPACE_CONTEXT_DEFAULT = "Demo Org · Default workspace";

/** Primary rail: full enterprise structure per product spec */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: "home",
    mvpWired: true,
    items: [
      { label: "Dashboard", href: "/", wired: true },
      { label: "Recent Work", href: "/home/recent", wired: true },
      { label: "Favorites", href: "/home/favorites" },
      { label: "Assigned To Me", href: "/home/assigned" },
      { label: "Notifications", href: "/home/notifications" },
      { label: "Quick Start", href: "/home/quick-start", wired: true },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    href: "/workspace",
    icon: "workspace",
    mvpWired: true,
    items: [
      { label: "All Workspaces", href: "/workspace" },
      { label: "Current Workspace", href: "/workspace/graph", wired: true },
      { label: "Create Workspace", href: "/workspace/new" },
      { label: "Shared Workspaces", href: "/workspace/shared" },
      { label: "Archived Workspaces", href: "/workspace/archived" },
    ],
  },
  {
    id: "graphs",
    label: "Graphs",
    href: "/graphs",
    icon: "graphs",
    mvpWired: true,
    items: [
      { label: "All Graphs", href: "/graphs", wired: true },
      { label: "My Graphs", href: "/graphs/my" },
      { label: "Shared Graphs", href: "/graphs/shared" },
      { label: "Templates", href: "/graphs/templates" },
      { label: "Create New Graph", href: "/workspace/graph", wired: true },
      { label: "Archived Graphs", href: "/graphs/archived" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    href: "/projects",
    icon: "projects",
    mvpWired: true,
    items: [
      { label: "Portfolio", href: "/projects" },
      { label: "Programs", href: "/projects/programs" },
      { label: "Projects", href: "/projects/list", wired: true },
      { label: "Epics", href: "/projects/epics" },
      { label: "Sprints", href: "/projects/sprints" },
      { label: "Tasks", href: "/projects/tasks" },
      { label: "Milestones", href: "/projects/milestones" },
      { label: "Roadmaps", href: "/projects/roadmaps" },
      { label: "Create New Project", href: "/projects/new" },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    href: "/knowledge",
    icon: "knowledge",
    mvpWired: true,
    items: [
      { label: "How-To Guides", href: "/knowledge/how-tos", wired: true },
      { label: "Procedures", href: "/knowledge/procedures" },
      { label: "Training", href: "/knowledge/training" },
      { label: "Playbooks", href: "/knowledge/playbooks" },
      { label: "Best Practices", href: "/knowledge/best-practices" },
      { label: "FAQs", href: "/knowledge/faqs" },
      { label: "Templates", href: "/knowledge/templates" },
      { label: "Create New Guide", href: "/knowledge/new" },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    href: "/teams",
    icon: "teams",
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
    id: "proposals",
    label: "Proposals",
    href: "/proposals",
    icon: "proposals",
    mvpWired: true,
    items: [
      { label: "All Proposals", href: "/proposals", wired: true },
      { label: "Draft Proposals", href: "/proposals/drafts" },
      { label: "Approved Proposals", href: "/proposals/approved" },
      { label: "Business Cases", href: "/proposals/business-cases" },
      { label: "Executive Summaries", href: "/proposals/executive" },
      { label: "Decisions", href: "/proposals/decisions" },
      { label: "Create New Proposal", href: "/proposals/new" },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    href: "/financials",
    icon: "financials",
    mvpWired: false,
    items: [
      { label: "Cost Items", href: "/financials/costs" },
      { label: "Budgets", href: "/financials/budgets" },
      { label: "Estimated vs Actual", href: "/financials/estimate-actual" },
      { label: "Benefit Tracking", href: "/financials/benefits" },
      { label: "ROI", href: "/financials/roi" },
      { label: "Cost Benefit Analysis", href: "/financials/cba" },
      { label: "Financial Summaries", href: "/financials/summaries" },
    ],
  },
  {
    id: "risks",
    label: "Risks and Governance",
    href: "/risks",
    icon: "risks",
    mvpWired: false,
    items: [
      { label: "Risks", href: "/risks/risks" },
      { label: "Controls", href: "/risks/controls" },
      { label: "POA&M", href: "/risks/poam" },
      { label: "Decisions", href: "/risks/decisions" },
      { label: "Audit Findings", href: "/risks/audit" },
      { label: "Compliance Mapping", href: "/risks/compliance" },
      { label: "Governance Reviews", href: "/risks/reviews" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    href: "/activity",
    icon: "activity",
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
      { label: "Notifications", href: "/settings/notifications" },
      { label: "Preferences", href: "/settings/preferences" },
      { label: "Workspace Settings", href: "/settings/workspace" },
      { label: "Security Settings", href: "/settings/security" },
      { label: "Billing", href: "/settings/billing" },
      { label: "About", href: "/settings/about" },
    ],
  },
];

export const CREATE_MENU_ITEMS = [
  { label: "New Graph", href: "/workspace/graph" },
  { label: "New Node", href: "/workspace/graph" },
  { label: "New Project", href: "/projects/new" },
  { label: "New Task", href: "/projects/tasks" },
  { label: "New How-To Guide", href: "/knowledge/new" },
  { label: "New Document", href: "/documents/new" },
  { label: "New Proposal", href: "/proposals/new" },
  { label: "New Risk", href: "/risks/risks" },
  { label: "New Cost Item", href: "/financials/costs" },
  { label: "New Team", href: "/teams/new" },
  { label: "New Workspace", href: "/workspace/new" },
] as const;

export const NAV_SECTION_IDS = new Set(NAV_SECTIONS.map((s) => s.id));
