import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOverpaymentWarning,
  computeTeamBalance,
} from "@/lib/finance/balance";

describe("computeTeamBalance", () => {
  it("reduces balance after a partial payment", () => {
    const afterPartial = computeTeamBalance(1000, 400);
    assert.equal(afterPartial.balanceDue, 600);
    assert.equal(afterPartial.hasCredit, false);
  });

  it("accumulates several partial payments", () => {
    const first = computeTeamBalance(1000, 300);
    const second = computeTeamBalance(1000, 300 + 250);
    const settled = computeTeamBalance(1000, 300 + 250 + 450);

    assert.equal(first.balanceDue, 700);
    assert.equal(second.balanceDue, 450);
    assert.equal(settled.balanceDue, 0);
    assert.equal(settled.hasCredit, false);
  });

  it("allows negative balance when payment exceeds pending amount", () => {
    const balance = computeTeamBalance(500, 650);
    assert.equal(balance.balanceDue, -150);
    assert.equal(balance.hasCredit, true);
    assert.equal(balance.creditAmount, 150);
  });
});

describe("buildOverpaymentWarning", () => {
  it("warns when a payment exceeds the pending balance", () => {
    const balance = computeTeamBalance(500, 200);
    const warning = buildOverpaymentWarning(balance, 400);
    assert.ok(warning);
    assert.match(warning, /saldo a favor/i);
    assert.match(warning, /100\.00/);
  });

  it("does not warn for partial payments within balance", () => {
    const balance = computeTeamBalance(500, 100);
    assert.equal(buildOverpaymentWarning(balance, 200), null);
  });
});
