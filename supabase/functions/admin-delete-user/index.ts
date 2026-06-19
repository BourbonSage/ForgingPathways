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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json(401, { error: "unauthorized" });
  const callerId = claimsData.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleErr || !isAdminData) return json(403, { error: "forbidden" });

  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: "invalid_input", details: parsed.error.flatten().fieldErrors });
  }
  const { user_id } = parsed.data;

  if (user_id === callerId) {
    return json(400, { error: "self_delete_not_allowed", message: "You cannot remove your own account." });
  }

  // Target profile
  const { data: targetProfile, error: profErr } = await admin
    .from("profiles")
    .select("id, email, full_name, deleted_at")
    .eq("id", user_id)
    .maybeSingle();
  if (profErr) return json(500, { error: "lookup_failed", message: profErr.message });
  if (!targetProfile) return json(404, { error: "user_not_found" });

  // If target is admin, ensure they aren't the last remaining admin
  const { data: targetRoles, error: trErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  if (trErr) return json(500, { error: "lookup_failed", message: trErr.message });
  const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");

  if (targetIsAdmin) {
    const { data: admins, error: adminsErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (adminsErr) return json(500, { error: "lookup_failed", message: adminsErr.message });
    const otherAdmins = (admins ?? [])
      .map((a) => a.user_id)
      .filter((id) => id !== user_id);
    if (otherAdmins.length === 0) {
      return json(400, {
        error: "last_admin",
        message: "Cannot remove the last remaining admin.",
      });
    }
  }

  if (targetProfile.deleted_at) {
    return json(400, { error: "already_deleted", message: "Account is already removed." });
  }

  // Soft delete profile
  const deletedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("profiles")
    .update({ deleted_at: deletedAt })
    .eq("id", user_id);
  if (updErr) return json(500, { error: "delete_failed", message: updErr.message });

  // Ban the auth user (effectively disables sign-in)
  const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
    ban_duration: "876000h", // ~100 years
  } as any);
  if (banErr) console.warn("auth ban failed", banErr.message);

  // Audit log
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
  if (logErr) console.warn("audit log failed", logErr.message);

  return json(200, { ok: true, deleted_at: deletedAt });
});
