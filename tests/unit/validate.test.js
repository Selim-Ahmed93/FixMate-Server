import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeRegex,
  normalizeRole,
  requireEmail,
  requireFutureDate,
  requireObjectId,
  requirePhone,
  requirePositiveNumber,
  requireString,
} from "../../src/utils/validate.js";

test("requireString trims and validates length", () => {
  assert.equal(requireString("  FixMate  ", "Name"), "FixMate");
  assert.throws(() => requireString("", "Name"), /at least 1/);
  assert.throws(() => requireString(123, "Name"), /must be a string/);
  assert.throws(() => requireString("ab", "Name", { min: 3 }), /at least 3/);
});

test("requireEmail normalizes and validates", () => {
  assert.equal(requireEmail("  USER@Example.COM  "), "user@example.com");
  assert.throws(() => requireEmail("not-an-email"), /invalid/);
});

test("requirePhone accepts common formats", () => {
  assert.equal(requirePhone("+880 1712-345678"), "+880 1712-345678");
  assert.throws(() => requirePhone("abc"), /at least 7/);
  assert.throws(() => requirePhone("abcdefgh"), /invalid/);
  assert.throws(() => requirePhone("+880 1712 345678 ext 99"), /invalid/);
});

test("requirePositiveNumber rejects strings and non-positive values", () => {
  assert.equal(requirePositiveNumber(45, "Price"), 45);
  assert.throws(() => requirePositiveNumber("45", "Price"), /positive number/);
  assert.throws(() => requirePositiveNumber(0, "Price"), /positive number/);
  assert.throws(() => requirePositiveNumber(NaN, "Price"), /positive number/);
});

test("requireFutureDate rejects past and invalid dates", () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(requireFutureDate(future).getTime(), future.getTime());
  assert.throws(
    () => requireFutureDate(new Date(Date.now() - 60_000)),
    /must be in the future/,
  );
  assert.throws(() => requireFutureDate("not-a-date"), /invalid/);
});

test("requireObjectId validates MongoDB ObjectIds", () => {
  const id = "507f1f77bcf86cd799439011";
  assert.equal(requireObjectId(id).toString(), id);
  assert.throws(() => requireObjectId("invalid"), /invalid/);
});

test("normalizeRole prevents admin signup", () => {
  assert.equal(normalizeRole("customer"), "customer");
  assert.equal(normalizeRole("technician"), "technician");
  assert.equal(normalizeRole("admin"), "customer");
  assert.equal(normalizeRole(undefined), "customer");
});

test("escapeRegex escapes user search input", () => {
  assert.equal(escapeRegex("a+b"), "a\\+b");
});
