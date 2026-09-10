/** Restartable attachment backfill. Files use stable message IDs; retain your pre-migration backup. */
import { listWorkspaces, mutate } from "../../src/lib/neutronium/store";
async function main() {
  let cursor: string | undefined;
  for (;;) {
    const page = await listWorkspaces(false, cursor);
    if (!page.length) break;
    for (const org of page) await mutate(org.id, false, () => {});
    cursor = page[page.length - 1].id;
  }
  console.log("Private attachment backfill complete.");
}
void main().catch(() => {
  console.error(
    "Backfill failed; inspect database/storage configuration and retry.",
  );
  process.exitCode = 1;
});
