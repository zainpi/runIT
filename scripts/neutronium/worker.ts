/** Standalone local worker. Production uses the authenticated scheduled endpoint. */
import { listWorkspaces } from "../../src/lib/neutronium/store";
import { tick } from "../../src/lib/neutronium/worker";
if (process.env.NODE_ENV !== "development")
  throw new Error("The local worker requires NODE_ENV=development.");
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
console.log(
  "Neutronium development worker running. Provider operations are simulated.",
);
async function main() {
  while (!stopped) {
    for (const org of await listWorkspaces(true)) {
      try {
        await tick(org.id, true);
      } catch {
        console.error(
          `Workspace ${org.id}: worker iteration failed; retrying next cycle.`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
void main().catch(() => {
  console.error("Development worker stopped unexpectedly.");
  process.exitCode = 1;
});
