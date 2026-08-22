(function(global){
'use strict';

const C=global.IntornaCloud;
if(!C||!C.client)return;

const db=C.client,KEY=C.KEY;

const clone=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));

const PACKAGE_MAP={
  essencial:{name:'Essencial',photos:3},
  premium:{name:'Premium',photos:6},
  gold:{name:'Gold',photos:10},
  platinum:{name:'Platinum',photos:20}
};

const statusToDb={
  'Aguardando fotos':'aguardando_fotos',
  'Pagamento pendente':'pagamento_pendente',
  'Em produção':'em_producao',
  'Em revisão':'em_revisao',
  'Pronto para entrega':'pronto',
  'Entregue':'entregue',
  'Cancelado':'cancelado'
};

const payToDb={
  Pendente:'pending',
  Parcial:'confirmed',
  Pago:'received'
};

let baseline=null;
let timer=null;
let running=false;
let pending=null;
let nativeSet=localStorage.setItem.bind(localStorage);

const arr=v=>Array.isArray(v)?v:[];

const mapBy=(xs,key='id')=>
  new Map(
    arr(xs)
      .filter(x=>x&&x[key])
      .map(x=>[String(x[key]),x])
  );

const changed=(before,after,fields)=>
  fields.filter(f=>!eq(before?.[f],after?.[f]));

function clientInsert(c,sid){
  return {
    id:c.id,
    studio_id:sid,
    name:c.name,
    email:c.email||null,
    whatsapp:c.whatsapp||null,
    city:c.city||null,
    important_date:c.importantDate||null,
    notes:c.notes||null,
    whatsapp_stage:c.whatsappStage||'novo_lead',
    last_contact_at:c.lastContactAt||null,
    last_contact_note:c.lastContactNote||null,
    created_at:c.createdAt||new Date().toISOString()
  };
}

function clientUpdate(a,b){
  const m={
    name:'name',
    email:'email',
    whatsapp:'whatsapp',
    city:'city',
    importantDate:'important_date',
    notes:'notes',
    whatsappStage:'whatsapp_stage',
    lastContactAt:'last_contact_at',
    lastContactNote:'last_contact_note'
  };

  const o={};

  for(const f of changed(a,b,Object.keys(m))){
    let v=b[f];

    if([
      'email',
      'whatsapp',
      'city',
      'importantDate',
      'notes',
      'lastContactAt',
      'lastContactNote'
    ].includes(f)&&!v){
      v=null;
    }

    o[m[f]]=v;
  }

  return o;
}

function orderInsert(o,sid){
  const p=PACKAGE_MAP[o.packageId]||{
    name:o.packageId||'Pacote',
    photos:0
  };

  return {
    id:o.id,
    studio_id:sid,
    client_id:o.clientId,
    package_id:o.packageId||null,
    package_name:p.name,
    included_photos:p.photos,
    order_value:Number(o.total||0),
    essay_type:o.type||null,
    format:o.format||'4:5',
    status:statusToDb[o.status]||'aguardando_fotos',
    payment_status:payToDb[o.payment]||'pending',
    payment_method:o.paymentMethod||null,
    deadline_at:o.deadline||null,
    extra_offer_qty:Number(o.extraOfferQty||0),
    extra_strategy:o.extraStrategy||'avulsa',
    watermark_extras:o.watermarkExtras!==false,
    extras:Array.isArray(o.extras)?o.extras:[],
    notes:o.notes||null,
    created_at:o.createdAt||new Date().toISOString()
  };
}

