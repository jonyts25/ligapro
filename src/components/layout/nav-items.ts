import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Home,
  MapPin,
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
  { slug: "sedes", label: "Sedes", icon: MapPin, available: true },
  { slug: "torneos", label: "Torneos", icon: Trophy, available: true },
  { slug: "equipos", label: "Equipos", icon: Users, available: true },
  { slug: "partidos", label: "Partidos", icon: Swords, available: true },
  {
    slug: "calendario",
    label: "Calendario",
    icon: CalendarDays,
    available: true,
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

export type OrganizationNavOptions = {
  canManageSettings?: boolean;
};

export function getOrganizationNavItems(
  organizationId: string,
  options: OrganizationNavOptions = {}
): NavItem[] {
  const { canManageSettings = false } = options;

  return MODULES.flatMap((module) => {
    if (module.slug === "configuracion") {
      if (!canManageSettings) return [];
      return [
        {
          href: `/organizaciones/${organizationId}/${module.slug}`,
          label: module.label,
          icon: module.icon,
          available: true,
        },
      ];
    }

    return [
      {
        href: `/organizaciones/${organizationId}/${module.slug}`,
        label: module.label,
        icon: module.icon,
        available: module.available,
      },
    ];
  });
}

export function getMobilePrimaryNavItems(
  organizationId: string,
  options: OrganizationNavOptions = {}
): NavItem[] {
  return getOrganizationNavItems(organizationId, options).slice(0, 5);
}

export function getMobileMoreNavItems(
  organizationId: string,
  options: OrganizationNavOptions = {}
): NavItem[] {
  return getOrganizationNavItems(organizationId, options).slice(5);
}

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href.endsWith("/inicio")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
