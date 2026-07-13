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

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, available: true },
  { href: "/torneos", label: "Torneos", icon: Trophy, available: false },
  { href: "/equipos", label: "Equipos", icon: Users, available: false },
  { href: "/partidos", label: "Partidos", icon: Swords, available: false },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, available: false },
  { href: "/disciplina", label: "Disciplina", icon: Shield, available: false },
  { href: "/finanzas", label: "Finanzas", icon: Wallet, available: false },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    available: false,
  },
];

export const MOBILE_PRIMARY_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

export const MOBILE_MORE_NAV_ITEMS = NAV_ITEMS.slice(5);

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
