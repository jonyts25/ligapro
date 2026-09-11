import type { LucideIcon } from "lucide-react";
import {
  buildOrganizationScopedHref,
  type OrganizationScopedSection,
} from "@/lib/organizations/season-picker";
import {
  CalendarDays,
  ClipboardList,
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
  {
    slug: "mis-partidos",
    label: "Mis partidos",
    icon: ClipboardList,
    available: true,
  },
  { slug: "canchas", label: "Canchas", icon: MapPin, available: true },
  { slug: "torneos", label: "Torneos", icon: Trophy, available: true },
  { slug: "equipos", label: "Equipos", icon: Users, available: true },
  { slug: "partidos", label: "Partidos", icon: Swords, available: true },
  {
    slug: "calendario",
    label: "Calendario",
    icon: CalendarDays,
    available: true,
  },
  { slug: "disciplina", label: "Disciplina", icon: Shield, available: true },
  { slug: "finanzas", label: "Finanzas", icon: Wallet, available: true },
  {
    slug: "configuracion",
    label: "Configuración",
    icon: Settings,
    available: false,
  },
];

export type OrganizationNavOptions = {
  canManageSettings?: boolean;
  activeSeasonContext?: {
    seasonId: string;
    competitionId: string;
  } | null;
};

export function getOrganizationNavItems(
  organizationId: string,
  options: OrganizationNavOptions = {}
): NavItem[] {
  const { canManageSettings = false, activeSeasonContext = null } = options;

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

    if (module.slug === "finanzas") {
      if (!canManageSettings) return [];
    }

    const scopedSections: OrganizationScopedSection[] = [
      "equipos",
      "partidos",
      "calendario",
      "finanzas",
      "disciplina",
    ];
    const href = scopedSections.includes(module.slug as OrganizationScopedSection)
      ? buildOrganizationScopedHref(
          organizationId,
          module.slug as OrganizationScopedSection,
          activeSeasonContext
        )
      : `/organizaciones/${organizationId}/${module.slug}`;

    return [
      {
        href,
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
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return true;
  }

  if (href.endsWith("/canchas")) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    if (pathname.includes("/sedes")) return true;
  }

  // Org hub links to season-scoped pages.
  for (const segment of [
    "disciplina",
    "finanzas",
    "calendario",
    "partidos",
  ] as const) {
    if (!href.endsWith(`/${segment}`)) continue;
    const orgBase = href.slice(0, -(segment.length + 1));
    if (!pathname.startsWith(`${orgBase}/`)) continue;
    if (pathname.includes("/temporadas/") && pathname.endsWith(`/${segment}`)) {
      return true;
    }
  }

  return false;
}
