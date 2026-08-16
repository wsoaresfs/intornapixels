import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function getSecretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return parsed.default as string;
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function requireAdmin(admin: ReturnType<typeof createClient>, token: string) {
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Sessão inválida.");
  const user = authData.user;
  const { data: row, error } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Acesso administrativo necessário.");
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Sessão ausente." }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const secret = getSecretKey();
    if (!url || !secret) return json({ error: "Backend incompleto." }, 500);
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const currentUser = await requireAdmin(admin, token);

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "create_studio") {
      const name = String(body.name || "").trim();
      const ownerName = String(body.owner_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!name || !ownerName || !email || password.length < 8) return json({ error: "Preencha estúdio, responsável, e-mail e senha com 8+ caracteres." }, 400);

      const { data: createdAuth, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: ownerName },
      });
      if (createUserError || !createdAuth.user) return json({ error: createUserError?.message || "Não foi possível criar o usuário." }, 400);
      const ownerId = createdAuth.user.id;

      try {
        const trialDays = Number(body.trial_days ?? 7);
        const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + Math.max(0, trialDays));
        const status = String(body.status || "trial");
        const { data: studio, error: studioError } = await admin.from("studios").insert({
          name,
          owner_user_id: ownerId,
          whatsapp: body.whatsapp || null,
          city: body.city || null,
          plan_id: body.plan_id || "free",
          status,
          billing_status: body.billing_status || (body.plan_id === "free" ? "free" : "pending"),
          trial_ends_at: status === "trial" ? trialEnd.toISOString() : null,
          next_billing_at: body.next_billing_at || null,
          settings: { operational: { brand: name, plan: body.plan_id || "free" } },
        }).select("*").single();
        if (studioError) throw studioError;

        const { error: memberError } = await admin.from("studio_members").insert({ studio_id: studio.id, user_id: ownerId, role: "owner", active: true });
        if (memberError) throw memberError;

        await admin.from("audit_logs").insert({ studio_id: studio.id, user_id: currentUser.id, event: "admin_create_studio", payload: { owner_id: ownerId, email, plan_id: body.plan_id || "free" } });
        return json({ ok: true, studio });
      } catch (e) {
        await admin.auth.admin.deleteUser(ownerId).catch(() => undefined);
        throw e;
      }
    }

    if (action === "update_studio") {
      const studioId = String(body.studio_id || "");
      const updates: Record<string, unknown> = {};
      for (const key of ["name","whatsapp","city","plan_id","status","billing_status","next_billing_at","trial_ends_at"] as const) {
        if (body[key] !== undefined) updates[key] = body[key] || null;
      }
      const { data: studio, error } = await admin.from("studios").update(updates).eq("id", studioId).select("*").single();
      if (error) throw error;
      if (body.owner_name || body.email || body.password) {
        const authUpdates: Record<string, unknown> = {};
        if (body.email) authUpdates.email = String(body.email).trim().toLowerCase();
        if (body.password) authUpdates.password = String(body.password);
        if (body.owner_name) authUpdates.user_metadata = { full_name: String(body.owner_name).trim() };
        if (Object.keys(authUpdates).length) {
          const { error: authUpdateError } = await admin.auth.admin.updateUserById(studio.owner_user_id, authUpdates);
          if (authUpdateError) throw authUpdateError;
        }
        await admin.from("profiles").update({
          ...(body.owner_name ? { full_name: String(body.owner_name).trim() } : {}),
          ...(body.email ? { email: String(body.email).trim().toLowerCase() } : {}),
        }).eq("id", studio.owner_user_id);
      }
      await admin.from("audit_logs").insert({ studio_id: studioId, user_id: currentUser.id, event: "admin_update_studio", payload: updates });
      return json({ ok: true, studio });
    }

    if (action === "reset_password") {
      const studioId = String(body.studio_id || "");
      const password = String(body.password || "");
      if (password.length < 8) return json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
      const { data: studio, error: studioError } = await admin.from("studios").select("owner_user_id,name").eq("id", studioId).single();
      if (studioError) throw studioError;
      const { error } = await admin.auth.admin.updateUserById(studio.owner_user_id, { password });
      if (error) throw error;
      await admin.from("audit_logs").insert({ studio_id: studioId, user_id: currentUser.id, event: "admin_reset_password", payload: {} });
      return json({ ok: true });
    }

    if (action === "delete_studio") {
      const studioId = String(body.studio_id || "");
      const { data: studio, error: fetchError } = await admin.from("studios").select("owner_user_id,name").eq("id", studioId).single();
      if (fetchError) throw fetchError;
      const { error } = await admin.from("studios").delete().eq("id", studioId);
      if (error) throw error;
      await admin.from("audit_logs").insert({ studio_id: null, user_id: currentUser.id, event: "admin_delete_studio", payload: { studio_id: studioId, name: studio.name } });
      if (body.delete_owner_user === true) await admin.auth.admin.deleteUser(studio.owner_user_id).catch(() => undefined);
      return json({ ok: true });
    }

    if (action === "ticket_update") {
      const ticketId = String(body.ticket_id || "");
      const updates: Record<string, unknown> = {};
      if (body.status) updates.status = body.status;
      if (body.admin_response !== undefined) updates.admin_response = body.admin_response;
      const { data: ticket, error } = await admin.from("support_tickets").update(updates).eq("id", ticketId).select("*").single();
      if (error) throw error;
      await admin.from("audit_logs").insert({ studio_id: ticket.studio_id, user_id: currentUser.id, event: "admin_ticket_update", payload: { ticket_id: ticketId, ...updates } });
      return json({ ok: true, ticket });
    }

    return json({ error: "Ação administrativa desconhecida." }, 400);
  } catch (error) {
    console.error("admin-control", error);
    const message = error instanceof Error ? error.message : "Falha administrativa.";
    const status = message.includes("administrativo") ? 403 : 500;
    return json({ error: message }, status);
  }
});
