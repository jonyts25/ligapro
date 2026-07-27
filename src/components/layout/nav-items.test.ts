import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOrganizationNavItems,
  isActiveRoute,
} from "@/components/layout/nav-items";

const ORG = "org-123";

describe("getOrganizationNavItems", () => {
  it("includes disciplina for all members", () => {
    const items = getOrganizationNavItems(ORG, { canManageSettings: false });
    const disciplina = items.find((item) => item.label === "Disciplina");
    assert.ok(disciplina);
    assert.equal(disciplina.available, true);
    assert.equal(disciplina.href, `/organizaciones/${ORG}/disciplina`);
  });

  it("hides finanzas and configuracion for non-admin members", () => {
    const items = getOrganizationNavItems(ORG, { canManageSettings: false });
    assert.equal(
      items.some((item) => item.label === "Finanzas"),
      false
    );
    assert.equal(
      items.some((item) => item.label === "Configuración"),
      false
    );
  });

  it("includes finanzas hub for admin", () => {
    const items = getOrganizationNavItems(ORG, { canManageSettings: true });
    const finanzas = items.find((item) => item.label === "Finanzas");
    assert.ok(finanzas);
    assert.equal(finanzas.available, true);
    assert.equal(finanzas.href, `/organizaciones/${ORG}/finanzas`);
  });
});

describe("isActiveRoute", () => {
  it("highlights disciplina hub and season disciplina page", () => {
    const href = `/organizaciones/${ORG}/disciplina`;
    assert.equal(isActiveRoute(href, href), true);
    assert.equal(
      isActiveRoute(
        `/organizaciones/${ORG}/torneos/c1/temporadas/s1/disciplina`,
        href
      ),
      true
    );
  });

  it("highlights finanzas hub and season finanzas page", () => {
    const href = `/organizaciones/${ORG}/finanzas`;
    assert.equal(isActiveRoute(href, href), true);
    assert.equal(
      isActiveRoute(
        `/organizaciones/${ORG}/torneos/c1/temporadas/s1/finanzas`,
        href
      ),
      true
    );
  });
});
