import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Flagbase
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavLinks />
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 truncate px-3 text-xs text-zinc-400 dark:text-zinc-500">
            {session.user?.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
