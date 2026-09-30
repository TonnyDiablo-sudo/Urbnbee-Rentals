export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startOutboundWebhookWorker } = await import("@/lib/beeagent-outbound");
  startOutboundWebhookWorker();
}
