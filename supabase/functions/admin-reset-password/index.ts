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
  // Guarantee at least one of each class
  const required = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  const rest: string[] = [];
  for (let i = 4; i < length; i++) rest.push(all[bytes[i] % all.length]);
  const out = [...required, ...rest];
  // Fisher-Yates shuffle
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify caller is admin
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleErr || !isAdminData) {
    return json(403, { error: "forbidden" });
  }

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

  if (user_id === callerId) {
    return json(400, {
      error: "self_reset_not_allowed",
      message: "Use the standard password change flow to reset your own password.",
    });
  }

  // Confirm target exists
  const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(user_id);
  if (getErr || !targetUser?.user) {
    return json(404, { error: "user_not_found" });
  }

  const password = new_password ?? generatePassword();
  const generated = !new_password;

  const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
  if (updErr) {
    return json(500, { error: "update_failed", message: updErr.message });
  }

  const { error: logErr } = await admin.from("admin_audit_log").insert({
    actor_id: callerId,
    action: "reset_password",
    target_user_id: user_id,
    details: {
      target_email: targetUser.user.email,
      generated,
    },
  });
  if (logErr) console.warn("audit log failed", logErr.message);

  return json(200, {
    ok: true,
    generated,
    password: generated ? password : undefined,
  });
});
