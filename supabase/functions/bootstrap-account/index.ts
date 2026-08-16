import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function secretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return parsed.default as string;
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function referralCode() {
  return "PIX" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL") || "";
    const secret = secretKey();
    if (!token || !url || !secret) return json({ error: "Sessão ausente." }, 401);

    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return json({ error: "Sessão inválida." }, 401);

    let payload: Record<string, unknown> = {};
    try { payload = await req.json(); } catch (_) {}

    const fullName = String(payload.full_name || user.user_metadata?.full_name || "").trim();
    const phone = String(payload.phone || user.user_metadata?.phone || "").trim();
    const requestedStudio = String(payload.studio_name || user.user_metadata?.studio_name || "").trim();
    const referral = String(payload.referral_code || user.user_metadata?.referral_code || "").trim().toUpperCase();
    const now = new Date().toISOString();
    const repaired: string[] = [];

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone: phone || null,
      email: user.email || null,
      updated_at: now,
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { count: adminCount, error: countError } = await admin.from("platform_admins").select("user_id", { count: "exact", head: true });
    if (countError) throw countError;
    const { data: currentAdmin, error: currentAdminError } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (currentAdminError) throw currentAdminError;
    let isAdmin = !!currentAdmin;
    if ((adminCount || 0) === 0 && !isAdmin) {
      const { error: adminInsertError } = await admin.from("platform_admins").insert({ user_id: user.id });
      if (adminInsertError && adminInsertError.code !== "23505") throw adminInsertError;
      isAdmin = true;
    }

    const { data: memberships, error: membershipError } = await admin
      .from("studio_members")
      .select("studio_id,role,active,studios(id,name,whatsapp,city,plan_id,status,billing_status,trial_ends_at,next_billing_at,settings,created_at)")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);
    if (membershipError) throw membershipError;

    let studioId = memberships?.[0]?.studio_id || null;
    let studio: any = memberships?.[0]?.studios || null;

    // Recovery path: a previous onboarding may have created the studio but failed before creating membership.
    if (!studioId) {
      const { data: ownedStudio, error: ownedStudioError } = await admin
        .from("studios")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (ownedStudioError) throw ownedStudioError;
      if (ownedStudio) {
        studioId = ownedStudio.id;
        studio = ownedStudio;
        const { error: repairMemberError } = await admin.from("studio_members").upsert({
          studio_id: studioId,
          user_id: user.id,
          role: "owner",
          active: true,
        }, { onConflict: "studio_id,user_id" });
        if (repairMemberError) throw repairMemberError;
        repaired.push("membership");
      }
    }

    // Normal onboarding path, also repairs users that only have an Auth/profile record.
    if (!studioId) {
      const trial = new Date();
      trial.setDate(trial.getDate() + 7);
      const studioName = requestedStudio || (isAdmin ? "Transforma Foto Studio" : (fullName ? `${fullName} Studio` : "Meu Estúdio"));
      const { data: createdStudio, error: studioError } = await admin.from("studios").insert({
        name: studioName,
        owner_user_id: user.id,
        plan_id: isAdmin ? "studio" : "free",
        status: isAdmin ? "active" : "trial",
        billing_status: "free",
        trial_ends_at: isAdmin ? null : trial.toISOString(),
        settings: { onboarded: true, internal_owner: isAdmin },
      }).select("*").single();
      if (studioError) throw studioError;

      studioId = createdStudio.id;
      studio = createdStudio;
      const { error: memberInsertError } = await admin.from("studio_members").upsert({
        studio_id: studioId,
        user_id: user.id,
        role: "owner",
        active: true,
      }, { onConflict: "studio_id,user_id" });
      if (memberInsertError) throw memberInsertError;
      repaired.push("studio_membership");

      const { error: auditError } = await admin.from("audit_logs").insert({
        studio_id: studioId,
        user_id: user.id,
        event: isAdmin ? "platform_bootstrap" : "studio_signup",
        payload: { email: user.email, studio_name: studioName },
      });
      if (auditError) console.warn("bootstrap audit", auditError.message);

      if (referral) {
        const { data: refCode, error: refLookupError } = await admin.from("referral_codes")
          .select("studio_id,code,reward_value").eq("code", referral).eq("active", true).maybeSingle();
        if (refLookupError) console.warn("referral lookup", refLookupError.message);
        if (refCode && refCode.studio_id !== studioId) {
          const { error: referralInsertError } = await admin.from("referrals").insert({
            referrer_studio_id: refCode.studio_id,
            referred_studio_id: studioId,
            referral_code: refCode.code,
            status: "pending",
            reward_value: Number(refCode.reward_value || 19.90),
          });
          if (referralInsertError && referralInsertError.code !== "23505") console.warn("referral", referralInsertError.message);
        }
      }
    }

    if (!studioId || !studio) throw new Error("Não foi possível concluir a vinculação do estúdio.");

    // Every studio should have a referral code, but failure here must never block login.
    const { data: ownCode, error: ownCodeError } = await admin.from("referral_codes").select("code").eq("studio_id", studioId).maybeSingle();
    if (!ownCodeError && !ownCode) {
      let candidate = referralCode();
      for (let i = 0; i < 3; i++) {
        const { error: codeError } = await admin.from("referral_codes").insert({ studio_id: studioId, code: candidate });
        if (!codeError) break;
        if (codeError.code !== "23505") { console.warn("referral code", codeError.message); break; }
        candidate = referralCode();
      }
    }

    return json({
      ok: true,
      user_id: user.id,
      is_platform_admin: isAdmin,
      studio_id: studioId,
      studio,
      repaired,
    });
  } catch (error) {
    console.error("bootstrap-account", error);
    return json({ error: error instanceof Error ? error.message : "Falha no onboarding." }, 500);
  }
});
