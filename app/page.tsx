'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {ChatComposer,ChatDictationButton,ChatMessage,ChatMessageBubble,ChatMessageList,useChatDictation} from '@astryxdesign/core/Chat';
import {Activity as ActivityIcon,ArrowLeftRight,ArrowUp,Camera,ChevronRight,CircleDollarSign,FileText,Home,Landmark,Mail,MessageCircleMore,Plus,ReceiptText,ScanLine,ShoppingBag,Sparkles,Upload,Wallet,WalletCards} from 'lucide-react';
import {seedTransactions,type Tx} from './data';

type View='home'|'activity'|'add'|'accounts';
type Msg={role:'user'|'assistant',text:string};
const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const currentMonth='2026-09';
const previousMonth='2026-08';

export default function Page(){
 const [view,setView]=useState<View>('home');
 const [agentOpen,setAgentOpen]=useState(false);
 const [txs,setTxs]=useState<Tx[]>(seedTransactions);
 const [msgs,setMsgs]=useState<Msg[]>([]);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [manual,setManual]=useState({name:'',amount:'',category:'',source:'Efectivo'});
 const scanRef=useRef<HTMLInputElement>(null); const pdfRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const saved=localStorage.getItem('finanzas.txs.v2'); if(saved) try{setTxs(JSON.parse(saved))}catch{}},[]);
 useEffect(()=>{localStorage.setItem('finanzas.txs.v2',JSON.stringify(txs))},[txs]);
 const monthTxs=useMemo(()=>txs.filter(t=>t.date.startsWith(currentMonth)),[txs]);
 const monthTotal=useMemo(()=>monthTxs.reduce((s,t)=>s+t.amount,0),[monthTxs]);
 const previousTotal=useMemo(()=>txs.filter(t=>t.date.startsWith(previousMonth)).reduce((s,t)=>s+t.amount,0),[txs]);
 const addTx=(t:Omit<Tx,'id'>)=>setTxs(v=>[{...t,id:crypto.randomUUID()},...v]);
 const ask=async(q:string)=>{
   const clean=q.trim(); if(!clean||busy)return;
   setMsgs(v=>[...v,{role:'user',text:clean}]);
   const n=clean.toLocaleLowerCase('es-AR');
   const action=(target:View,label:string)=>{setView(target);setMsgs(v=>[...v,{role:'assistant',text:`Listo. Abrí ${label}.`}]);};
   if(/\b(cargar|carga|agregar gasto|nuevo gasto|sumar gasto)\b/.test(n)){action('add','Cargar');return;}
   if(/\b(actividad|resumen|cómo voy|como voy|qué gasté|que gaste)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('activity','Cómo va mi actividad');return;}
   if(/\b(cuentas|fuentes|tarjetas|billeteras|bancos)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('accounts','Mis cuentas y fuentes');return;}
   setBusy(true);try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:clean,context:{today:'2026-09-26',currentScreen:view,transactions:txs,summary:{monthTotal,previousTotal,upcoming:[{name:'Visa Santander',date:'2026-10-03',amount:684320},{name:'Colegio San José',date:'2026-10-05',amount:185000},{name:'Servicios',date:'2026-10-08',amount:90170}]}}})});const d=await r.json();setMsgs(v=>[...v,{role:'assistant',text:d.answer||d.error||'No pude responder.'}])}catch{setMsgs(v=>[...v,{role:'assistant',text:'No pude conectar con el servidor.'}])}finally{setBusy(false)}
 };
 const scan=async(file:File)=>{setBusy(true);setNotice('Leyendo comprobante…');try{const image=await fileToDataUrl(file);const r=await fetch('/api/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});const d=await r.json();if(!r.ok)throw new Error(d.error);const x=d.result;addTx({name:x.merchant||'Comprobante',amount:Number(x.amount)||0,date:x.date||new Date().toISOString().slice(0,10),category:x.category||'Otros',source:x.paymentMethod||'Ticket escaneado',notes:x.notes||''});setNotice(`Listo: ${x.merchant||'comprobante'} · ${money(Number(x.amount)||0)}`)}catch(e){setNotice(e instanceof Error?e.message:'No pude leer el ticket.')}finally{setBusy(false)}};
 const pdf=async(file:File)=>{setBusy(true);setNotice('Analizando PDF…');try{const f=new FormData();f.append('file',file);const r=await fetch('/api/pdf',{method:'POST',body:f});const d=await r.json();if(!r.ok)throw new Error(d.error);const arr=Array.isArray(d.result.transactions)?d.result.transactions:[];arr.forEach((x:any)=>addTx({name:x.merchant||'Movimiento PDF',amount:Number(x.amount)||0,date:x.date||new Date().toISOString().slice(0,10),category:x.category||'Otros',source:file.name,notes:x.notes||''}));setNotice(`${d.result.summary||'PDF analizado'}. Importé ${arr.length} movimientos.`)}catch(e){setNotice(e instanceof Error?e.message:'No pude analizar el PDF.')}finally{setBusy(false)}};
 return <Theme theme={neutralTheme} mode="light"><div className="app-shell">
   <aside className="desktop-sidebar">
     <div className="desktop-brand"><span>FINANZAS</span><strong>Cifra</strong></div>
     <div className="desktop-menu">
       <button className={view==='home'?'active':''} onClick={()=>setView('home')}><Home size={19}/><span>Inicio</span></button>
       <button className={view==='activity'?'active':''} onClick={()=>setView('activity')}><ActivityIcon size={19}/><span>Actividad</span></button>
       <button className={view==='add'?'active':''} onClick={()=>setView('add')}><Plus size={19}/><span>Cargar</span></button>
       <button className={view==='accounts'?'active':''} onClick={()=>setView('accounts')}><WalletCards size={19}/><span>Fuentes</span></button>
     </div>
     <button className="desktop-agent" onClick={()=>setAgentOpen(true)}><Sparkles size={19}/><div><b>Asistente</b><small>Preguntá o pedile una acción</small></div></button>
   </aside>
   <main className="shell">
     <header className="desktop-topbar"><div><span>FINANZAS PERSONALES</span><h1>{view==='home'?'Panel general':view==='activity'?'Cómo va mi actividad':view==='add'?'Cargar':'Mis cuentas y fuentes'}</h1></div><button className="account-btn" onClick={()=>setView('accounts')}><Wallet size={19}/></button></header>
     {view!=='home'&&<header className="top mobile-only"><div><span className="eyebrow">FINANZAS</span><h1>{view==='activity'?'Cómo va mi actividad':view==='add'?'Cargar':'Mis cuentas y fuentes'}</h1></div><button className="account-btn" onClick={()=>setView('accounts')}><Wallet size={19}/></button></header>}
     {view==='home'&&<HomeView monthTotal={monthTotal} previousTotal={previousTotal} txs={txs} go={setView} openAgent={()=>setAgentOpen(true)}/>} 
     {view==='activity'&&<Activity txs={txs} monthTotal={monthTotal} previousTotal={previousTotal}/>} 
     {view==='add'&&<Add manual={manual} setManual={setManual} addTx={addTx} scanRef={scanRef} pdfRef={pdfRef} scan={scan} pdf={pdf} notice={notice} setNotice={setNotice} busy={busy}/>} 
     {view==='accounts'&&<Accounts go={setView}/>} 
     <button className={`agent-fab ${agentOpen?'agent-fab-open':''}`} onClick={()=>setAgentOpen(v=>!v)} aria-label="Abrir asistente"><Sparkles size={20}/><span>Asistente</span></button>
     {agentOpen&&<><button className="agent-backdrop" aria-label="Cerrar asistente" onClick={()=>setAgentOpen(false)}/><section className="agent-panel"><div className="agent-panel-head"><div><span>ASISTENTE</span><h2>¿Qué querés hacer?</h2></div><button onClick={()=>setAgentOpen(false)} aria-label="Cerrar">×</button></div><Ask msgs={msgs} ask={ask} busy={busy} panel/></section></>}
     <nav className="nav"><Nav icon={Home} label="Inicio" active={view==='home'} click={()=>setView('home')}/><Nav icon={ActivityIcon} label="Actividad" active={view==='activity'} click={()=>setView('activity')}/><button className="plus" onClick={()=>setView('add')}><Plus size={24}/></button><Nav icon={WalletCards} label="Fuentes" active={view==='accounts'} click={()=>setView('accounts')}/><Nav icon={MessageCircleMore} label="Asistente" active={agentOpen} click={()=>setAgentOpen(true)}/></nav>
   </main>
 </div></Theme>
}

function HomeView({monthTotal,previousTotal,txs,go,openAgent}:{monthTotal:number;previousTotal:number;txs:Tx[];go:(v:View)=>void;openAgent:()=>void}){
 const [videoOk,setVideoOk]=useState(false);
 const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):0;
 const top=Object.entries(txs.filter(t=>t.date.startsWith(currentMonth)).reduce<Record<string,number>>((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,3);
 return <section className="home-stack">
   <div className="home-top-grid">
     <div className={`video-hero ${videoOk?'':'video-fallback'}`}>
       <video autoPlay muted playsInline loop preload="metadata" src="/intro-finanzas.mp4" onCanPlay={()=>setVideoOk(true)} onError={()=>setVideoOk(false)}/>
       <div className="video-shade"/>
       <div className="video-copy"><span className="video-kicker">TU PLATA, MÁS CLARA</span><h1>Entendé qué pasa con tu dinero.</h1><p>Sin planillas. Sin vueltas.</p></div>
     </div>
     <div className="home-rail">
       <div className="primary-actions">
         <button className="primary-action load" onClick={()=>go('add')}><span><ScanLine/></span><div><b>Cargar</b><small>Ticket, PDF, gasto o cuenta</small></div><ChevronRight/></button>
         <button className="primary-action activity" onClick={()=>go('activity')}><span><ActivityIcon/></span><div><b>Cómo va mi actividad</b><small>Qué gastaste y qué está cambiando</small></div><ChevronRight/></button>
       </div>
       <section className="month-card"><div className="month-head"><div><span>Septiembre hasta hoy</span><strong>{money(monthTotal)}</strong></div><button onClick={openAgent}><Sparkles size={16}/> Preguntar</button></div><p>{delta>=0?`Llevás ${Math.abs(delta)}% más que en agosto.`:`Llevás ${Math.abs(delta)}% menos que en agosto.`} Lo importante no es una barra: es entender por qué.</p></section>
     </div>
   </div>
   <div className="dashboard-metrics">
     <article className="metric-card"><span>Este mes</span><strong>{money(monthTotal)}</strong><small>{txs.filter(t=>t.date.startsWith(currentMonth)).length} movimientos</small></article>
     <article className="metric-card"><span>Vs. agosto</span><strong>{delta>=0?'+':''}{delta}%</strong><small>{delta>=0?'más gasto':'menos gasto'} que el mes pasado</small></article>
     <article className="metric-card"><span>Mayor rubro</span><strong>{top[0]?.[0]||'—'}</strong><small>{top[0]?money(top[0][1]):'Sin datos'}</small></article>
     <article className="metric-card accent"><span>Antes del 8 oct</span><strong>$ 959.490</strong><small>Visa, colegio y servicios</small></article>
   </div>
   <div className="home-bottom-grid">
     <div className="home-movements">
       <div className="panel-heading"><div><span>ACTIVIDAD RECIENTE</span><h2>Últimos movimientos</h2></div><button onClick={()=>go('activity')}>Ver actividad</button></div>
       <TxList items={txs.slice(0,6)}/>
     </div>
     <div className="home-side-stack">
       <aside className="upcoming-card">
         <span>PRÓXIMOS PAGOS</span>
         <h3>Lo que viene ahora</h3>
         <div><b>03 oct</b><p>Visa Santander</p><strong>$ 684.320</strong></div>
         <div><b>05 oct</b><p>Colegio San José</p><strong>$ 185.000</strong></div>
         <div><b>08 oct</b><p>Servicios</p><strong>$ 90.170</strong></div>
       </aside>
       <aside className="assistant-card">
         <div className="assistant-card-icon"><Sparkles size={20}/></div>
         <div><span>ASISTENTE</span><h3>Preguntale a tus números.</h3><p>Podés pedirle que encuentre gastos, compare meses o te lleve a una sección.</p></div>
         <button onClick={openAgent}>Abrir asistente <ChevronRight size={16}/></button>
       </aside>
     </div>
   </div>
 </section>
}

function Activity({txs,monthTotal,previousTotal}:{txs:Tx[];monthTotal:number;previousTotal:number}){
 const current=txs.filter(t=>t.date.startsWith(currentMonth));
 const categories=Object.entries(current.reduce<Record<string,number>>((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const recurring=['Colegio San José','Netflix','Spotify','OpenAI','Claude','Flow','Personal','Sancor Seguros','EDEA','Camuzzi'];
 return <section className="stack activity-stack">
   <div className="activity-top-grid"><Card padding={4}><div className="plain-summary"><span>GASTADO ESTE MES</span><strong>{money(monthTotal)}</strong><small>{current.length} movimientos · agosto {money(previousTotal)}</small></div></Card><div className="analysis-card"><span>Qué está pasando</span><h2>No necesitás mirar gráficos para entenderlo.</h2><p>Septiembre está empujado por colegio, supermercado, servicios y varias suscripciones digitales. Tenés también gastos recurrentes de IA que conviene mirar juntos, no uno por uno.</p></div></div>
   <div className="activity-panels"><div><div className="section-title"><div><span>DONDE MÁS SE FUE</span><h2>Principales rubros</h2></div></div><div className="category-list">{categories.map(([name,amount],i)=><div className="category-row" key={name}><span>{String(i+1).padStart(2,'0')}</span><div><b>{name}</b><small>{current.filter(t=>t.category===name).length} movimientos</small></div><strong>{money(amount)}</strong></div>)}</div></div><div><div className="section-title"><div><span>SE REPITEN</span><h2>Gastos fijos y suscripciones</h2></div></div><div className="repeat-card">{recurring.map(name=>{const hit=current.find(t=>t.name===name);return hit?<div key={name}><b>{name}</b><span>{money(hit.amount)}</span></div>:null})}</div></div></div>
   <div className="section-title"><div><span>HISTORIAL</span><h2>Todos los movimientos</h2></div></div>
   <TxList items={txs}/>
 </section>
}

function TxList({items}:{items:Tx[]}){return <div className="tx-list">{items.map(t=><div className="tx" key={t.id}><span className="tx-icon"><ShoppingBag size={17}/></span><div><b>{t.name}</b><small>{new Date(t.date+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'})} · {t.category} · {t.source}</small></div><strong>{money(t.amount)}</strong></div>)}</div>}

function Add({manual,setManual,addTx,scanRef,pdfRef,scan,pdf,notice,setNotice,busy}:{manual:any;setManual:any;addTx:any;scanRef:any;pdfRef:any;scan:any;pdf:any;notice:string;setNotice:(s:string)=>void;busy:boolean}){return <section className="stack add-stack">
 <div className="add-top-grid"><div className="scanner-card" role="button" tabIndex={0} onClick={()=>scanRef.current?.click()} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();scanRef.current?.click()}}}><div className="scanner-icon"><Camera/></div><div><span>ESCÁNER INTELIGENTE</span><h2>Apuntá al ticket y listo.</h2><p>Lee comercio, importe, fecha, impuestos y forma de pago. Después revisás los datos antes de guardarlos.</p></div><div className="scanner-cta"><Camera size={18}/><b>Abrir cámara</b><ChevronRight size={18}/></div></div><div className="add-sources"><div className="section-title"><div><span>OTRAS FORMAS</span><h2>¿Cómo querés cargarlo?</h2></div></div><div className="source-grid"><Source icon={FileText} title="Subir PDF" copy="Tarjeta, banco, factura o resumen" click={()=>pdfRef.current?.click()}/><Source icon={CircleDollarSign} title="Carga manual" copy="Efectivo o cualquier gasto rápido" click={()=>document.getElementById('manual')?.scrollIntoView({behavior:'smooth'})}/><Source icon={Mail} title="Mail" copy="Facturas y comprobantes" click={()=>setNotice('La conexión con Gmail/Outlook se habilita con autorización OAuth.')}/><Source icon={Landmark} title="Banco" copy="Cuentas y tarjetas" click={()=>setNotice('La conexión bancaria necesita autorización segura del proveedor.')}/><Source icon={Wallet} title="Billetera" copy="Mercado Pago, Ualá y más" click={()=>setNotice('La conexión de billeteras queda preparada para autorización.')}/><Source icon={ReceiptText} title="Factura / QR" copy="Leé el comprobante con la cámara" click={()=>scanRef.current?.click()}/></div></div></div>
 <input ref={scanRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>e.target.files?.[0]&&scan(e.target.files[0])}/><input ref={pdfRef} hidden type="file" accept="application/pdf" onChange={e=>e.target.files?.[0]&&pdf(e.target.files[0])}/>
 {notice&&<div className="notice">{busy?'Procesando… ':''}{notice}</div>}
 <Card padding={4}><div id="manual" className="manual"><h2>Carga manual</h2><TextInput label="Concepto" value={manual.name} onChange={(v:string)=>setManual({...manual,name:v})} width="100%"/><TextInput label="Importe" value={manual.amount} onChange={(v:string)=>setManual({...manual,amount:v})} width="100%"/><TextInput label="Categoría" value={manual.category} onChange={(v:string)=>setManual({...manual,category:v})} width="100%"/><Button label="Guardar gasto" variant="primary" width="100%" onClick={()=>{if(!manual.name||!manual.amount)return;addTx({name:manual.name,amount:Number(String(manual.amount).replace(/\D/g,'')),date:new Date().toISOString().slice(0,10),category:manual.category||'Otros',source:manual.source});setManual({name:'',amount:'',category:'',source:'Efectivo'})}}/></div></Card>
 </section>}

function Accounts({go}:{go:(v:View)=>void}){const acc=[['Santander','Cuenta + Visa','$ 1.284.300','rose'],['Banco Galicia','Caja de ahorro','$ 842.900','orange'],['BBVA','Mastercard','$ 386.120','blue'],['Mercado Pago','Billetera','$ 214.800','cyan'],['Ualá','Billetera','$ 98.700','violet']];return <section className="stack accounts-stack"><p className="lead">Reuní cuentas, tarjetas y billeteras para entender tu situación completa.</p><div className="accounts-grid">{acc.map(a=><button className={`account ${a[3]}`} key={a[0]}><span><Landmark/></span><div><b>{a[0]}</b><small>{a[1]}</small></div><strong>{a[2]}</strong><ChevronRight/></button>)}</div><Button label="Agregar otra fuente" variant="primary" width="100%" onClick={()=>go('add')}/></section>}

function Ask({msgs,ask,busy,panel=false}:{msgs:Msg[];ask:(q:string)=>void;busy:boolean;panel?:boolean}){
 const prompts=['¿En qué estoy gastando de más?','¿Qué pagos se repiten todos los meses?','¿Cuánto gasté en IA estos tres meses?','¿Qué tengo que pagar esta semana?'];
 const [draft,setDraft]=useState('');
 const ignoreVoiceTranscript=useRef(false);
 const send=(raw:string)=>{const q=raw.trim();if(!q||busy)return;setDraft('');ask(q);setTimeout(()=>setDraft(''),0)};
 const dictation=useChatDictation({
   lang:'es-AR',
   continuous:false,
   interimResults:true,
   onStart:()=>{ignoreVoiceTranscript.current=false},
   onTranscript:(text)=>{if(!ignoreVoiceTranscript.current)setDraft(text)},
   onResult:(text)=>{ignoreVoiceTranscript.current=true;setDraft('');send(text)},
   onEnd:()=>{setDraft('');window.setTimeout(()=>{ignoreVoiceTranscript.current=false},250)}
 });
 return <section className={`ask ${panel?'ask-panel':''}`}>
   {!panel&&<div className="ask-intro"><span><Sparkles/></span><h2>Hablá con tus finanzas.</h2><p>Escribí o tocá el micrófono y preguntá como hablarías con una persona.</p></div>}
   {msgs.length===0&&<div className="prompt-grid">{prompts.map(p=><button className="prompt-chip" key={p} onClick={()=>send(p)}>{p}</button>)}</div>}
   <div className="chat-zone"><ChatMessageList align="top" density="compact">{msgs.map((m,i)=><ChatMessage key={i} sender={m.role==='user'?'user':'assistant'}><div className={`chat-bubble ${m.role==='user'?'chat-bubble-user':'chat-bubble-assistant'}`}>{m.text}</div></ChatMessage>)}</ChatMessageList></div>
   <div className={`composer ${panel?'composer-panel':''}`}>
     {msgs.length>0&&<div className="quick-prompts-wrap"><div className="quick-prompts" aria-label="Preguntas rápidas">{prompts.map(p=><button key={p} onClick={()=>send(p)}>{p}</button>)}</div><div className="quick-prompts-cue" aria-hidden="true"><ArrowLeftRight size={18}/></div></div>}
     <ChatComposer value={draft} onChange={setDraft} onSubmit={send} isDisabled={busy} placeholder={busy?'Pensando…':'Preguntá por tus gastos…'} density="spacious" elevation="low" sendActions={<ChatDictationButton dictation={dictation} size="md" isHiddenWhenUnsupported={false} label={dictation.isListening?'Detener dictado':'Hablar'}/>} sendButton={<button className="chat-send" type="button" onClick={()=>send(draft)} disabled={busy||!draft.trim()} aria-label="Enviar"><ArrowUp size={22}/></button>}/>
   </div>
 </section>
}

function Source({icon:Icon,title,copy,click}:{icon:any;title:string;copy:string;click:()=>void}){return <button className="source" onClick={click}><span><Icon/></span><b>{title}</b><small>{copy}</small></button>}
function Nav({icon:Icon,label,active,click}:{icon:any;label:string;active:boolean;click:()=>void}){return <button className={active?'active':''} onClick={click}><Icon size={19}/><span>{label}</span></button>}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
