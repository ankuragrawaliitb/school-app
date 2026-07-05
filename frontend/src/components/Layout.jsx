import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutGrid,
  Users as UsersIcon,
  GraduationCap,
  Receipt,
  FileText,
  Wallet,
  Percent,
  Building2,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  School,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, resource: null, end: true },
  { to: "/classes", label: "Classes", icon: Building2, resource: "classes" },
  { to: "/students", label: "Students", icon: GraduationCap, resource: "students" },
  { to: "/fee-components", label: "Fee Structure", icon: Wallet, resource: "fee_components" },
  { to: "/discounts", label: "Discounts", icon: Percent, resource: "discounts" },
  { to: "/invoices", label: "Invoices", icon: FileText, resource: "invoices" },
  { to: "/receipts", label: "Receipts", icon: Receipt, resource: "payments" },
  { to: "/users", label: "Users", icon: UsersIcon, resource: "users" },
  { to: "/permissions", label: "Permissions", icon: ShieldCheck, resource: "users", adminOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, resource: "settings" },
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleBadge = {
    admin: "bg-[#002FA7] text-white",
    principal: "bg-zinc-900 text-white",
    staff: "bg-zinc-200 text-zinc-900",
  }[user?.role] || "bg-zinc-200 text-zinc-900";

  const currentTitle =
    NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== "/"))?.label ||
    "Overview";

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-white text-[#0A0A0A]">
      {/* Sidebar */}
      <aside className="border-r border-zinc-200 h-screen sticky top-0 flex flex-col" data-testid="sidebar">
        <div className="px-5 h-16 flex items-center border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#002FA7] text-white rounded-sm flex items-center justify-center">
              <School size={18} strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-[15px]">Scholaris</div>
              <div className="overline text-[9px] tracking-[0.2em]">School ERP</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => {
            if (item.adminOnly && user?.role !== "admin") return null;
            if (item.resource && !can(item.resource, "view")) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
                    isActive
                      ? "border-[#002FA7] bg-zinc-50 text-[#0A0A0A] font-medium"
                      : "border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                  }`
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-sm bg-zinc-900 text-white grid place-items-center text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${roleBadge}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            data-testid="logout-btn"
            className="w-full flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-sm py-2 hover:bg-zinc-50 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex flex-col">
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 bg-white z-10">
          <div>
            <div className="overline">Console</div>
            <h1 className="font-display text-xl font-semibold leading-tight" data-testid="page-title">
              {currentTitle}
            </h1>
          </div>
          <div className="text-xs text-zinc-500 num">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </header>
        <main className="flex-1 p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
