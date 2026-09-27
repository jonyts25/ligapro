const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.join(repoRoot, "src/lib/shared"),
  path.join(repoRoot, "src/types"),
];

config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

const aliasToFile = {
  "@ligapro/shared": path.join(repoRoot, "src/lib/shared/index.ts"),
  "@ligapro/database": path.join(repoRoot, "src/types/database.ts"),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const aliasTarget = aliasToFile[moduleName];
  if (aliasTarget) {
    return {
      filePath: aliasTarget,
      type: "sourceFile",
    };
  }

  if (moduleName.startsWith("@ligapro/shared/")) {
    const subpath = moduleName.slice("@ligapro/shared/".length);
    return {
      filePath: path.join(repoRoot, "src/lib/shared", `${subpath}.ts`),
      type: "sourceFile",
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
