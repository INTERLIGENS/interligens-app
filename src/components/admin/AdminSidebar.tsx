import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Lock,
  Inbox,
  Users,
  Eye,
  Link2,
  Tag,
  Download,
  Bell,
  FolderOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin/intel-vault",   label: "Intel Vault",    icon: Lock       },
  { href: "/admin/intake",        label: "Intake Inbox",   icon: Inbox      },
  { href: "/admin/kol",           label: "KOL Directory",  icon: Users      },
  { href: "/admin/watch-sources", label: "Watch Sources",  icon: Eye        },
  { href: "/admin/corroboration", label: "Corroboration",  icon: Link2      },
  { href: "/admin/labels",        label: "Labels",         icon: Tag        },
  { href: "/admin/export",        label: "Export",         icon: Download   },
]

const CASE_ITEMS = [
  { href: "/admin/cases",         label: "Cases",          icon: FolderOpen },
  { href: "/admin/alerts",        label: "Alerts",         icon: Bell       },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] shrink-0 border-r border-border/40 bg-background flex flex-col py-5 px-2 min-h-screen">
      <div className="px-3 pb-4 mb-2 border-b border-border/40">
        <p className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground mb-0.5">
          Interligens
        </p>
        <p className="text-[15px] font-medium text-foreground">Admin</p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
                active
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                size={15}
                className={cn(
                  "shrink-0",
                  active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/70"
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4">
        <p className="px-3 pt-1 pb-2 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
          Cases
        </p>
        <nav className="flex flex-col gap-0.5">
          {CASE_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
                  active
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  size={15}
                  className={cn(
                    "shrink-0",
                    active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/70"
                  )}
                />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