function orderUpdate(a,b){
  const o={};

  if(a.clientId!==b.clientId){
    o.client_id=b.clientId;
  }

  if(a.packageId!==b.packageId){
    const p=PACKAGE_MAP[b.packageId]||{
      name:b.packageId||'Pacote',
      photos:0
    };

    o.package_id=b.packageId||null;
    o.package_name=p.name;
    o.included_photos=p.photos;
  }

  if(a.total!==b.total){
    o.order_value=Number(b.total||0);
  }

  if(a.type!==b.type){
    o.essay_type=b.type||null;
  }

  if(a.format!==b.format){
    o.format=b.format||'4:5';
  }

  if(a.status!==b.status){
    o.status=statusToDb[b.status]||'aguardando_fotos';
  }

  if(a.payment!==b.payment){
    o.payment_status=payToDb[b.payment]||'pending';
  }

  if(a.paymentMethod!==b.paymentMethod){
    o.payment_method=b.paymentMethod||null;
  }

  if(a.deadline!==b.deadline){
    o.deadline_at=b.deadline||null;
  }

  if(a.extraOfferQty!==b.extraOfferQty){
    o.extra_offer_qty=Number(b.extraOfferQty||0);
  }

  if(a.extraStrategy!==b.extraStrategy){
    o.extra_strategy=b.extraStrategy||'avulsa';
  }

  if(a.watermarkExtras!==b.watermarkExtras){
    o.watermark_extras=b.watermarkExtras!==false;
  }

  if(!eq(a.extras,b.extras)){
    o.extras=Array.isArray(b.extras)?b.extras:[];
  }

  if(a.notes!==b.notes){
    o.notes=b.notes||null;
  }

  return o;
}

function salesMap(ws){
  const out=new Map();

  for(const o of arr(ws?.orders)){
    for(const s of arr(o.extraSales)){
      if(s?.id){
        out.set(
          String(s.id),
          {
            ...s,
            orderId:o.id
          }
        );
      }
    }
  }

  return out;
}

function saleInsert(s,sid){
  return {
    id:s.id,
    studio_id:sid,
    order_id:s.orderId,
    quantity:Number(s.qty||1),
    amount:Number(s.value||0),
    payment_status:s.payment==='Pago'?'received':'pending',
    created_at:s.createdAt||new Date().toISOString()
  };
}

function saleUpdate(a,b){
  const o={};

  if(a.orderId!==b.orderId){
    o.order_id=b.orderId;
  }

  if(a.qty!==b.qty){
    o.quantity=Number(b.qty||1);
  }

  if(a.value!==b.value){
    o.amount=Number(b.value||0);
  }

  if(a.payment!==b.payment){
    o.payment_status=b.payment==='Pago'?'received':'pending';
  }

  return o;
}

async function safeDelete(table,idCol,ids,sid){
  if(!ids.length)return;

  const {error}=await db
    .from(table)
    .delete()
    .eq('studio_id',sid)
    .in(idCol,ids);

  if(error)throw error;
}

