"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiTrash2 } from "react-icons/fi";
import { api } from "@/lib/api-client";

/**
 * Removing a console account. Confirmed before it fires — this revokes
 * someone's access, and there is no undo once the row is gone.
 *
 * Your own row has no delete button. The server refuses it anyway, but offering
 * a control that can only ever fail is worse than not offering it.
 */
export function TeamMemberActions({
  isSelf,
  memberId,
  name,
}: {
  isSelf: boolean;
  memberId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isSelf) return null;

  async function remove() {
    if (
      !window.confirm(
        `Remove ${name}? They will no longer be able to sign in to the console.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/users/${memberId}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to remove this account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="campaign-edit-image-button danger"
      disabled={busy}
      onClick={remove}
      type="button"
    >
      <FiTrash2 aria-hidden="true" /> {busy ? "Removing..." : "Remove"}
    </button>
  );
}
