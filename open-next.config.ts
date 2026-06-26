import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal OpenNext config for a mostly-static Next.js marketing site.
// If you later add ISR/SSG revalidation, wire up an R2 incremental cache here.
// See: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