async function syncDelta(ctx,next){

  if(!baseline){
    baseline=clone(
      JSON.parse(
        localStorage.getItem(KEY)||'{}'
      )
    );
  }

  const prev=baseline||{};
  const sid=ctx.studioId;

  if(!sid){
    throw new Error(
      'Estúdio ausente para sincronização.'
    );
  }

  /*
   * CONFIGURAÇÕES
   * Faz merge apenas dos campos alterados localmente.
   */
  const pCfg=prev.config||{};
  const nCfg=next.config||{};

  const cfgKeys=new Set([
    ...Object.keys(pCfg),
    ...Object.keys(nCfg)
  ]);

  const cfgChanged=[
    ...cfgKeys
  ].filter(
    k=>!eq(pCfg[k],nCfg[k])
  );

  if(cfgChanged.length){

    const {
      data:studio,
      error
    }=await db
      .from('studios')
      .select('name,whatsapp,settings')
      .eq('id',sid)
      .single();

    if(error)throw error;

    const operational={
      ...(studio?.settings?.operational||{})
    };

    for(const k of cfgChanged){
      operational[k]=nCfg[k];
    }

    const upd={
      settings:{
        ...(studio?.settings||{}),
        operational
      }
    };

    if(cfgChanged.includes('brand')){
      upd.name=
        nCfg.brand
        ||studio.name
        ||'Meu Estúdio';
    }

    if(cfgChanged.includes('whatsapp')){
      upd.whatsapp=
        nCfg.whatsapp
        ||null;
    }

    const r=await db
      .from('studios')
      .update(upd)
      .eq('id',sid);

    if(r.error)throw r.error;
  }

  /*
   * CLIENTES
   */
  const pc=mapBy(prev.clients);
  const nc=mapBy(next.clients);

  for(const [id,c] of nc){

    if(!isUuid(id))continue;

    if(!pc.has(id)){

      const r=await db
        .from('clients')
        .insert(
          clientInsert(c,sid)
        );

      if(
        r.error
        &&r.error.code!=='23505'
      ){
        throw r.error;
      }

    }else{

      const u=
        clientUpdate(
          pc.get(id),
          c
        );

      if(Object.keys(u).length){

        const r=await db
          .from('clients')
          .update(u)
          .eq('studio_id',sid)
          .eq('id',id);

        if(r.error){
          throw r.error;
        }
      }
    }
  }

  await safeDelete(
    'clients',
    'id',
    [...pc.keys()]
      .filter(id=>!nc.has(id)),
    sid
  );

  /*
   * PEDIDOS
   */
  const po=mapBy(prev.orders);
  const no=mapBy(next.orders);

  for(const [id,o] of no){

    if(!isUuid(id))continue;

    if(!po.has(id)){

      const r=await db
        .from('orders')
        .insert(
          orderInsert(o,sid)
        );

      if(
        r.error
        &&r.error.code!=='23505'
      ){
        throw r.error;
      }

    }else{

      const u=
        orderUpdate(
          po.get(id),
          o
        );

      if(Object.keys(u).length){

        const r=await db
          .from('orders')
          .update(u)
          .eq('studio_id',sid)
          .eq('id',id);

        if(r.error){
          throw r.error;
        }
      }
    }
  }

  await safeDelete(
    'orders',
    'id',
    [...po.keys()]
      .filter(id=>!no.has(id)),
    sid
  );

  /*
   * VENDAS EXTRAS
   */
  const ps=salesMap(prev);
  const ns=salesMap(next);

  for(const [id,s] of ns){

    if(!isUuid(id))continue;

    if(!ps.has(id)){

      const r=await db
        .from('extra_sales')
        .insert(
          saleInsert(s,sid)
        );

      if(
        r.error
        &&r.error.code!=='23505'
      ){
        throw r.error;
      }

    }else{

      const u=
        saleUpdate(
          ps.get(id),
          s
        );

      if(Object.keys(u).length){

        const r=await db
          .from('extra_sales')
          .update(u)
          .eq('studio_id',sid)
          .eq('id',id);

        if(r.error){
          throw r.error;
        }
      }
    }
  }

  await safeDelete(
    'extra_sales',
    'id',
    [...ps.keys()]
      .filter(id=>!ns.has(id)),
    sid
  );

  /*
   * CHECKLISTS
   */
  const pch=prev.checklists||{};
  const nch=next.checklists||{};

  for(
    const [oid,items]
    of Object.entries(nch)
  ){

    if(
      !isUuid(oid)
      ||eq(pch[oid],items)
    ){
      continue;
    }

    const r=await db
      .from('checklists')
      .upsert(
        {
          studio_id:sid,
          order_id:oid,
          items,
          completed:
            Array.isArray(items)
            &&items.length>=15,
          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:'order_id'
        }
      );

    if(r.error){
      throw r.error;
    }
  }

  const removed=
    Object.keys(pch)
      .filter(
        oid=>!(oid in nch)
      );

  if(removed.length){

    const r=await db
      .from('checklists')
      .delete()
      .eq('studio_id',sid)
      .in('order_id',removed);

    if(r.error){
      throw r.error;
    }
  }

  baseline=clone(next);

  ctx.studio={
    ...(ctx.studio||{}),
    name:
      nCfg.brand
      ||ctx.studio?.name
  };
}

async function drain(ctx){

  if(running)return;

  running=true;

  try{

    while(pending){

      const next=pending;

      pending=null;

      await syncDelta(
        ctx,
        next
      );
    }

  }finally{

    running=false;
  }
}

function install(ctx){

  if(
    global.__intornaRC11SyncInstalled
  ){
    return;
  }

  global.__intornaRC11SyncInstalled=true;

  try{

    baseline=clone(
      JSON.parse(
        localStorage.getItem(KEY)||'{}'
      )
    );

  }catch{

    baseline={
      config:{},
      clients:[],
      orders:[],
      checklists:{}
    };
  }

  nativeSet=
    localStorage.setItem.bind(
      localStorage
    );

  localStorage.setItem=
    function(key,value){

      nativeSet(
        key,
        value
      );

      if(key!==KEY){
        return;
      }

      clearTimeout(timer);

      timer=setTimeout(
        ()=>{

          try{

            pending=
              JSON.parse(value);

            drain(ctx)
              .catch(
                e=>{

                  console.error(
                    'RC11 delta sync',
                    e
                  );

                  global.toast?.(
                    'Falha ao sincronizar. Seus dados locais foram preservados.'
                  );
                }
              );

          }catch(e){

            console.error(e);
          }

        },
        450
      );
    };
}

