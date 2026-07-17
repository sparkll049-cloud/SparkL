// frontend/src/app/dashboard/admin/page.tsx
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  MessageSquare,
  Building2,
  LogOut,
  Menu,
  X,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Crown,
  FileText,
  GraduationCap,
  BookOpen,
  ChevronDown,
  Plus,
  Trash2,
  TrendingUp,
  BadgeCheck,
} from "lucide-react";

// =====================================================================
// TODO: everything below is mock data / local-state mutation. Swap each
// handler for a real fetch to your FastAPI endpoints behind the
// `require-admin` interceptor (Phase 7). Nothing here persists on reload.
// =====================================================================

type UserRole = "student" | "admin";
type UserStatus = "active" | "suspended";

type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  phone_num: string;
  institution: string;
  department: string;
  level: string;
  program_type: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
};

type UploadStatus = "pending" | "verified" | "rejected";

type AdminUpload = {
  id: string;
  file_name: string;
  course_code: string;
  course_title: string;
  department: string;
  level: string;
  semester: string;
  year: string;
  uploaded_by: string;
  status: UploadStatus;
  created_at: string;
};

type SolutionStatus = "pending" | "verified" | "rejected";

type AdminSolution = {
  id: string;
  course_code: string;
  year: string;
  author: string;
  excerpt: string;
  status: SolutionStatus;
  created_at: string;
};

type Course = { id: string; course_code: string; course_title: string; department_id: string };
type Department = { id: string; name: string; institution: string };

const MOCK_USERS: AdminUser[] = [
  { id: "u1", full_name: "Ijeoma Nwachukwu", email: "ijeoma.n@yabatech.edu.ng", phone_num: "080XXXXXXXX", institution: "Yabatech", department: "Computer Science", level: "ND1", program_type: "ND", role: "student", status: "active", created_at: "2026-06-02" },
  { id: "u2", full_name: "Tunde Bakare", email: "tunde.b@yabatech.edu.ng", phone_num: "081XXXXXXXX", institution: "Yabatech", department: "Electrical Engineering", level: "HND1", program_type: "HND", role: "student", status: "active", created_at: "2026-06-10" },
  { id: "u3", full_name: "Chioma Okafor", email: "chioma.o@yabatech.edu.ng", phone_num: "070XXXXXXXX", institution: "Yabatech", department: "Computer Science", level: "ND2", program_type: "ND", role: "admin", status: "active", created_at: "2026-01-14" },
  { id: "u4", full_name: "Femi Adeyemi", email: "femi.a@yabatech.edu.ng", phone_num: "090XXXXXXXX", institution: "Yabatech", department: "Accountancy", level: "HND2", program_type: "HND", role: "student", status: "suspended", created_at: "2026-05-20" },
];

const MOCK_UPLOADS: AdminUpload[] = [
  { id: "p1", file_name: "csc201_2023_exam.pdf", course_code: "CSC201", course_title: "Data Structures", department: "Computer Science", level: "ND1", semester: "First Semester", year: "2023/2024", uploaded_by: "Ijeoma Nwachukwu", status: "pending", created_at: "2026-07-10" },
  { id: "p2", file_name: "eee201_circuit_theory.jpg", course_code: "EEE201", course_title: "Circuit Theory", department: "Electrical Engineering", level: "HND1", semester: "Second Semester", year: "2022/2023", uploaded_by: "Tunde Bakare", status: "pending", created_at: "2026-07-11" },
  { id: "p3", file_name: "csc211_discrete_math.pdf", course_code: "CSC211", course_title: "Discrete Mathematics", department: "Computer Science", level: "ND2", semester: "First Semester", year: "2021/2022", uploaded_by: "Femi Adeyemi", status: "verified", created_at: "2026-06-28" },
  { id: "p4", file_name: "act101_financial_acct.pdf", course_code: "ACT101", course_title: "Financial Accounting", department: "Accountancy", level: "ND1", semester: "First Semester", year: "2023/2024", uploaded_by: "Femi Adeyemi", status: "rejected", created_at: "2026-06-15" },
];

const MOCK_SOLUTIONS: AdminSolution[] = [
  { id: "s1", course_code: "CSC201", year: "2022/2023", author: "Chioma Okafor", excerpt: "Q1 asks for the time complexity of a balanced BST insert...", status: "pending", created_at: "2026-07-09" },
  { id: "s2", course_code: "CSC211", year: "2021/2022", author: "Tunde Bakare", excerpt: "For the induction proof, base case n=1 gives...", status: "pending", created_at: "2026-07-08" },
  { id: "s3", course_code: "CSC201", year: "2020/2021", author: "Ijeoma Nwachukwu", excerpt: "The recurrence relation solves to O(n log n) because...", status: "verified", created_at: "2026-06-20" },
];

