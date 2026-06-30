// admin-delete-user
// -----------------------------------------------------------------------------
// Security model:
//   - Callable ONLY by authenticated users with the `admin` role.
//     Partners, participants, and unauthenticated callers are rejected.
//   - Performs a SOFT delete only: sets `profiles.deleted_at = now()` and bans
//     the auth user (far-future `ban_duration`) so they cannot sign in. No
//     rows are hard-deleted by this function.
//   - Safety checks (enforced before any mutation):
//       * Admins cannot delete their OWN account  -> `cannot_delete_self`
//       * The last remaining admin cannot be      -> `cannot_delete_last_admin`
//         deleted
//       * Already soft-deleted accounts rejected  -> `already_deleted`
//       * Unknown target user rejected            -> `user_not_found`
//   - Every successful deletion is recorded in `admin_audit_log` with
//     action = "delete_user" and the target user id.
//   - The service-role key is used only inside this function and never
//     returned to the client.
//   - Error responses are intentionally generic (stable error codes); full
//     details are logged server-side only.
// -----------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  user_id: z.string().uuid(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("admin-delete-user: missing required env vars");
    return json(500, { error: "server_misconfigured" });
  }

  // --- Authn: require a valid bearer token --------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json(401, { error: "unauthorized" });
  const callerId = claimsData.claims.sub as string;

  // Service-role admin client. Key stays server-side.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Authz: admin-only --------------------------------------------------
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleErr) {
    console.error("admin-delete-user: has_role failed", roleErr.message);
    return json(403, { error: "forbidden" });
  }
  if (!isAdminData) return json(403, { error: "forbidden" });

  // --- Input validation ---------------------------------------------------
  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: "invalid_input", details: parsed.error.flatten().fieldErrors });
  }
  const { user_id } = parsed.data;

  // --- Safety: cannot delete self -----------------------------------------
  if (user_id === callerId) {
    return json(400, {
      error: "cannot_delete_self",
      message: "Admins cannot delete their own account.",
    });
  }

  // --- Target lookup ------------------------------------------------------
  const { data: targetProfile, error: profErr } = await admin
    .from("profiles")
    .select("id, email, full_name, deleted_at")
    .eq("id", user_id)
    .maybeSingle();
  if (profErr) {
    console.error("admin-delete-user: profile lookup failed", profErr.message);
    return json(500, { error: "lookup_failed" });
  }
  if (!targetProfile) return json(404, { error: "user_not_found" });
  if (targetProfile.deleted_at) {
    return json(400, { error: "already_deleted", message: "Account is already removed." });
  }

  // --- Safety: cannot delete the last remaining admin ---------------------
  const { data: targetRoles, error: trErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  if (trErr) {
    console.error("admin-delete-user: target roles lookup failed", trErr.message);
    return json(500, { error: "lookup_failed" });
  }
  const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");

  if (targetIsAdmin) {
    const { data: admins, error: adminsErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (adminsErr) {
      console.error("admin-delete-user: admins lookup failed", adminsErr.message);
      return json(500, { error: "lookup_failed" });
    }
    const otherAdmins = (admins ?? [])
      .map((a) => a.user_id)
      .filter((id) => id !== user_id);
    if (otherAdmins.length === 0) {
      return json(400, {
        error: "cannot_delete_last_admin",
        message: "Cannot remove the last remaining admin.",
      });
    }
  }

  // --- Soft delete --------------------------------------------------------
  const deletedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("profiles")
    .update({ deleted_at: deletedAt })
    .eq("id", user_id);
  if (updErr) {
    console.error("admin-delete-user: soft delete failed", updErr.message);
    return json(500, { error: "delete_failed" });
  }

  // Ban auth user (disables sign-in). Non-fatal if it fails.
  const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
    ban_duration: "876000h", // ~100 years
  } as any);
  if (banErr) console.warn("admin-delete-user: auth ban failed", banErr.message);

  // --- Audit log ----------------------------------------------------------
  const { error: logErr } = await admin.from("admin_audit_log").insert({
    actor_id: callerId,
    action: "delete_user",
    target_user_id: user_id,
    details: {
      target_email: targetProfile.email,
      target_name: targetProfile.full_name,
      deleted_at: deletedAt,
      auth_banned: !banErr,
    },
  });
  if (logErr) console.warn("admin-delete-user: audit log insert failed", logErr.message);

  return json(200, { ok: true, deleted_at: deletedAt });
});
