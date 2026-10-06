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
  const { startStayMessageWorker } = await import("@/lib/stay-messages");
  startStayMessageWorker();
  const { startReviewModerationWorker } = await import("@/lib/stay-reviews");
  startReviewModerationWorker();
  const { startAddressReminderWorker } = await import("@/lib/address-reminders");
  startAddressReminderWorker();
  const { restoreAttachmentMessagesFromMysql } = await import("@/lib/host-inbox-store");
  void restoreAttachmentMessagesFromMysql()
    .then((n) => n && console.log(`[host-inbox] ${n} mensajes con adjunto recuperados`))
    .catch((e) => console.warn("[host-inbox] restore", e));
  const { ensureDemoStayMedia } = await import("@/lib/demo-stay-media");
  void ensureDemoStayMedia().catch((e) => console.warn("[demo stay media]", e));
}
