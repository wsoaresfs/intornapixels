import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function secretKey() {
  const m = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (m) {
    try { return JSON.parse(m).default || ""; } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function normBaseUrl(v: string) { return String(v || "").trim().replace(/\/$/, ""); }
async function fetchWaha(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("X-Api-Key", apiKey);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  let data: any = null;
  if (contentType.includes("application/json")) data = await response.json();
  else if (contentType.startsWith("image/")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = ""; for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
    data = { base64: `data:${contentType};base64,${btoa(binary)}` };
  } else data = await response.text();
  if (!response.ok) {
    const message = typeof data === "object" ? data?.message || data?.error || data?.reason : String(data || "Erro no WAHA.");
    throw new Error(message);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Sessão ausente." }, 401);
    const url = Deno.env.get("SUPABASE_URL") || "", sk = secretKey();
    const admin = createClient(url, sk, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);
    const { data: platformAdmin } = await admin.from("platform_admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (!platformAdmin) return json({ error: "Somente administrador da plataforma pode usar o WAHA Teste." }, 403);
    const body = await req.json(), action = String(body.action || "status");
    const [{ data: cfg }, { data: vaultKey }] = await Promise.all([
      admin.from("platform_integrations").select("waha_base_url,waha_session").eq("id", 1).single(),
      admin.rpc("get_platform_integration_secret", { p_provider: "waha" }),
    ]);
    const baseUrl = normBaseUrl(String(cfg?.waha_base_url || ""));
    const apiKey = String(vaultKey || "").trim();
    const session = String(cfg?.waha_session || "default").trim() || "default";
    if (!baseUrl || !apiKey) return json({ error: "WAHA ainda não foi conectado no Admin Master." }, 503);
    if (action === "status") return json({ ok:true, session:await fetchWaha(baseUrl,apiKey,`/api/sessions/${encodeURIComponent(session)}`) });
    if (action === "start") {
      try { await fetchWaha(baseUrl,apiKey,"/api/sessions",{method:"POST",body:JSON.stringify({name:session})}); } catch {}
      try { await fetchWaha(baseUrl,apiKey,`/api/sessions/${encodeURIComponent(session)}/start`,{method:"POST",body:"{}"}); }
      catch { await fetchWaha(baseUrl,apiKey,"/api/sessions/start",{method:"POST",body:JSON.stringify({name:session})}); }
      return json({ok:true,session:await fetchWaha(baseUrl,apiKey,`/api/sessions/${encodeURIComponent(session)}`)});
    }
    if (action === "restart") return json({ok:true,session:await fetchWaha(baseUrl,apiKey,`/api/sessions/${encodeURIComponent(session)}/restart`,{method:"POST",body:"{}"})});
    if (action === "logout") return json({ok:true,session:await fetchWaha(baseUrl,apiKey,`/api/sessions/${encodeURIComponent(session)}/logout`,{method:"POST",body:"{}"})});
    if (action === "qr") return json({ok:true,...await fetchWaha(baseUrl,apiKey,`/api/${encodeURIComponent(session)}/auth/qr`,{headers:{Accept:"application/json"}})});
    if (action === "chats") { const d=await fetchWaha(baseUrl,apiKey,`/api/${encodeURIComponent(session)}/chats/overview?limit=60&offset=0`); return json({ok:true,chats:Array.isArray(d)?d:d?.items||[]}); }
    if (action === "messages") { const chatId=String(body.chatId||"").trim(); if(!chatId)return json({error:"chatId obrigatório."},400); const d=await fetchWaha(baseUrl,apiKey,`/api/${encodeURIComponent(session)}/chats/${encodeURIComponent(chatId)}/messages?limit=60&offset=0&downloadMedia=false`); return json({ok:true,messages:Array.isArray(d)?d:d?.items||[]}); }
    if (action === "send_text") { const chatId=String(body.chatId||"").trim(),text=String(body.text||"").trim(); if(!chatId||!text)return json({error:"chatId e text são obrigatórios."},400); return json({ok:true,provider:await fetchWaha(baseUrl,apiKey,"/api/sendText",{method:"POST",body:JSON.stringify({session,chatId,text})})}); }
    return json({ error: "Ação não suportada." }, 400);
  } catch (e) { console.error("waha-test",e); return json({error:e instanceof Error?e.message:"Falha no WAHA Teste."},500); }
});
