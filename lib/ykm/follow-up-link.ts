// YKM fork addition: the follow-up link button goes through /f/<automationId>
// so taps on it (the workshop link) are counted per recipient, like DM links.
import { buildTrackedUrl } from "@/lib/tracking/message";
import { hashRecipientId } from "@/lib/tracking/server";

export function followUpTrackedUrl(automationId: string, recipientId: string, baseUrl?: string) {
  // buildTrackedUrl yields <base>/r/<slug>?r=<token>; swap the prefix.
  return buildTrackedUrl(automationId, baseUrl, hashRecipientId(recipientId)).replace(
    `/r/${automationId}`,
    `/f/${automationId}`
  );
}
