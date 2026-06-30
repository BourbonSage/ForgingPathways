// admin-reset-password
// -----------------------------------------------------------------------------
// Security model:
//   - Callable ONLY by authenticated users with the `admin` role.
//   - Partners, participants, and unauthenticated callers are rejected.
//   - Admins cannot reset their OWN password through this function — they must
//     use the standard self-service password change flow.
//   - The target user must exist in `profiles` and must NOT be soft-deleted
//     (`deleted_at IS NULL`).
//   - Password updates are performed via the Supabase service-role admin
//     client; the service role key never leaves this function.
//   - Every successful reset is recorded in `admin_audit_log` with
//     action = "reset_password" and the target user id.
//   - Error responses are intentionally generic (stable error codes, no
//     internal details leaked to the client). Detailed errors are logged
//     server-side only.
// -----------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  user_id: z.string().uuid(),
  new_password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be at most 128 characters")
    .optional(),
});

function generatePassword(length = 18): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+?";
  const all = upper + lower + digits + symbols;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const required = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  const rest: string[] = [];
  for (let i = 4; i < length; i++) rest.push(all[bytes[i] % all.length]);
  const out = [...required, ...rest];
  for (let i = out.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

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
    console.error("admin-reset-password: missing required env vars");
    return json(500, { error: "server_misconfigured" });
  }

  // --- Authn: require a valid bearer token --------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json(401, { error: "unauthorized" });
  }
  const callerId = claimsData.claims.sub as string;

  // Service-role admin client. The service role key stays server-side.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Authz: admin-only (partners are NOT allowed here) ------------------
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleErr) {
    console.error("admin-reset-password: has_role failed", roleErr.message);
    return json(403, { error: "forbidden" });
  }
  if (!isAdminData) {
    return json(403, { error: "forbidden" });
  }

  // --- Input validation ---------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: "invalid_input", details: parsed.error.flatten().fieldErrors });
  }
  const { user_id, new_password } = parsed.data;

  // --- Safety: cannot reset own password ----------------------------------
  if (user_id === callerId) {
    return json(400, {
      error: "cannot_reset_own_password",
      message: "Admins cannot reset their own password here. Use the standard password change flow.",
    });
  }

  // --- Target must exist and not be soft-deleted --------------------------
  const { data: targetProfile, error: profErr } = await admin
    .from("profiles")
    .select("id, email, deleted_at")
    .eq("id", user_id)
    .maybeSingle();
  if (profErr) {
    console.error("admin-reset-password: profile lookup failed", profErr.message);
    return json(500, { error: "lookup_failed" });
  }
  if (!targetProfile) {
    return json(404, { error: "user_not_found" });
  }
  if (targetProfile.deleted_at) {
    return json(400, {
      error: "user_deleted",
      message: "This account has been removed and cannot have its password reset.",
    });
  }

  // Confirm target exists in auth as well
  const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(user_id);
  if (getErr || !targetUser?.user) {
    return json(404, { error: "user_not_found" });
  }

  const password = new_password ?? generatePassword();
  const generated = !new_password;

  const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
  if (updErr) {
    console.error("admin-reset-password: updateUserById failed", updErr.message);
    return json(500, { error: "update_failed" });
  }

  const { error: logErr } = await admin.from("admin_audit_log").insert({
    actor_id: callerId,
    action: "reset_password",
    target_user_id: user_id,
    details: {
      target_email: targetProfile.email ?? targetUser.user.email,
      generated,
    },
  });
  if (logErr) console.warn("admin-reset-password: audit log insert failed", logErr.message);

  return json(200, {
    ok: true,
    generated,
    password: generated ? password : undefined,
  });
});
