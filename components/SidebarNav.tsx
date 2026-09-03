'use client';
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
function NavItem({
  icon,
  label,
  href,
  active = false,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  count?: string;
}) {
  const btn = (
    <span
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'}`}
    >
      <span className="[&>svg]:size-[18px]">{icon}</span>
      <span>{label}</span>
      {count && (
        <Badge className="ml-auto" variant="secondary">
          {count}
        </Badge>
      )}
    </span>
  );
  return href ? (
    <Link href={href} className="block">
      {btn}
    </Link>
  ) : (
    <span className="block cursor-pointer">{btn}</span>
  );
}
export function SidebarNav({
  active,
}: {
  active?: '/' | '/customers';
}) {
  return (
    <aside className="hidden border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-3 pb-7">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <p className="font-semibold leading-5">ATLAS</p>
          <p className="text-xs text-muted-foreground">Staff Backoffice</p>
        </div>
      </div>
      <nav aria-label="Primary" className="space-y-1 text-sm">
        <NavItem
          href="/"
          icon={<LayoutDashboard />}
          label="Overview"
          active={active === '/'}
        />
        <NavItem
          href="/customers"
          icon={<Building2 />}
          label="Customers"
          active={active === '/customers'}
        />
        <NavItem icon={<Users />} label="Provisioning" count="2" />
        <NavItem icon={<Activity />} label="Operations" />
      </nav>
      <div className="mt-auto space-y-1 border-t pt-4 text-sm">
        <NavItem icon={<LifeBuoy />} label="Support" />
        <NavItem icon={<Settings />} label="Settings" />
      </div>
    </aside>
  );
}
