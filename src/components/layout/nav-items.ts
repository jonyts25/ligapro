import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Home,
  Settings,
  Shield,
  Swords,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When false, item is shown as "Próximamente" without navigation. */
  available: boolean;
};

const MODULES: Array<{
  slug: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
}> = [
  { slug: "inicio", label: "Inicio", icon: Home, available: true },
  { slug: "torneos", label: "Torneos", icon: Trophy, available: false },
  { slug: "equipos", label: "Equipos", icon: Users, available: false },
  { slug: "partidos", label: "Partidos", icon: Swords, available: false },
  {
    slug: "calendario",
    label: "Calendario",
    icon: CalendarDays,
    available: false,
  },
  { slug: "disciplina", label: "Disciplina", icon: Shield, available: false },
  { slug: "finanzas", label: "Finanzas", icon: Wallet, available: false },
  {
    slug: "configuracion",
    label: "Configuración",
    icon: Settings,
    available: false,
  },
];

export function getOrganizationNavItems(organizationId: string): NavItem[] {
  return MODULES.map((module) => ({
    href: `/organizaciones/${organizationId}/${module.slug}`,
    label: module.label,
    icon: module.icon,
    available: module.available,
  }));
}

export function getMobilePrimaryNavItems(organizationId: string): NavItem[] {
  return getOrganizationNavItems(organizationId).slice(0, 5);
}

export function getMobileMoreNavItems(organizationId: string): NavItem[] {
  return getOrganizationNavItems(organizationId).slice(5);
}

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href.endsWith("/inicio")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
