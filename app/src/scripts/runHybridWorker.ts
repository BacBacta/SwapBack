import { startHybridWorker } from "@/workers/hybridIntentWorker";
import { protocolMonitor } from "@/lib/protocolMonitor";

async function main() {
  protocolMonitor.info("system", "Hybrid worker démarré", "worker:hybrid");
  await startHybridWorker();
}

main().catch((error) => {
  protocolMonitor.systemError(error instanceof Error ? error.message : "Worker crash", {
    component: "runHybridWorker",
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
