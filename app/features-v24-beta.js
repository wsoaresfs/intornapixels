(()=>{
'use strict';
if(window.__INTORNA_RC24_BETA__)return;
const $=(s,r=document)=>r.querySelector(s);
const VERSION='22.4.0';

function addStyles(){
 const style=document.createElement('style');style.textContent=`
.ip24-beta-bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;margin-bottom:14px;border:1px solid #fde68a;border-radius:14px;background:linear-gradient(135deg,#fffbeb,#f5f3ff);color:#713f12}.ip24-beta-bar b{display:block;font-size:13px}.ip24-beta-bar small{display:block;margin-top:3px;color:#6b7280}.ip24-actions{display:flex;gap:7px;flex-wrap:wrap}.ip24-btn{border:0;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer}.ip24-primary{background:#6d28d9;color:#fff}.ip24-ghost{background:#fff;color:#334155;border:1px solid #cbd5e1}.ip24-modal{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.74)}.ip24-modal[hidden]{display:none}.ip24-box{width:min(620px,100%);max-height:92vh;overflow:auto;border-radius:22px;background:#fff;box-shadow:0 30px 90px #0008;padding:25px}.ip24-kicker{font-size:11px;font-weight:950;letter-spacing:.09em;color:#6d28d9}.ip24-box h2{margin:7px 0 8px;font-size:26px}.ip24-box>p{color:#64748b;line-height:1.55}.ip24-steps{display:grid;gap:9px;margin:18px 0}.ip24-step{display:flex;gap:12px;padding:12px;border:1px solid #e2e8f0;border-radius:13px}.ip24-step span{display:grid;place-items:center;flex:0 0 30px;height:30px;border-radius:50%;background:#ede9fe;color:#5b21b6;font-weight:950}.ip24-step b{display:block}.ip24-step small{display:block;margin-top:3px;color:#64748b;line-height:1.35}.ip24-plan{color:#166534!important}.ip24-feedback-float{position:fixed;right:18px;bottom:18px;z-index:9000;border:0;border-radius:999px;padding:12px 16px;background:#111827;color:#fff;font-weight:900;box-shadow:0 10px 30px #0004;cursor:pointer}@media(max-width:680px){.ip24-beta-bar{align-items:flex-start;flex-direction:column}.ip24-feedback-float{right:10px;bottom:10px}.ip24-box{padding:20px}}
 `;document.head.appendChild(style);
}
function openCreative(){window.goPage?.('creative-performance');setTimeout(()=>$('#ip22Idea')?.focus(),250)}
function openFeedback(){
 window.goPage?.('suporte');setTimeout(()=>{
  const subject=$('#supSubject'),priority=$('#supPriority'),message=$('#supMessage');
  if(subject)subject.value='Feedback do beta — fluxo de criativos';
  if(priority)priority.value='medium';
  if(message&&!message.value)message.value='O que eu tentei fazer:\n\nO que funcionou bem:\n\nOnde fiquei com dúvida ou ocorreu erro:\n\nSugestão de melhoria:';
  message?.focus();
 },180);
}
function closeOnboarding(){const modal=$('#ip24Onboarding');if(modal)modal.hidden=true;const uid=window.INTORNA_CTX?.user?.id||'user';localStorage.setItem(`intorna_beta_onboarding_${uid}`,'done')}
function showOnboarding(force=false){const uid=window.INTORNA_CTX?.user?.id||'user';if(!force&&localStorage.getItem(`intorna_beta_onboarding_${uid}`)==='done')return;const modal=$('#ip24Onboarding');if(modal)modal.hidden=false}
function install(){
 if(window.__INTORNA_RC24_BETA__)return true;
 if(!window.INTORNA_CTX||!$('.container')||!$('.nav'))return false;
 window.__INTORNA_RC24_BETA__=true;addStyles();
 const subButton=$('.nav [data-page="assinatura"]');if(subButton)subButton.hidden=true;
 const subPage=$('#assinatura');if(subPage)subPage.hidden=true;
 const sidePlan=$('#sidePlan');if(sidePlan){sidePlan.textContent='Beta gratuito';sidePlan.classList.add('ip24-plan')}
 const dashPlan=$('#dashPlan');if(dashPlan){dashPlan.textContent='Beta gratuito';dashPlan.classList.add('ip24-plan')}
 const dashLimit=$('#dashLimit');if(dashLimit)dashLimit.textContent='Acesso liberado para testes • sem cobrança';
 const planCard=[...document.querySelectorAll('#dashboard .card')].find(x=>x.querySelector('#dashPlan'));if(planCard){const btn=planCard.querySelector('button');if(btn){btn.textContent='Como testar o beta';btn.onclick=()=>showOnboarding(true)}}

 const bar=document.createElement('div');bar.className='ip24-beta-bar';bar.innerHTML='<div><b>🧪 Você está no beta fechado RC22.4</b><small>Teste principal: escreva um assunto, gere a arte e leve para avaliação na Meta. Nenhuma cobrança será feita.</small></div><div class="ip24-actions"><button class="ip24-btn ip24-primary" id="ip24Create">Criar anúncio</button><button class="ip24-btn ip24-ghost" id="ip24Help">Ver guia</button><button class="ip24-btn ip24-ghost" id="ip24Feedback">Enviar feedback</button></div>';
 $('.container').prepend(bar);$('#ip24Create').onclick=openCreative;$('#ip24Help').onclick=()=>showOnboarding(true);$('#ip24Feedback').onclick=openFeedback;
 const modal=document.createElement('div');modal.id='ip24Onboarding';modal.className='ip24-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ip24Title');modal.innerHTML='<div class="ip24-box"><div class="ip24-kicker">BEM-VINDO AO BETA INTORNÁ</div><h2 id="ip24Title">Seu primeiro criativo em 3 passos</h2><p>Você não precisa saber escrever prompts. Comece com o assunto do anúncio e siga o fluxo indicado na tela.</p><div class="ip24-steps"><div class="ip24-step"><span>1</span><div><b>Conte o assunto</b><small>Ex.: “ensaio de formatura para quem se formou na pandemia, 10 fotos por R$ 35”.</small></div></div><div class="ip24-step"><span>2</span><div><b>Gere ou importe a arte</b><small>Use sua própria chave de API para gerar no app ou abra o ChatGPT, cole o prompt e importe a imagem pronta.</small></div></div><div class="ip24-step"><span>3</span><div><b>Avalie na Meta e faça a V2</b><small>Leve a arte para a Meta AI, cole a avaliação no Intorná e gere a versão melhorada.</small></div></div></div><div class="ip24-actions"><button class="ip24-btn ip24-primary" id="ip24Start">Começar meu criativo</button><button class="ip24-btn ip24-ghost" id="ip24Later">Explorar o painel</button></div></div>';
 document.body.appendChild(modal);$('#ip24Start').onclick=()=>{closeOnboarding();openCreative()};$('#ip24Later').onclick=closeOnboarding;
 const float=document.createElement('button');float.className='ip24-feedback-float';float.textContent='💬 Feedback do beta';float.onclick=openFeedback;document.body.appendChild(float);
 window.IntornaRC24Beta={version:VERSION,guide:()=>showOnboarding(true),feedback:openFeedback};setTimeout(()=>showOnboarding(false),500);return true;
}
let tries=0;const boot=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(boot)},250);
})();
