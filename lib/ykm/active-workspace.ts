// YKM fork addition: a user can belong to several companies (workspaces) and
// switch between them. The chosen one is kept in a cookie; every lookup still
// checks membership, so the cookie can only pick among the user's own
// workspaces. Outside a request (worker, scripts) there is no cookie and the
// oldest membership is used, as before.
import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE = "openreply-workspace";

export async function readActiveWorkspaceId(): Promise<string | undefined> {
  try {
    return (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value || undefined;
  } catch {
    return undefined;
  }
}