C.installWorkspaceSync=install;

C.syncWorkspace=
  async function(ctx,workspace){

    pending=clone(workspace);

    await drain(ctx);
  };

global.IntornaRC11Sync={
  version:'11.0',

  getBaseline:()=>
    baseline
      ?clone(baseline)
      :null
};

})(window);


/* =========================================================
   BOOTSTRAP CLOUD
   ========================================================= */

(async function(){

  'use strict';

  const loading=
    document.createElement('div');

  loading.id='cloudLoading';

  loading.style.cssText=
    'position:fixed;inset:0;z-index:9999;background:#0B132B;color:white;display:grid;place-items:center;font-family:Inter,system-ui;text-align:center;padding:30px';

  loading.innerHTML=`
    <div>
      <div style="font-size:42px">
        ☁️
      </div>

      <h2>
        Conectando ao Intorná Pixels…
      </h2>

      <p style="opacity:.75">
        Carregando seu estúdio e sincronizando os dados.
      </p>
    </div>
  `;

  document.body.appendChild(
    loading
  );

  try{

    const ctx=
      await IntornaCloud.requireStudio();

    if(!ctx)return;

    const workspace=
      await IntornaCloud.hydrateWorkspace(
        ctx
      );

    localStorage.setItem(
      IntornaCloud.KEY,
      JSON.stringify(
        workspace
      )
    );

    IntornaCloud.installWorkspaceSync(
      ctx
    );

    const script=
      document.createElement(
        'script'
      );

    script.src='app.js?v=22.0.2';

    script.onload=
      async()=>{

        /*
         * IMPORTANTE
         * Libera o contexto do estúdio para os módulos.
         */
        window.INTORNA_CTX=ctx;


        /* =========================
           FEATURES V6
           ========================= */

        const v6=
          document.createElement(
            'script'
          );

        v6.src='features-v6.js?v=22.0.2';
        v6.async=false;

        document.body.appendChild(
          v6
        );


        /* =========================
           FEATURES V7
           WhatsApp Inbox
           ========================= */

        const v7=
          document.createElement(
            'script'
          );

        v7.src='features-v7.js?v=22.0.2';
        v7.async=false;

        document.body.appendChild(
          v7
        );


        /* =========================
           FEATURES V11
           Marketing Performance
           ========================= */

        const v11=
          document.createElement(
            'script'
          );

        v11.src='features-v11.js?v=22.0.2';
        v11.async=false;

        document.body.appendChild(
          v11
        );


        /* =========================
           FEATURES V12
           CONTAS REAIS DE TRÁFEGO
           Meta Ads + Google Ads
           ========================= */

        const v12=
          document.createElement(
            'script'
          );

        v12.src='features-v12.js?v=22.0.2';
        v12.async=false;

        document.body.appendChild(
          v12
        );


        /* =========================
           TESTE WAHA - MASTER
           ========================= */

        if(ctx.isAdmin){

          const waha=
            document.createElement(
              'script'
            );

          waha.src=
            'features-waha-test.js?v=22.0.2';

          waha.async=false;

          document.body.appendChild(
            waha
          );
        }


        /*
         * Remove tela de carregamento.
         */
        loading.remove();


        /* =========================
           TOPO DO SISTEMA
           ========================= */

        const top=
          document.querySelector(
            '.top-actions'
          );

        if(top){

          const badge=
            document.createElement(
              'div'
            );

          badge.className=
            'tenant-user';

          badge.innerHTML=`
            <small>
              ${
                escapeHtml(
                  ctx.user
                    .user_metadata
                    ?.full_name
                  ||ctx.user.email
                  ||'Usuário'
                )
              }
            </small>

            <b>
              ${
                escapeHtml(
                  ctx.studio.name
                )
              }
              •
              ${
                escapeHtml(
                  ctx.studio.plan_id
                  ||'free'
                )
              }
            </b>
          `;

          top.prepend(
            badge
          );


          /*
           * Modo impersonação
           */
          if(ctx.impersonating){

            const back=
              document.createElement(
                'button'
              );

            back.className=
              'btn outline';

            back.textContent=
              'Voltar ao Admin';

            back.onclick=
              ()=>{

                localStorage
                  .removeItem(
                    'intorna_impersonate_studio'
                  );

                location.href=
                  '/admin/';
              };

            top.appendChild(
              back
            );
          }


          /*
           * Botão sair
           */
          const btn=
            document.createElement(
              'button'
            );

          btn.className=
            'btn danger';

          btn.textContent=
            'Sair';

          btn.onclick=
            ()=>IntornaCloud.signOut();

          top.appendChild(
            btn
          );
        }


        /* =========================
           AVISOS
           ========================= */

        try{

          const ns=
            await IntornaCloud.notices(
              ctx
            );

          const dash=
            document.getElementById(
              'dashboard'
            );

          if(
            dash
            &&ns.length
          ){

            const wrap=
              document.createElement(
                'div'
              );

            wrap.className=
              'notice-stack';

            wrap.innerHTML=
              ns.map(
                n=>`
                  <div class="tenant-notice">

                    <b>
                      ${
                        escapeHtml(
                          n.title
                        )
                      }
                    </b>

                    <span>
                      ${
                        escapeHtml(
                          n.body
                        )
                      }
                    </span>

                  </div>
                `
              ).join('');

            dash.prepend(
              wrap
            );
          }

        }catch(e){

          console.warn(e);
        }


        /* =========================
           SUPORTE
           ========================= */

        const form=
          document.getElementById(
            'supportForm'
          );

        if(form){

          form.onsubmit=
            async e=>{

              e.preventDefault();

              try{

                await IntornaCloud
                  .sendTicket(
                    ctx,
                    {
                      subject:
                        document
                          .getElementById(
                            'supSubject'
                          )
                          .value
                          .trim(),

                      message:
                        document
                          .getElementById(
                            'supMessage'
                          )
                          .value
                          .trim(),

                      priority:
                        document
                          .getElementById(
                            'supPriority'
                          )
                          .value
                    }
                  );

                form.reset();

                window.toast?.(
                  'Chamado enviado.'
                );

                await renderTickets();

              }catch(ex){

                window.toast?.(
                  ex.message
                  ||'Falha ao enviar chamado.'
                );
              }
            };
        }


        async function renderTickets(){

          const box=
            document.getElementById(
              'myTickets'
            );

          if(!box)return;

          try{

            const items=
              await IntornaCloud
                .listTickets(ctx);

            box.innerHTML=
              items.length
                ?items.map(
                  t=>`
                    <div class="library-item">

                      <div
                        class="row"
                        style="
                          justify-content:
                          space-between
                        "
                      >

                        <b>
                          ${
                            escapeHtml(
                              t.subject
                            )
                          }
                        </b>

                        <span
                          class="pill ${
                            t.status==='closed'
                              ?'ok'
                              :t.status==='in_progress'
                                ?'warn'
                                :''
                          }"
                        >
                          ${
                            t.status==='closed'
                              ?'Resolvido'
                              :t.status==='in_progress'
                                ?'Em atendimento'
                                :'Aberto'
                          }
                        </span>

                      </div>

                      <p>
                        ${
                          escapeHtml(
                            t.message
                          )
                        }
                      </p>

                      ${
                        t.admin_response
                          ?`
                            <p>
                              <b>
                                Resposta:
                              </b>

                              ${
                                escapeHtml(
                                  t.admin_response
                                )
                              }
                            </p>
                          `
                          :''
                      }

                      <small class="muted">
                        ${
                          new Date(
                            t.created_at
                          )
                          .toLocaleString(
                            'pt-BR'
                          )
                        }
                      </small>

                    </div>
                  `
                ).join('')
                :`
                  <div class="empty">
                    Nenhum chamado enviado.
                  </div>
                `;

          }catch(e){

            box.innerHTML=`
              <div class="empty">
                Não foi possível carregar os chamados.
              </div>
            `;
          }
        }


        /* =========================
           ASSINATURA / ASAAS
           ========================= */

        async function installBilling(){

          const checkoutBox=
            document.getElementById(
              'billingCheckout'
            );

          const method=
            document.getElementById(
              'billingMethod'
            );

          if(
            !checkoutBox
            ||!method
          ){
            return;
          }


          async function refreshBilling(){

            try{

              const [
                subs,
                pays
              ]=await Promise.all([
                IntornaCloud
                  .listSubscriptions(ctx),

                IntornaCloud
                  .listBillingPayments(ctx)
              ]);

              const current=
                subs.find(
                  s=>[
                    'active',
                    'ACTIVE',
                    'pending'
                  ].includes(
                    String(s.status)
                  )
                )
                ||subs[0];

              if(current){

                const last=
                  pays.find(
                    p=>
                      p.subscription_id
                      ===current.id
                  )
                  ||pays[0];

                checkoutBox.style.display=
                  'block';

                checkoutBox.innerHTML=`
                  <div
                    class="row"
                    style="
                      justify-content:
                      space-between;
                      align-items:
                      flex-start
                    "
                  >

                    <div>

                      <h2>
                        Assinatura
                      </h2>

                      <p>
                        <b>
                          Plano:
                        </b>

                        ${
                          escapeHtml(
                            current.plan_id
                          )
                        }

                        &nbsp;

                        <b>
                          Status:
                        </b>

                        ${
                          escapeHtml(
                            current.status
                          )
                        }
                      </p>

                      ${
                        last
                          ?`
                            <p class="muted">

                              Última cobrança:

                              ${
                                Number(
                                  last.amount
                                  ||0
                                )
                                .toLocaleString(
                                  'pt-BR',
                                  {
                                    style:
                                      'currency',
                                    currency:
                                      'BRL'
                                  }
                                )
                              }

                              •

                              ${
                                escapeHtml(
                                  last.status
                                  ||''
                                )
                              }

                            </p>
                          `
                          :''
                      }

                    </div>

                    ${
                      [
                        'active',
                        'ACTIVE',
                        'pending'
                      ].includes(
                        String(
                          current.status
                        )
                      )
                        ?`
                          <button
                            id="cancelBillingBtn"
                            class="btn danger"
                          >
                            Cancelar assinatura
                          </button>
                        `
                        :''
                    }

                  </div>

                  ${
                    last?.invoice_url
                      ?`
                        <a
                          class="btn gold"
                          style="
                            display:inline-block;
                            text-decoration:none;
                            margin-top:10px
                          "
                          href="${
                            escapeHtml(
                              last.invoice_url
                            )
                          }"
                          target="_blank"
                          rel="noopener"
                        >
                          Abrir cobrança
                        </a>
                      `
                      :''
                  }
                `;


                const cancel=
                  document.getElementById(
                    'cancelBillingBtn'
                  );

                if(cancel){

                  cancel.onclick=
                    async()=>{

                      if(
                        !confirm(
                          'Cancelar esta assinatura e retornar ao plano gratuito?'
                        )
                      ){
                        return;
                      }

                      try{

                        await IntornaCloud
                          .cancelSubscription(
                            current.id
                          );

                        window.toast?.(
                          'Assinatura cancelada.'
                        );

                        location.reload();

                      }catch(e){

                        window.toast?.(
                          e.message
                          ||'Falha ao cancelar.'
                        );
                      }
                    };
                }
              }

            }catch(e){

              console.warn(
                'billing status',
                e
              );
            }
          }


          /*
           * Função global usada pelos botões dos planos.
           */
          window.selectPlan=
            async id=>{

              const labels={
                start:'Start',
                pro:'Pro',
                studio:'Studio',
                free:'Gratuito'
              };

              if(id==='free'){

                window.toast?.(
                  'O plano Gratuito não gera cobrança. Cancele uma assinatura ativa para retornar a ele.'
                );

                return;
              }

              if(
                !confirm(
                  `Contratar o plano ${
                    labels[id]||id
                  } com pagamento via ${
                    method.options[
                      method.selectedIndex
                    ].text
                  }?`
                )
              ){
                return;
              }

              checkoutBox.style.display=
                'block';

              checkoutBox.innerHTML=`
                <h2>
                  Gerando cobrança…
                </h2>

                <p class="muted">
                  Aguarde a confirmação do Asaas.
                </p>
              `;

              try{

                const result=
                  await IntornaCloud
                    .createSubscription(
                      ctx,
                      id,
                      method.value
                    );

                const c=
                  result.checkout
                  ||{};

                let extra='';


                if(c.pixEncodedImage){

                  extra+=`
                    <img
                      alt="QR Code Pix"
                      style="
                        width:min(260px,100%);
                        display:block;
                        margin:16px auto;
                        border-radius:12px
                      "
                      src="data:image/png;base64,${
                        c.pixEncodedImage
                      }"
                    >
                  `;
                }


                if(c.pixPayload){

                  extra+=`
                    <label>
                      Pix Copia e Cola
                    </label>

                    <textarea
                      id="pixPayloadBox"
                      readonly
                    >${
                      escapeHtml(
                        c.pixPayload
                      )
                    }</textarea>

                    <button
                      class="btn ghost"
                      id="copyPixBtn"
                    >
                      Copiar Pix
                    </button>
                  `;
                }


                if(c.invoiceUrl){

                  extra+=`
                    <a
                      class="btn gold"
                      style="
                        display:inline-block;
                        text-decoration:none;
                        margin-top:12px
                      "
                      href="${
                        escapeHtml(
                          c.invoiceUrl
                        )
                      }"
                      target="_blank"
                      rel="noopener"
                    >
                      Abrir página de pagamento
                    </a>
                  `;
                }


                checkoutBox.innerHTML=`
                  <h2>
                    Cobrança criada
                  </h2>

                  <p>
                    Plano
                    <b>
                      ${
                        escapeHtml(
                          labels[id]||id
                        )
                      }
                    </b>.

                    O plano será liberado
                    automaticamente após
                    a confirmação do pagamento.
                  </p>

                  ${
                    c.dueDate
                      ?`
                        <p class="muted">

                          Vencimento:

                          ${
                            new Date(
                              c.dueDate
                              +'T12:00:00'
                            )
                            .toLocaleDateString(
                              'pt-BR'
                            )
                          }

                        </p>
                      `
                      :''
                  }

                  ${
                    extra
                    ||`
                      <p class="muted">
                        A cobrança foi criada.
                        O link ficará disponível
                        assim que o Asaas gerar
                        a primeira mensalidade.
                      </p>
                    `
                  }
                `;


                const cp=
                  document.getElementById(
                    'copyPixBtn'
                  );

                if(cp){

                  cp.onclick=
                    async()=>{

                      await navigator
                        .clipboard
                        .writeText(
                          c.pixPayload
                        );

                      window.toast?.(
                        'Pix copiado.'
                      );
                    };
                }

              }catch(e){

                checkoutBox.innerHTML=`
                  <h2>
                    Não foi possível gerar a cobrança
                  </h2>

                  <p>
                    ${
                      escapeHtml(
                        e.message
                        ||'Erro no pagamento.'
                      )
                    }
                  </p>
                `;
              }
            };


          await refreshBilling();
        }


        /*
         * Inicializações finais.
         */
        await renderTickets();
        await installBilling();
      };


    script.onerror=
      ()=>{

        loading.innerHTML=`
          <div>
            <h2>
              Falha ao abrir a área operacional.
            </h2>

            <p>
              Atualize a página.
            </p>
          </div>
        `;
      };


    document.body.appendChild(
      script
    );


  }catch(e){

    console.error(e);

    loading.innerHTML=`
      <div>

        <h2>
          Não foi possível carregar o estúdio.
        </h2>

        <p>
          ${
            escapeHtml(
              e.message
              ||'Erro de conexão.'
            )
          }
        </p>

        <button
          onclick="location.href='/portal/'"
          style="
            padding:12px 20px;
            border:0;
            border-radius:10px;
            font-weight:800
          "
        >
          Voltar ao login
        </button>

      </div>
    `;
  }


  function escapeHtml(v=''){

    return String(v)
      .replace(
        /[&<>'"]/g,
        c=>({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          "'":'&#39;',
          '"':'&quot;'
        }[c])
      );
  }

})();
