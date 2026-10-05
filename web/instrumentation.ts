export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startOutboundWebhookWorker } = await import("@/lib/beeagent-outbound");
  startOutboundWebhookWorker();
  const { startCatalogRefreshWorker } = await import("@/lib/urbnbeeai-catalog-sync");
  startCatalogRefreshWorker();
  const { startCleaningWorker } = await import("@/lib/cleaning-service");
  startCleaningWorker();
  const { startPlanExpiryWorker } = await import("@/lib/plan-expiry");
  startPlanExpiryWorker();
  const { startReviewReminderWorker } = await import("@/lib/review-reminders");
  startReviewReminderWorker();
  const { startArrivalMessageWorker } = await import("@/lib/arrival-message");
  startArrivalMessageWorker();
}
