(function(global){
'use strict';
const C=global.IntornaCloud;if(!C||!C.client)return;
const db=C.client,KEY=C.KEY;
const clone=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const PACKAGE_MAP={essencial:{name:'Essencial',photos:3},premium:{name:'Premium',photos:6},gold:{name:'Gold',photos:10},platinum:{name:'Platinum',photos:20}};
const statusToDb={'Aguardando fotos':'aguardando_fotos','Pagamento pendente':'pagamento_pendente','Em produção':'em_producao','Em revisão':'em_revisao','Pronto para entrega':'pronto','Entregue':'entregue','Cancelado':'cancelado'};
const payToDb={Pendente:'pending',Parcial:'confirmed',Pago:'received'};
let baseline=null,timer=null,running=false,pending=null,nativeSet=localStorage.setItem.bind(localStorage);
const arr=v=>Array.isArray(v)?v:[];
const mapBy=(xs,key='id')=>new Map(arr(xs).filter(x=>x&&x[key]).map(x=>[String(x[key]),x]));
const changed=(before,after,fields)=>fields.filter(f=>!eq(before?.[f],after?.[f]));
function clientInsert(c,sid){return {id:c.id,studio_id:sid,name:c.name,email:c.email||null,whatsapp:c.whatsapp||null,city:c.city||null,important_date:c.importantDate||null,notes:c.notes||null,whatsapp_stage:c.whatsappStage||'novo_lead',last_contact_at:c.lastContactAt||null,last_contact_note:c.lastContactNote||null,created_at:c.createdAt||new Date().toISOString()}}
function clientUpdate(a,b){const m={name:'name',email:'email',whatsapp:'whatsapp',city:'city',importantDate:'important_date',notes:'notes',whatsappStage:'whatsapp_stage',lastContactAt:'last_contact_at',lastContactNote:'last_contact_note'},o={};for(const f of changed(a,b,Object.keys(m))){let v=b[f];if(['email','whatsapp','city','importantDate','notes','lastContactAt','lastContactNote'].includes(f)&&!v)v=null;o[m[f]]=v}return o}
function orderInsert(o,sid){const p=PACKAGE_MAP[o.packageId]||{name:o.packageId||'Pacote',photos:0};return {id:o.id,studio_id:sid,client_id:o.clientId,package_id:o.packageId||null,package_name:p.name,included_photos:p.photos,order_value:Number(o.total||0),essay_type:o.type||null,format:o.format||'4:5',status:statusToDb[o.status]||'aguardando_fotos',payment_status:payToDb[o.payment]||'pending',payment_method:o.paymentMethod||null,deadline_at:o.deadline||null,extra_offer_qty:Number(o.extraOfferQty||0),extra_strategy:o.extraStrategy||'avulsa',watermark_extras:o.watermarkExtras!==false,extras:Array.isArray(o.extras)?o.extras:[],notes:o.notes||null,created_at:o.createdAt||new Date().toISOString()}}
function orderUpdate(a,b){const o={};if(a.clientId!==b.clientId)o.client_id=b.clientId;if(a.packageId!==b.packageId){const p=PACKAGE_MAP[b.packageId]||{name:b.packageId||'Pacote',photos:0};o.package_id=b.packageId||null;o.package_name=p.name;o.included_photos=p.photos}if(a.total!==b.total)o.order_value=Number(b.total||0);if(a.type!==b.type)o.essay_type=b.type||null;if(a.format!==b.format)o.format=b.format||'4:5';if(a.status!==b.status)o.status=statusToDb[b.status]||'aguardando_fotos';if(a.payment!==b.payment)o.payment_status=payToDb[b.payment]||'pending';if(a.paymentMethod!==b.paymentMethod)o.payment_method=b.paymentMethod||null;if(a.deadline!==b.deadline)o.deadline_at=b.deadline||null;if(a.extraOfferQty!==b.extraOfferQty)o.extra_offer_qty=Number(b.extraOfferQty||0);if(a.extraStrategy!==b.extraStrategy)o.extra_strategy=b.extraStrategy||'avulsa';if(a.watermarkExtras!==b.watermarkExtras)o.watermark_extras=b.watermarkExtras!==false;if(!eq(a.extras,b.extras))o.extras=Array.isArray(b.extras)?b.extras:[];if(a.notes!==b.notes)o.notes=b.notes||null;return o}
function salesMap(ws){const out=new Map();for(const o of arr(ws?.orders))for(const s of arr(o.extraSales))if(s?.id)out.set(String(s.id),{...s,orderId:o.id});return out}
function saleInsert(s,sid){return {id:s.id,studio_id:sid,order_id:s.orderId,quantity:Number(s.qty||1),amount:Number(s.value||0),payment_status:s.payment==='Pago'?'received':'pending',created_at:s.createdAt||new Date().toISOString()}}
function saleUpdate(a,b){const o={};if(a.orderId!==b.orderId)o.order_id=b.orderId;if(a.qty!==b.qty)o.quantity=Number(b.qty||1);if(a.value!==b.value)o.amount=Number(b.value||0);if(a.payment!==b.payment)o.payment_status=b.payment==='Pago'?'received':'pending';return o}
async function safeDelete(table,idCol,ids,sid){if(!ids.length)return;const {error}=await db.from(table).delete().eq('studio_id',sid).in(idCol,ids);if(error)throw error}
async function syncDelta(ctx,next){
  if(!baseline)baseline=clone(JSON.parse(localStorage.getItem(KEY)||'{}'));
  const prev=baseline||{},sid=ctx.studioId;if(!sid)throw new Error('Estúdio ausente para sincronização.');
  // Config: merge only keys changed locally into the freshest server settings.
  const pCfg=prev.config||{},nCfg=next.config||{},cfgKeys=new Set([...Object.keys(pCfg),...Object.keys(nCfg)]),cfgChanged=[...cfgKeys].filter(k=>!eq(pCfg[k],nCfg[k]));
  if(cfgChanged.length){const {data:studio,error}=await db.from('studios').select('name,whatsapp,settings').eq('id',sid).single();if(error)throw error;const operational={...(studio?.settings?.operational||{})};for(const k of cfgChanged)operational[k]=nCfg[k];const upd={settings:{...(studio?.settings||{}),operational}};if(cfgChanged.includes('brand'))upd.name=nCfg.brand||studio.name||'Meu Estúdio';if(cfgChanged.includes('whatsapp'))upd.whatsapp=nCfg.whatsapp||null;const r=await db.from('studios').update(upd).eq('id',sid);if(r.error)throw r.error}
  // Clients: new/full, existing/field-delta, explicit deletions only from baseline.
  const pc=mapBy(prev.clients),nc=mapBy(next.clients);for(const [id,c] of nc){if(!isUuid(id))continue;if(!pc.has(id)){const r=await db.from('clients').insert(clientInsert(c,sid));if(r.error&&r.error.code!=='23505')throw r.error}else{const u=clientUpdate(pc.get(id),c);if(Object.keys(u).length){const r=await db.from('clients').update(u).eq('studio_id',sid).eq('id',id);if(r.error)throw r.error}}}await safeDelete('clients','id',[...pc.keys()].filter(id=>!nc.has(id)),sid);
  // Orders.
  const po=mapBy(prev.orders),no=mapBy(next.orders);for(const [id,o] of no){if(!isUuid(id))continue;if(!po.has(id)){const r=await db.from('orders').insert(orderInsert(o,sid));if(r.error&&r.error.code!=='23505')throw r.error}else{const u=orderUpdate(po.get(id),o);if(Object.keys(u).length){const r=await db.from('orders').update(u).eq('studio_id',sid).eq('id',id);if(r.error)throw r.error}}}await safeDelete('orders','id',[...po.keys()].filter(id=>!no.has(id)),sid);
  // Extra sales.
  const ps=salesMap(prev),ns=salesMap(next);for(const [id,s] of ns){if(!isUuid(id))continue;if(!ps.has(id)){const r=await db.from('extra_sales').insert(saleInsert(s,sid));if(r.error&&r.error.code!=='23505')throw r.error}else{const u=saleUpdate(ps.get(id),s);if(Object.keys(u).length){const r=await db.from('extra_sales').update(u).eq('studio_id',sid).eq('id',id);if(r.error)throw r.error}}}await safeDelete('extra_sales','id',[...ps.keys()].filter(id=>!ns.has(id)),sid);
  // Checklists: explicit baseline diff; no full-table mirror delete.
  const pch=prev.checklists||{},nch=next.checklists||{};for(const [oid,items] of Object.entries(nch)){if(!isUuid(oid)||eq(pch[oid],items))continue;const r=await db.from('checklists').upsert({studio_id:sid,order_id:oid,items,completed:Array.isArray(items)&&items.length>=15,updated_at:new Date().toISOString()},{onConflict:'order_id'});if(r.error)throw r.error}const removed=Object.keys(pch).filter(oid=>!(oid in nch));if(removed.length){const r=await db.from('checklists').delete().eq('studio_id',sid).in('order_id',removed);if(r.error)throw r.error}
  baseline=clone(next);ctx.studio={...(ctx.studio||{}),name:nCfg.brand||ctx.studio?.name};
}
async function drain(ctx){if(running)return;running=true;try{while(pending){const next=pending;pending=null;await syncDelta(ctx,next)}}finally{running=false}}
function install(ctx){if(global.__intornaRC11SyncInstalled)return;global.__intornaRC11SyncInstalled=true;try{baseline=clone(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{baseline={config:{},clients:[],orders:[],checklists:{}}}nativeSet=localStorage.setItem.bind(localStorage);localStorage.setItem=function(key,value){nativeSet(key,value);if(key!==KEY)return;clearTimeout(timer);timer=setTimeout(()=>{try{pending=JSON.parse(value);drain(ctx).catch(e=>{console.error('RC11 delta sync',e);global.toast?.('Falha ao sincronizar. Seus dados locais foram preservados.')})}catch(e){console.error(e)}},450)}}
C.installWorkspaceSync=install;
C.syncWorkspace=async function(ctx,workspace){pending=clone(workspace);await drain(ctx)};
global.IntornaRC11Sync={version:'11.0',getBaseline:()=>baseline?clone(baseline):null};
})(window);
