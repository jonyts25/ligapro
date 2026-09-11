import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SRC_ROOT = path.join(process.cwd(), "src");

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function isUseServerFile(content: string): boolean {
  return /^\s*["']use server["'];?\s*$/m.test(content);
}

function findInvalidUseServerExports(content: string): string[] {
  const violations: string[] = [];

  for (const [index, line] of content.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("export ")) {
      continue;
    }

    const allowed =
      /^export async function\b/.test(trimmed) ||
      /^export default async function\b/.test(trimmed) ||
      /^export type\b/.test(trimmed);

    if (!allowed) {
      violations.push(`${index + 1}: ${trimmed}`);
    }
  }

  return violations;
}

describe("use server export contract", () => {
  it("only exports async functions or types from use server files", () => {
    const useServerFiles = listSourceFiles(SRC_ROOT).filter((filePath) =>
      isUseServerFile(readFileSync(filePath, "utf8"))
    );

    const violations = useServerFiles.flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8");
      const invalidExports = findInvalidUseServerExports(content);
      return invalidExports.map(
        (entry) => `${path.relative(process.cwd(), filePath)}:${entry}`
      );
    });

    assert.deepEqual(
      violations,
      [],
      `Invalid use server exports found:\n${violations.join("\n")}`
    );
  });
});
