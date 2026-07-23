// Re-export the base Playwright fixture.
// Previously this wrapped a sandbox-only package; using @playwright/test
// directly keeps CI and local runs working with the same API.
export { test, expect } from "@playwright/test";