const INITIAL_DEPARTMENTS: Department[] = [
  { id: "d1", name: "Computer Science", institution: "Yabatech" },
  { id: "d2", name: "Electrical Engineering", institution: "Yabatech" },
  { id: "d3", name: "Accountancy", institution: "Yabatech" },
  { id: "d4", name: "Mass Communication", institution: "Yabatech" },
];

const INITIAL_COURSES: Course[] = [
  { id: "c1", course_code: "CSC201", course_title: "Data Structures", department_id: "d1" },
  { id: "c2", course_code: "CSC205", course_title: "Computer Architecture", department_id: "d1" },
  { id: "c3", course_code: "CSC211", course_title: "Discrete Mathematics", department_id: "d1" },
  { id: "c4", course_code: "EEE201", course_title: "Circuit Theory", department_id: "d2" },
  { id: "c5", course_code: "ACT101", course_title: "Financial Accounting", department_id: "d3" },
];

type Section = "overview" | "users" | "uploads" | "solutions" | "academic";

const NAV_ITEMS: { key: Section; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "uploads", label: "Past Questions", icon: UploadCloud },
  { key: "solutions", label: "Solutions", icon: MessageSquare },
  { key: "academic", label: "Academic Structure", icon: Building2 },
];

export default function AdminDashboardPage() {
  const [section, setSection] = useState<Section>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [users, setUsers] = useState(MOCK_USERS);
  const [uploads, setUploads] = useState(MOCK_UPLOADS);
  const [solutions, setSolutions] = useState(MOCK_SOLUTIONS);
  const [departments, setDepartments] = useState(INITIAL_DEPARTMENTS);
  const [courses, setCourses] = useState(INITIAL_COURSES);

  const pendingUploads = uploads.filter((u) => u.status === "pending").length;
  const pendingSolutions = solutions.filter((s) => s.status === "pending").length;

  const toggleUserStatus = (id: string) => {
    // TODO: PATCH /api/admin/users/{id}/status
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u));
  };

  const toggleUserRole = (id: string) => {
    // TODO: PATCH /api/admin/users/{id}/role — guard this behind a confirm dialog in production
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: u.role === "admin" ? "student" : "admin" } : u));
  };

  const setUploadStatus = (id: string, status: UploadStatus) => {
    // TODO: PATCH /api/admin/uploads/{id}/status
    setUploads((prev) => prev.map((u) => u.id === id ? { ...u, status } : u));
  };

  const setSolutionStatus = (id: string, status: SolutionStatus) => {
    // TODO: PATCH /api/admin/solutions/{id}/status
    setSolutions((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  };

  const addDepartment = (name: string) => {
    // TODO: POST /api/admin/departments
    setDepartments((prev) => [...prev, { id: `d${Date.now()}`, name, institution: "Yabatech" }]);
  };

  const removeDepartment = (id: string) => {
    // TODO: DELETE /api/admin/departments/{id} — should also cascade-check for existing courses
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    setCourses((prev) => prev.filter((c) => c.department_id !== id));
  };

  const addCourse = (departmentId: string, code: string, title: string) => {
    // TODO: POST /api/admin/courses
    setCourses((prev) => [...prev, { id: `c${Date.now()}`, course_code: code, course_title: title, department_id: departmentId }]);
  };

  const removeCourse = (id: string) => {
    // TODO: DELETE /api/admin/courses/{id}
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-100 bg-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
          <Image src="/images/logo.jpg" alt="SparkL" width={44} height={44} priority className="object-contain" />
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">ADMIN</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              active={section === item.key}
              onClick={() => setSection(item.key)}
              icon={item.icon}
              label={item.label}
              badge={
                item.key === "uploads" ? pendingUploads :
                item.key === "solutions" ? pendingSolutions : undefined
              }
            />
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/images/logo.jpg" alt="SparkL" width={32} height={32} priority className="object-contain" />
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">ADMIN</span>
        </div>
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ---------------- Mobile drawer ---------------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <Image src="/images/logo.jpg" alt="SparkL" width={32} height={32} priority className="object-contain" />
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-4">
              {NAV_ITEMS.map((item) => (
                <NavButton
                  key={item.key}
                  active={section === item.key}
                  onClick={() => { setSection(item.key); setMenuOpen(false); }}
                  icon={item.icon}
                  label={item.label}
                  badge={
                    item.key === "uploads" ? pendingUploads :
                    item.key === "solutions" ? pendingSolutions : undefined
                  }
                />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ---------------- Main content ---------------- */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {section === "overview" && (
            <OverviewSection users={users} uploads={uploads} solutions={solutions} departments={departments} />
          )}
          {section === "users" && (
            <UsersSection users={users} onToggleStatus={toggleUserStatus} onToggleRole={toggleUserRole} />
          )}
          {section === "uploads" && (
            <UploadsSection uploads={uploads} onSetStatus={setUploadStatus} />
          )}
          {section === "solutions" && (
            <SolutionsSection solutions={solutions} onSetStatus={setSolutionStatus} />
          )}
          {section === "academic" && (
            <AcademicSection
              departments={departments}
              courses={courses}
              onAddDepartment={addDepartment}
              onRemoveDepartment={removeDepartment}
              onAddCourse={addCourse}
              onRemoveCourse={removeCourse}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Sidebar nav button
// ============================================================
function NavButton({
  active, onClick, icon: Icon, label, badge,
}: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================
// Overview
// ============================================================
function OverviewSection({
  users, uploads, solutions, departments,
}: { users: AdminUser[]; uploads: AdminUpload[]; solutions: AdminSolution[]; departments: Department[] }) {
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "active").length,
    totalUploads: uploads.length,
    pendingUploads: uploads.filter((u) => u.status === "pending").length,
    pendingSolutions: solutions.filter((s) => s.status === "pending").length,
    departments: departments.length,
  };

  const uploadsByDept = useMemo(() => {
    const map = new Map<string, number>();
    uploads.forEach((u) => map.set(u.department, (map.get(u.department) || 0) + 1));
    const max = Math.max(...Array.from(map.values()), 1);
    return Array.from(map.entries()).map(([dept, count]) => ({ dept, count, pct: (count / max) * 100 }));
  }, [uploads]);

  const recentActivity = useMemo(() => {
    const events = [
      ...uploads.map((u) => ({ id: u.id, text: `${u.uploaded_by} uploaded ${u.course_code} (${u.year})`, time: u.created_at, type: "upload" as const })),
      ...solutions.map((s) => ({ id: s.id, text: `${s.author} posted a solution for ${s.course_code}`, time: s.created_at, type: "solution" as const })),
      ...users.map((u) => ({ id: u.id, text: `${u.full_name} registered`, time: u.created_at, type: "user" as const })),
    ];
    return events.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 6);
  }, [uploads, solutions, users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Everything happening across SparkL, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total users" value={stats.totalUsers} sub={`${stats.activeUsers} active`} />
        <StatCard icon={<UploadCloud className="h-5 w-5" />} label="Pending uploads" value={stats.pendingUploads} tone="warning" />
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Pending solutions" value={stats.pendingSolutions} tone="warning" />
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Departments" value={stats.departments} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Uploads by department */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Uploads by department</h3>
          </div>
          <div className="space-y-3">
            {uploadsByDept.map((row) => (
              <div key={row.dept}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{row.dept}</span>
                  <span className="font-medium text-slate-400">{row.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent activity</h3>
          <div className="space-y-3">
            {recentActivity.map((e) => (
              <div key={`${e.type}-${e.id}`} className="flex items-start gap-2.5">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  e.type === "upload" ? "bg-blue-100 text-blue-600" :
                  e.type === "solution" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {e.type === "upload" ? <FileText className="h-3 w-3" /> : e.type === "solution" ? <MessageSquare className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-700">{e.text}</p>
                  <p className="text-[11px] text-slate-400">{e.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, tone = "default",
}: { icon: React.ReactNode; label: string; value: number; sub?: string; tone?: "default" | "warning" }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tone === "warning" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ============================================================
// Users
// ============================================================
function UsersSection({
  users, onToggleStatus, onToggleRole,
}: { users: AdminUser[]; onToggleStatus: (id: string) => void; onToggleRole: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const filtered = users.filter((u) => {
    const matchesQuery = u.full_name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Everyone registered on SparkL.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "student", "admin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  roleFilter === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No users match this search.</p>}
          {filtered.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{u.full_name}</p>
                  {u.role === "admin" && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      <Crown className="h-2.5 w-2.5" />
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {u.department} · {u.program_type} {u.level} · joined {u.created_at}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {u.status === "active" ? "Active" : "Suspended"}
                </span>
                <button
                  onClick={() => onToggleRole(u.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {u.role === "admin" ? "Demote" : "Make admin"}
                </button>
                <button
                  onClick={() => onToggleStatus(u.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    u.status === "active" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {u.status === "active" ? <><ShieldAlert className="h-3.5 w-3.5" />Suspend</> : <><ShieldCheck className="h-3.5 w-3.5" />Reactivate</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Uploads (past questions)
// ============================================================
function UploadsSection({
  uploads, onSetStatus,
}: { uploads: AdminUpload[]; onSetStatus: (id: string, status: UploadStatus) => void }) {
  const [filter, setFilter] = useState<"all" | UploadStatus>("pending");
  const filtered = uploads.filter((u) => filter === "all" || u.status === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Past questions</h1>
        <p className="mt-1 text-sm text-slate-500">Review uploads before students can see them.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["pending", "verified", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              filter === f ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Nothing here right now.</p>
        )}
        {filtered.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{u.course_code} — {u.course_title}</p>
                <p className="truncate text-xs text-slate-400">{u.file_name}</p>
                <p className="mt-1 text-xs text-slate-500">{u.department} · {u.level} · {u.semester} · {u.year}</p>
                <p className="mt-0.5 text-xs text-slate-400">uploaded by {u.uploaded_by} on {u.created_at}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={u.status} />
              {u.status === "pending" && (
                <>
                  <button onClick={() => onSetStatus(u.id, "verified")} className="flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50">
                    <CheckCircle2 className="h-3.5 w-3.5" />Approve
                  </button>
                  <button onClick={() => onSetStatus(u.id, "rejected")} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" />Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const map = {
    pending: { cls: "bg-amber-100 text-amber-700", label: "Pending" },
    verified: { cls: "bg-green-100 text-green-700", label: "Verified" },
    rejected: { cls: "bg-red-100 text-red-700", label: "Rejected" },
  };
  const { cls, label } = map[status];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

// ============================================================
// Solutions
// ============================================================
function SolutionsSection({
  solutions, onSetStatus,
}: { solutions: AdminSolution[]; onSetStatus: (id: string, status: SolutionStatus) => void }) {
  const [filter, setFilter] = useState<"all" | SolutionStatus>("pending");
  const filtered = solutions.filter((s) => filter === "all" || s.status === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Solutions</h1>
        <p className="mt-1 text-sm text-slate-500">Verify student-submitted answers before they show as trusted.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["pending", "verified", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              filter === f ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Nothing here right now.</p>
        )}
        {filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{s.course_code} · {s.year}</p>
                  {s.status === "verified" && <BadgeCheck className="h-3.5 w-3.5 text-green-600" />}
                </div>
                <p className="text-xs text-slate-400">by {s.author} on {s.created_at}</p>
              </div>
              <SolutionStatusBadge status={s.status} />
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              {s.excerpt}
            </p>
            {s.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => onSetStatus(s.id, "verified")} className="flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" />Verify
                </button>
                <button onClick={() => onSetStatus(s.id, "rejected")} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  <XCircle className="h-3.5 w-3.5" />Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SolutionStatusBadge({ status }: { status: SolutionStatus }) {
  const map = {
    pending: { cls: "bg-amber-100 text-amber-700", label: "Pending" },
    verified: { cls: "bg-green-100 text-green-700", label: "Verified" },
    rejected: { cls: "bg-red-100 text-red-700", label: "Rejected" },
  };
  const { cls, label } = map[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

// ============================================================
// Academic structure
// ============================================================
function AcademicSection({
  departments, courses, onAddDepartment, onRemoveDepartment, onAddCourse, onRemoveCourse,
}: {
  departments: Department[];
  courses: Course[];
  onAddDepartment: (name: string) => void;
  onRemoveDepartment: (id: string) => void;
  onAddCourse: (departmentId: string, code: string, title: string) => void;
  onRemoveCourse: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newDept, setNewDept] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");

  const handleAddDept = () => {
    if (!newDept.trim()) return;
    onAddDepartment(newDept.trim());
    setNewDept("");
  };

  const handleAddCourse = (deptId: string) => {
    if (!newCourseCode.trim() || !newCourseTitle.trim()) return;
    onAddCourse(deptId, newCourseCode.trim().toUpperCase(), newCourseTitle.trim());
    setNewCourseCode("");
    setNewCourseTitle("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic structure</h1>
        <p className="mt-1 text-sm text-slate-500">Departments and the courses under each.</p>
      </div>

      {/* Add department */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row">
        <input
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          placeholder="New department name"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          onClick={handleAddDept}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add department
        </button>
      </div>

      <div className="space-y-3">
        {departments.map((d) => {
          const deptCourses = courses.filter((c) => c.department_id === d.id);
          const isExpanded = expanded === d.id;
          return (
            <div key={d.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between p-4">
                <button onClick={() => setExpanded(isExpanded ? null : d.id)} className="flex flex-1 items-center gap-3 text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.institution} · {deptCourses.length} courses</p>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRemoveDepartment(d.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${d.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronDown
                    onClick={() => setExpanded(isExpanded ? null : d.id)}
                    className={`h-4 w-4 cursor-pointer text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="space-y-2">
                    {deptCourses.length === 0 && (
                      <p className="text-xs text-slate-400">No courses yet.</p>
                    )}
                    {deptCourses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-xs font-medium text-slate-700">{c.course_code}</span>
                          <span className="text-xs text-slate-400">{c.course_title}</span>
                        </div>
                        <button onClick={() => onRemoveCourse(c.id)} className="rounded p-1 text-slate-300 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add course */}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      placeholder="Code e.g. CSC201"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-32"
                    />
                    <input
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      placeholder="Course title"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      onClick={() => handleAddCourse(d.id)}
                      className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}