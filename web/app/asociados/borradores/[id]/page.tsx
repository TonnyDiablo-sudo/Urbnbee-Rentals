import Link from "next/link";
import { notFound } from "next/navigation";
import { getDraft, listDraftsForAssociate } from "@/lib/associate-drafts-store";
import { findDuplicates } from "@/lib/associate-duplicates";
import { listUsersProvisionedBy } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { ReviewForm } from "./review-form";

export default async function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const draft = getDraft(id);
  if (!draft || (draft.associateId !== user.id && user.role !== "admin")) notFound();

  if (draft.status !== "pending") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-700">
          Este borrador ya se {draft.status === "published" ? "publicó" : "descartó"}.
        </p>
        <Link href="/asociados" className="mt-3 inline-block text-sm text-amber-600 underline">
          ← Volver
        </Link>
      </div>
    );
  }

  const duplicates = findDuplicates({
    contact: draft.contact,
    title: draft.listing.title,
    city: draft.listing.city,
    sourceUrl: draft.source.url,
  });
  const accounts = listUsersProvisionedBy(draft.associateId)
    .filter((u) => !u.claimedAt)
    .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }));
  const nextDraft = listDraftsForAssociate(draft.associateId, "pending").find((d) => d.id !== draft.id);

  return (
    <ReviewForm
      draft={draft}
      duplicates={duplicates}
      accounts={accounts}
      nextDraftId={nextDraft?.id}
    />
  );
}
