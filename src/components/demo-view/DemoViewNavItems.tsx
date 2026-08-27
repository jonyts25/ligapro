"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  getOrganizationNavItems,
  type NavItem,
} from "@/components/layout/nav-items";
import { useDemoView } from "@/lib/demo-view/DemoViewContext";

function filterNavItemsForDemoRole(
  items: NavItem[],
  showMisPartidosNav: boolean
): NavItem[] {
  return items.filter((item) => {
    if (item.href.endsWith("/mis-partidos") && !showMisPartidosNav) {
      return false;
    }
    return true;
  });
}

type DemoViewNavItemsProps = {
  organizationId: string;
  realCanManageSettings: boolean;
  children: (items: NavItem[]) => ReactNode;
};

export function DemoViewNavItems({
  organizationId,
  realCanManageSettings,
  children,
}: DemoViewNavItemsProps) {
  const { getNavOptions, showMisPartidosNav } = useDemoView();
  const navOptions = getNavOptions(realCanManageSettings);
  const items = filterNavItemsForDemoRole(
    getOrganizationNavItems(organizationId, navOptions),
    showMisPartidosNav
  );
  return children(items);
}

type DemoViewMobilePrimaryNavProps = {
  organizationId: string;
  realCanManageSettings: boolean;
  children: (items: NavItem[]) => ReactNode;
};

export function DemoViewMobilePrimaryNav({
  organizationId,
  realCanManageSettings,
  children,
}: DemoViewMobilePrimaryNavProps) {
  const pathname = usePathname();
  const { getNavOptions, showMisPartidosNav } = useDemoView();
  const navOptions = getNavOptions(realCanManageSettings);
  const items = filterNavItemsForDemoRole(
    getOrganizationNavItems(organizationId, navOptions).slice(0, 5),
    showMisPartidosNav
  );
  void pathname;
  return children(items);
}

type DemoViewMobileMoreNavProps = {
  organizationId: string;
  realCanManageSettings: boolean;
  children: (items: NavItem[]) => ReactNode;
};

export function DemoViewMobileMoreNav({
  organizationId,
  realCanManageSettings,
  children,
}: DemoViewMobileMoreNavProps) {
  const { getNavOptions, showMisPartidosNav } = useDemoView();
  const navOptions = getNavOptions(realCanManageSettings);
  const items = filterNavItemsForDemoRole(
    getOrganizationNavItems(organizationId, navOptions).slice(5),
    showMisPartidosNav
  );
  return children(items);
}
