// Import Worker types as a module so its Request/Response/Element declarations
// do not replace the DOM types used by this Next.js application.
declare module "cloudflare:workers" {
  import { CloudflareWorkersModule } from "@cloudflare/workers-types";
  export = CloudflareWorkersModule;
}
type D1Database = import("@cloudflare/workers-types").D1Database;
type ImagesBinding = import("@cloudflare/workers-types").ImagesBinding;
type Fetcher = import("@cloudflare/workers-types").Fetcher;
type DurableObjectNamespace<T extends import("@cloudflare/workers-types").Rpc.DurableObjectBranded | undefined = undefined> = import("@cloudflare/workers-types").DurableObjectNamespace<T>;
