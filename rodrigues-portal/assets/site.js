/* Rodrigues Assessoria — site (JS compartilhado) */
(function(){
"use strict";

/* ===================== CONFIGURAÇÃO (edite aqui) ===================== */
var CFG = {
  whatsapp: "5521994014601",          // WhatsApp de atendimento (só números, com 55)
  leadEndpoint: "/.netlify/functions/lead-site"
};
window.RODRIGUES_CFG = CFG;

var $ = function(s,c){return (c||document).querySelector(s)};
var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
var brl = function(v,dec){return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:dec?2:0,maximumFractionDigits:dec?2:0})};
var pct = function(v){return (v*100).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%"};
function waLink(msg){return "https://wa.me/"+CFG.whatsapp+"?text="+encodeURIComponent(msg||"Olá! Vim pelo site da Rodrigues e quero falar com um especialista.")}

/* ---------- links de WhatsApp ---------- */
var pageMsg = document.body.getAttribute("data-wa") || "";
$$("[data-wa]").forEach(function(a){
  if(a===document.body) return;
  var m=a.getAttribute("data-wa")||pageMsg;
  a.setAttribute("href",waLink(m));a.setAttribute("target","_blank");a.setAttribute("rel","noopener");
});

/* ---------- header ---------- */
var hdr=$(".hdr");
function onScroll(){if(hdr)hdr.classList.toggle("scrolled",window.scrollY>8)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();

$$(".dd").forEach(function(dd){
  var b=$("button",dd),t;
  b.addEventListener("click",function(e){e.stopPropagation();dd.classList.toggle("open");b.setAttribute("aria-expanded",dd.classList.contains("open"))});
  dd.addEventListener("mouseenter",function(){clearTimeout(t);dd.classList.add("open")});
  dd.addEventListener("mouseleave",function(){t=setTimeout(function(){dd.classList.remove("open")},160)});
});
document.addEventListener("click",function(){$$(".dd.open").forEach(function(d){d.classList.remove("open")})});

var burger=$(".burger");
if(burger){
  burger.addEventListener("click",function(){var o=document.documentElement.classList.toggle("menu-open");burger.setAttribute("aria-expanded",o)});
  $$(".mnav a").forEach(function(a){a.addEventListener("click",function(){document.documentElement.classList.remove("menu-open")})});
}

/* ---------- anel da marca (desenho) ---------- */
var defs='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA23A"/><stop offset=".55" stop-color="#FF7A1A"/><stop offset="1" stop-color="#E2410F"/></linearGradient></defs></svg>';
document.body.insertAdjacentHTML("afterbegin",defs);
$$(".ring").forEach(function(r){
  r.insertAdjacentHTML("beforeend",'<svg viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M118 6 C 62 2, 10 14, 6 40 C 3 62, 52 76, 104 75 C 160 74, 196 60, 194 38 C 192 16, 150 4, 92 7 C 70 8, 52 11, 40 15"/></svg>');
});

/* ---------- reveal ---------- */
var io = "IntersectionObserver" in window ? new IntersectionObserver(function(es){
  es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");if(e.target.classList.contains("ring"))e.target.classList.add("drawn");io.unobserve(e.target)}});
},{threshold:.18,rootMargin:"0px 0px -40px 0px"}) : null;
$$(".rv,.ring,.anim").forEach(function(el){io?io.observe(el):el.classList.add("in","drawn")});

/* ---------- contadores ---------- */
$$("[data-count]").forEach(function(el){
  var end=parseFloat(el.getAttribute("data-count")),pre=el.getAttribute("data-pre")||"",suf=el.getAttribute("data-suf")||"",done=false;
  var run=function(){if(done)return;done=true;var t0=performance.now(),d=1400;
    (function f(t){var k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=pre+Math.round(end*e).toLocaleString("pt-BR")+suf;if(k<1)requestAnimationFrame(f)})(t0)};
  if(io){var o=new IntersectionObserver(function(es){if(es[0].isIntersecting){run();o.disconnect()}},{threshold:.5});o.observe(el)}else run();
});

/* ---------- sliders ---------- */
function paint(r){var p=(r.value-r.min)/(r.max-r.min)*100;r.style.setProperty("--p",p+"%")}

/* ====================================================================
   TABELAS 2026 (conferidas em 16/11/2026)
   IRPF mensal + redução da Lei 15.270/2025 · INSS teto R$ 8.475,55 ·
   salário mínimo R$ 1.621,00 · Simples Nacional Anexos I e III (LC 123)
   ==================================================================== */
var SM=1621, TETO=8475.55, SIMPLIF=607.20;
var ANEXO_I=[[180000,.04,0],[360000,.073,5940],[720000,.095,13860],[1800000,.107,22500],[3600000,.143,87300]];
var ANEXO_III=[[180000,.06,0],[360000,.112,9360],[720000,.135,17640],[1800000,.16,35640],[3600000,.21,125640],[4800000,.33,648000]];
function faixa(tab,rbt){for(var i=0;i<tab.length;i++){if(rbt<=tab[i][0])return i}return tab.length-1}
function efetiva(tab,rbt){var f=tab[faixa(tab,rbt)];if(rbt<=0)return 0;return Math.max(0,(rbt*f[1]-f[2])/rbt)}
function irProg(b){if(b<=2428.80)return 0;if(b<=2826.65)return b*.075-182.16;if(b<=3751.05)return b*.15-394.16;if(b<=4664.68)return b*.225-675.49;return b*.275-908.73}
function irMensal(base,rend){var i=Math.max(0,irProg(base)),red=0;if(rend<=5000)red=Math.min(312.89,i);else if(rend<=7350)red=Math.max(0,978.62-.133145*rend);return Math.max(0,i-red)}
window.RODRIGUES_TAX={irMensal:irMensal,efetiva:efetiva,ANEXO_I:ANEXO_I,ANEXO_III:ANEXO_III};

/* ---------- calculadora: mini mercado ---------- */
var mc=$("#calc-mercado");
if(mc){
  var f=$("#m-fat",mc),mo=$("#m-mono",mc),st=$("#m-st",mc);
  var upd=function(){
    [f,mo,st].forEach(paint);
    var fat=+f.value,pm=mo.value/100,ps=st.value/100,rbt=fat*12,fx=faixa(ANEXO_I,rbt),ef=efetiva(ANEXO_I,rbt);
    var icmsShare=fx<=1?.34:.335,pisCof=.155;
    var a=fat*pm*ef*pisCof,b=fat*ps*ef*icmsShare,tot=a+b;
    $("#m-fat-o").textContent=brl(fat);$("#m-mono-o").textContent=mo.value+"%";$("#m-st-o").textContent=st.value+"%";
    $("#m-ef").textContent=pct(ef);$("#m-pc").textContent=brl(a);$("#m-ic").textContent=brl(b);
    $("#m-tot").textContent=brl(tot);$("#m-5a").textContent=brl(tot*60);$("#m-ano").textContent=brl(tot*12);
  };
  [f,mo,st].forEach(function(r){r.addEventListener("input",upd)});upd();
}

/* ---------- calculadora: PF x PJ (médicos e autônomos) ---------- */
var pc=$("#calc-pfpj");
if(pc){
  var rr=$("#p-renda",pc);
  var calc=function(r){
    var inss=.2*Math.min(r,TETO),irpf=irMensal(r-Math.max(inss,SIMPLIF),r),pf=inss+irpf;
    var rbt=r*12,ef=efetiva(ANEXO_III,rbt),das=r*ef,pl=Math.max(.28*r,SM),inssPl=.11*Math.min(pl,TETO),irPl=irMensal(pl-Math.max(inssPl,SIMPLIF),pl);
    var dist=r-das-pl,div=dist>50000?.1*(dist-50000):0,pj=das+inssPl+irPl+div;
    return {pf:pf,inss:inss,irpf:irpf,pj:pj,das:das,ef:ef,pl:pl,inssPl:inssPl,irPl:irPl};
  };
  window.RODRIGUES_PFPJ=calc;
  var up2=function(){
    paint(rr);var r=+rr.value,c=calc(r),eco=c.pf-c.pj;
    $("#p-renda-o").textContent=brl(r);
    $("#p-pf").textContent=brl(c.pf);$("#p-pf-p").textContent=pct(c.pf/r)+" da renda";
    $("#p-pj").textContent=brl(c.pj);$("#p-pj-p").textContent=pct(c.pj/r)+" da renda";
    $("#p-pf-m").style.width=Math.min(100,c.pf/r*100/.35*1)+"%";$("#p-pj-m").style.width=Math.min(100,c.pj/r*100/.35)+"%";
    $("#p-box-pf").classList.toggle("win",eco<0);$("#p-box-pj").classList.toggle("win",eco>=0);
    $("#p-das").textContent=brl(c.das)+" ("+pct(c.ef)+")";$("#p-pl").textContent=brl(c.pl);$("#p-enc").textContent=brl(c.inssPl+c.irPl);
    var em=$("#p-eco"),lab=$("#p-eco-l");
    if(eco>=0){lab.textContent="Economia estimada como PJ";em.textContent=brl(eco)+"/mês";em.classList.add("pos");$("#p-ano").textContent=brl(eco*12);$("#p-ano-l").textContent="por ano"}
    else{lab.textContent="Nesta faixa, a pessoa física ainda compensa";em.textContent=brl(-eco)+"/mês";em.classList.remove("pos");$("#p-ano").textContent="—";$("#p-ano-l").textContent="a gente te diz isso"}
  };
  rr.addEventListener("input",up2);up2();
}

/* ---------- formulário de contato ---------- */
$$("form.form").forEach(function(fm){
  fm.addEventListener("submit",function(ev){
    ev.preventDefault();
    var btn=$("button[type=submit]",fm),err=$(".err-msg",fm);err.style.display="none";
    var d={};new FormData(fm).forEach(function(v,k){d[k]=String(v).trim()});
    d.pagina=location.pathname;d.nicho=fm.getAttribute("data-nicho")||d.perfil||"";
    if(!d.nome||!d.telefone||d.telefone.replace(/\D/g,"").length<10){err.textContent="Preencha seu nome e um WhatsApp com DDD.";err.style.display="block";return}
    var msg="Olá! Sou "+d.nome+" e acabei de pedir um diagnóstico pelo site"+(d.perfil?" ("+d.perfil+")":"")+".";
    var wa=$(".ok-wa",fm);if(wa){wa.href=waLink(msg);wa.target="_blank";wa.rel="noopener"}
    btn.disabled=true;var old=btn.innerHTML;btn.innerHTML="Enviando…";
    fetch(CFG.leadEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})
      .then(function(r){if(!r.ok)throw new Error("http "+r.status);fm.classList.add("sent")})
      .catch(function(){err.innerHTML='Não conseguimos registrar agora. <a href="'+waLink(msg)+'" target="_blank" rel="noopener" style="text-decoration:underline">Fale direto no WhatsApp →</a>';err.style.display="block"})
      .then(function(){btn.disabled=false;btn.innerHTML=old});
  });
  var phone=$("input[name=telefone]",fm);
  if(phone)phone.addEventListener("input",function(){var v=phone.value.replace(/\D/g,"").slice(0,11);
    phone.value=v.length>10?"("+v.slice(0,2)+") "+v.slice(2,7)+"-"+v.slice(7):v.length>6?"("+v.slice(0,2)+") "+v.slice(2,6)+"-"+v.slice(6):v.length>2?"("+v.slice(0,2)+") "+v.slice(2):v});
});

var y=$("#ano");if(y)y.textContent=new Date().getFullYear();
})();
