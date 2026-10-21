export const isPendingEvidence = (status: string | null | undefined) =>
  status === "PENDING" || status === "PENDING_UPLOAD";
