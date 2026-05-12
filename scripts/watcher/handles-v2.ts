// Watcher V2 handles — legacy CLI shim.
// Source of truth lives in src/lib/watcher/handles.ts so that the file
// is bundled by Vercel (scripts/ is not). Keep this file as a thin
// re-export so scripts/watcher/watcherV2.ts (Host-005 CLI) keeps working.

export { handlesV2, type WatchHandle } from "../../src/lib/watcher/handles";
