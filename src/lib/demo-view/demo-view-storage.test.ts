import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  DEMO_VIEW_STORAGE_KEY,
  readDemoViewFromSessionStorage,
  resolveDemoViewRole,
} from "@/lib/demo-view/demo-view-storage";

function createSessionStorageMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function installSessionStorageMock(initial: Record<string, string> = {}) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: createSessionStorageMock(initial) },
  });
}

describe("demo-view-storage", () => {
  let originalWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("resolveDemoViewRole ignores non-real roles for non-platform-staff", () => {
    assert.equal(resolveDemoViewRole("captain", false), "real");
    assert.equal(resolveDemoViewRole("owner_admin", false), "real");
    assert.equal(resolveDemoViewRole("referee", false), "real");
    assert.equal(resolveDemoViewRole("scorekeeper", false), "real");
    assert.equal(resolveDemoViewRole("invalid", false), "real");
  });

  it("readDemoViewFromSessionStorage ignores tampered values for non-platform-staff", () => {
    installSessionStorageMock({
      [DEMO_VIEW_STORAGE_KEY]: JSON.stringify({
        organizationId: "org-demo",
        viewAsRole: "captain",
      }),
    });

    assert.equal(readDemoViewFromSessionStorage("org-demo", false), "real");
  });

  it("platform_staff can read a stored simulated role for the active organization", () => {
    installSessionStorageMock({
      [DEMO_VIEW_STORAGE_KEY]: JSON.stringify({
        organizationId: "org-demo",
        viewAsRole: "referee",
      }),
    });

    assert.equal(readDemoViewFromSessionStorage("org-demo", true), "referee");
  });

  it("platform_staff ignores stored role from a different organization", () => {
    installSessionStorageMock({
      [DEMO_VIEW_STORAGE_KEY]: JSON.stringify({
        organizationId: "org-other",
        viewAsRole: "captain",
      }),
    });

    assert.equal(readDemoViewFromSessionStorage("org-demo", true), "real");
  });
});
