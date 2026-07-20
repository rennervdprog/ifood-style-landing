import { createLovableConfig } from "lovable-agent-playwright-config/config";
import path from "node:path";
import fs from "node:fs";

const AUTH_FILE = path.resolve(".auth/pdv-user.json");
const hasAuth = fs.existsSync(AUTH_FILE);

export default createLovableConfig({
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  use: hasAuth ? { storageState: AUTH_FILE } : undefined,
});
