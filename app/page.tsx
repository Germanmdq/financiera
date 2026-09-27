'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChatComposer,ChatDictationButton,useChatDictation} from '@astryxdesign/core/Chat';
import {
  Activity as ActivityIcon,
  BarChart3,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Home,
  Landmark,
  Mail,
  Menu,
  MessageCircleMore,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  ShoppingBag,
  Sparkles,
  Tags,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';
import {seedTransactions,type Tx} from './data';

type View='home'|'activity'|'add'|'accounts';
type Msg={role:'user'|'assistant',text:string};

const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const currentMonth='2026-09';
const previousMonth='2026-08';

export default function Page(){
  const [view,setView]=useState<View>('home');
  const [agentOpen,setAgentOpen]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [txs,setTxs]=useState<Tx[]>(seedTransactions);
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [manual,setManual]=useState({name:'',amount:'',category:'',source:'Efectivo'});
  const scanRef=useRef<HTMLInputElement>(null);
  const pdfRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{const saved=localStorage.getItem('finanzas.txs.v2');if(saved)try{setTxs(JSON.parse(saved))}catch{}},[]);
  useEffect(()=>{localStorage.setItem('finanzas.txs.v2',JSON.stringify(txs))},[txs]);

  const monthTxs=useMemo(()=>txs.filter(t=>t.date.startsWith(currentMonth)),[txs]);
  const monthTotal=useMemo(()=>monthTxs.reduce((s,t)=>s+t.amount,0),[monthTxs]);
  const previousTotal=useMemo(()=>txs.filter(t=>t.date.startsWith(previousMonth)).reduce((s,t)=>s+t.amount,0),[txs]);
  const addTx=(t:Omit<Tx,'id'>)=>setTxs(v=>[{...t,id:crypto.randomUUID()},...v]);

  const navigate=(next:View)=>{setView(next);setSidebarOpen(false)};

  const ask=async(q:string)=>{
    const clean=q.trim();
    if(!clean||busy)return;
    setMsgs(v=>[...v,{role:'user',text:clean}]);
    const n=clean.toLocaleLowerCase('es-AR');
    const action=(target:View,label:string)=>{setView(target);setMsgs(v=>[...v,{role:'assistant',text:`Listo. Abrí ${label}.`}]);};
    if(/\b(cargar|carga|agregar gasto|nuevo gasto|sumar gasto)\b/.test(n)){action('add','Cargar');return;}
    if(/\b(actividad|resumen|cómo voy|como voy|qué gasté|que gaste)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('activity','Actividad');return;}
    if(/\b(cuentas|fuentes|tarjetas|billeteras|bancos)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('accounts','Fuentes');return;}
    setBusy(true);
    try{
      const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:clean,context:{today:'2026-09-26',currentScreen:view,transactions:txs,summary:{monthTotal,previousTotal,upcoming:[{name:'Visa Santander',date:'2026-10-03',amount:684320},{name:'Colegio San José',date:'2026-10-05',amount:185000},{name:'Servicios',date:'2026-10-08',amount:90170}]}}})});
      const d=await r.json();
      setMsgs(v=>[...v,{role:'assistant',text:d.answer||d.error||'No pude responder.'}]);
    }catch{setMsgs(v=>[...v,{role:'assistant',text:'No pude conectar con el servidor.'}]);}
    finally{setBusy(false)}
  };

  const scan=async(file:File)=>{
    setBusy(true);setNotice('Leyendo comprobante…');
    try{
      const image=await fileToDataUrl(file);
      const r=await fetch('/api/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
      const d=await r.json();if(!r.ok)throw new Error(d.error);
      const x=d.result;
      addTx({name:x.merchant||'Comprobante',amount:Number(x.amount)||0,date:x.date||new Date().toISOString().slice(0,10),category:x.category||'Otros',source:x.paymentMethod||'Ticket escaneado',notes:x.notes||''});
      setNotice(`Listo: ${x.merchant||'comprobante'} · ${money(Number(x.amount)||0)}`);
    }catch(e){setNotice(e instanceof Error?e.message:'No pude leer el ticket.')}finally{setBusy(false)}
  };

  const pdf=async(file:File)=>{
    setBusy(true);setNotice('Analizando PDF…');
    try{
      const f=new FormData();f.append('file',file);
      const r=await fetch('/api/pdf',{method:'POST',body:f});
      const d=await r.json();if(!r.ok)throw new Error(d.error);
      const arr=Array.isArray(d.result.transactions)?d.result.transactions:[];
      arr.forEach((x:any)=>addTx({name:x.merchant||'Movimiento PDF',amount:Number(x.amount)||0,date:x.date||new Date().toISOString().slice(0,10),category:x.category||'Otros',source:file.name,notes:x.notes||''}));
      setNotice(`${d.result.summary||'PDF analizado'}. Importé ${arr.length} movimientos.`);
    }catch(e){setNotice(e instanceof Error?e.message:'No pude analizar el PDF.')}finally{setBusy(false)}
  };

  const title=view==='home'?'Panel general':view==='activity'?'Actividad':view==='add'?'Cargar':'Fuentes';

  return <div className="sd-app">
    <button className={`sd-mobile-backdrop ${sidebarOpen?'show':''}`} onClick={()=>setSidebarOpen(false)} aria-label="Cerrar menú"/>
    <aside className={`sd-sidebar ${sidebarOpen?'open':''}`}>
      <div className="sd-sidebar-head">
        <div className="sd-brand-mark">C</div>
        <div className="sd-brand-copy"><strong>Cifra</strong><span>Finanzas personales</span></div>
        <button className="sd-sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Cerrar"><X size={18}/></button>
      </div>

      <nav className="sd-nav">
        <span className="sd-nav-label">GENERAL</span>
        <NavItem icon={Home} label="Inicio" active={view==='home'} onClick={()=>navigate('home')}/>
        <NavItem icon={Plus} label="Cargar" active={view==='add'} onClick={()=>navigate('add')}/>
        <NavItem icon={BarChart3} label="Estadísticas" active={view==='activity'} onClick={()=>navigate('activity')}/>
        <NavItem icon={ActivityIcon} label="Mis gastos" active={view==='activity'} onClick={()=>navigate('activity')}/>
        <NavItem icon={Tags} label="Categorías" active={view==='activity'} onClick={()=>navigate('activity')}/>
        <NavItem icon={WalletCards} label="Fuentes" active={view==='accounts'} onClick={()=>navigate('accounts')}/>
      </nav>

      <div className="sd-sidebar-spacer"/>
      <button className="sd-assistant-nav" onClick={()=>{setAgentOpen(true);setSidebarOpen(false)}}>
        <span><Sparkles size={17}/></span>
        <div><b>Asistente</b><small>Preguntá o pedí una acción</small></div>
        <ChevronRight size={16}/>
      </button>
    </aside>

    <main className="sd-inset">
      <header className="sd-header">
        <div className="sd-header-left">
          <button className="sd-icon-button sd-menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={19}/></button>
          <div className="sd-header-title"><span>FINANZAS</span><strong>{title}</strong></div>
        </div>
        <div className="sd-header-actions">
          <div className="sd-search"><Search size={16}/><span>Buscar</span><kbd>⌘ K</kbd></div>
          <button className="sd-icon-button" onClick={()=>navigate('accounts')} aria-label="Fuentes"><Wallet size={18}/></button>
        </div>
      </header>

      <div className="sd-page"><div className="sd-container">
        {view==='home'&&<DashboardHome monthTotal={monthTotal} previousTotal={previousTotal} txs={txs} go={navigate} openAgent={()=>setAgentOpen(true)}/>} 
        {view==='activity'&&<ActivityView txs={txs} monthTotal={monthTotal} previousTotal={previousTotal}/>} 
        {view==='add'&&<AddView manual={manual} setManual={setManual} addTx={addTx} scanRef={scanRef} pdfRef={pdfRef} scan={scan} pdf={pdf} notice={notice} setNotice={setNotice} busy={busy}/>} 
        {view==='accounts'&&<AccountsView go={navigate}/>} 
      </div></div>
    </main>

    <nav className="sd-mobile-dock" aria-label="Navegación móvil">
      <NavItem icon={Home} label="Inicio" active={view==='home'} onClick={()=>navigate('home')}/>
      <NavItem icon={ActivityIcon} label="Actividad" active={view==='activity'} onClick={()=>navigate('activity')}/>
      <button className="sd-mobile-plus" onClick={()=>navigate('add')} aria-label="Cargar"><Plus size={20}/></button>
      <NavItem icon={WalletCards} label="Fuentes" active={view==='accounts'} onClick={()=>navigate('accounts')}/>
      <button className={`sd-mobile-agent ${agentOpen?'active':''}`} onClick={()=>setAgentOpen(true)}><Sparkles size={17}/><span>Asistente</span></button>
    </nav>

    <button className="sd-agent-fab" onClick={()=>setAgentOpen(true)}><Sparkles size={18}/><span>Asistente</span></button>
    {agentOpen&&<AgentPanel msgs={msgs} ask={ask} busy={busy} close={()=>setAgentOpen(false)}/>} 
  </div>
}

function DashboardHome({monthTotal,previousTotal,txs,go,openAgent}:{monthTotal:number;previousTotal:number;txs:Tx[];go:(v:View)=>void;openAgent:()=>void}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):0;
  const categories=categorySummary(current).slice(0,6);
  return <section className="sd-stack">
    <div className="sd-overview-head">
      <div><h1>Resumen de septiembre</h1><p>Información actualizada con tus movimientos cargados.</p></div>
      <div className="sd-overview-actions"><button className="sd-btn secondary" onClick={()=>go('activity')}>Ver actividad</button><button className="sd-btn primary" onClick={()=>go('add')}><Plus size={15}/> Cargar movimiento</button></div>
    </div>

    <div className="sd-kpi-grid">
      <Metric title="Gastado este mes" value={money(monthTotal)} note={`${current.length} movimientos`} />
      <Metric title="Comparación mensual" value={`${delta>=0?'+':''}${delta}%`} note={`Agosto: ${money(previousTotal)}`} />
      <Metric title="Próximos pagos" value="$ 959.490" note="Hasta el 8 de octubre" />
      <Metric title="Mayor categoría" value={categories[0]?.category||'—'} note={categories[0]?money(categories[0].total):'Sin datos'} />
    </div>

    <div className="sd-workspace-grid">
      <aside className="sd-section-rail">
        <div className="sd-section-rail-head"><span>SECCIONES</span><b>Tu panel</b></div>
        <button onClick={()=>go('add')}><span><Plus size={18}/></span><div><b>Cargar</b><small>Ticket, PDF o manual</small></div><ChevronRight size={16}/></button>
        <button onClick={()=>go('activity')}><span><BarChart3 size={18}/></span><div><b>Estadísticas</b><small>Comparaciones y evolución</small></div><ChevronRight size={16}/></button>
        <button onClick={()=>go('activity')}><span><ShoppingBag size={18}/></span><div><b>Mis gastos</b><small>Movimientos y recurrencias</small></div><ChevronRight size={16}/></button>
        <button onClick={()=>go('activity')}><span><Tags size={18}/></span><div><b>Categorías</b><small>Rubros y totales</small></div><ChevronRight size={16}/></button>
        <button onClick={()=>go('accounts')}><span><WalletCards size={18}/></span><div><b>Fuentes</b><small>Bancos y billeteras</small></div><ChevronRight size={16}/></button>
      </aside>

      <div className="sd-main-cards">
        <section className="sd-card">
          <CardHead title="Actividad por categoría" subtitle="Septiembre" action={<button onClick={()=>go('activity')}>Ver todo</button>}/>
          <div className="sd-category-cards">
            {categories.map((c,i)=><article className="sd-category-card-item" key={c.category}>
              <span className="sd-category-index">{String(i+1).padStart(2,'0')}</span>
              <div><b>{c.category}</b><small>{c.count} movimiento{c.count===1?'':'s'}</small></div>
              <strong>{money(c.total)}</strong>
            </article>)}
          </div>
        </section>

        <section className="sd-card">
          <CardHead title="Próximos pagos" subtitle="Próximos 12 días"/>
          <div className="sd-payment-cards">
            <Payment date="03 oct" name="Visa Santander" amount="$ 684.320"/>
            <Payment date="05 oct" name="Colegio San José" amount="$ 185.000"/>
            <Payment date="08 oct" name="Servicios" amount="$ 90.170"/>
          </div>
        </section>
      </div>
    </div>

    <section className="sd-card">
      <CardHead title="Movimientos" subtitle="Agrupados por categoría" action={<button onClick={()=>go('activity')}>Abrir actividad</button>}/>
      <CategorizedTxList items={txs}/>
    </section>

    <section className="sd-assistant-strip">
      <div><span><Sparkles size={17}/></span><div><b>Asistente</b><small>Encontrá gastos, compará meses o pedile que abra una sección.</small></div></div>
      <button className="sd-btn primary" onClick={openAgent}>Abrir asistente</button>
    </section>
  </section>
}

function ActivityView({txs,monthTotal,previousTotal}:{txs:Tx[];monthTotal:number;previousTotal:number}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  const categories=categorySummary(current);
  const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):0;
  return <section className="sd-stack">
    <div className="sd-overview-head"><div><h1>Actividad</h1><p>Detalle de gastos, categorías y recurrencias.</p></div></div>
    <div className="sd-kpi-grid compact">
      <Metric title="Septiembre" value={money(monthTotal)} note={`${current.length} movimientos`} />
      <Metric title="Agosto" value={money(previousTotal)} note="Mes anterior" />
      <Metric title="Variación" value={`${delta>=0?'+':''}${delta}%`} note="Contra agosto" />
      <Metric title="Categorías" value={String(categories.length)} note="Con movimientos" />
    </div>
    <div className="sd-dashboard-grid">
      <section className="sd-card sd-card-large"><CardHead title="Principales categorías" subtitle="Ordenadas por importe"/><div className="sd-category-table">{categories.slice(0,8).map((c,i)=><div className="sd-category-table-row" key={c.category}><span className="sd-rank">{String(i+1).padStart(2,'0')}</span><div><b>{c.category}</b><small>{c.count} movimientos</small></div><strong>{money(c.total)}</strong></div>)}</div></section>
      <section className="sd-card"><CardHead title="Gastos recurrentes" subtitle="Septiembre"/><div className="sd-simple-list">{['Colegio San José','Netflix','Spotify','OpenAI','Claude','Flow','Personal','Sancor Seguros','EDEA','Camuzzi'].map(name=>{const hit=current.find(t=>t.name===name);return hit?<div key={name}><span>{name}</span><b>{money(hit.amount)}</b></div>:null})}</div></section>
    </div>
    <section className="sd-card"><CardHead title="Todos los movimientos" subtitle="Abrí una categoría para ver el detalle"/><CategorizedTxList items={txs}/></section>
  </section>
}

function AddView({manual,setManual,addTx,scanRef,pdfRef,scan,pdf,notice,setNotice,busy}:{manual:any;setManual:any;addTx:any;scanRef:any;pdfRef:any;scan:any;pdf:any;notice:string;setNotice:(s:string)=>void;busy:boolean}){
  return <section className="sd-stack">
    <div className="sd-overview-head"><div><h1>Cargar</h1><p>Agregá movimientos desde ticket, PDF, banco o carga manual.</p></div></div>
    <div className="sd-dashboard-grid add-grid">
      <section className="sd-card sd-scan-card" onClick={()=>scanRef.current?.click()} role="button" tabIndex={0}>
        <div className="sd-scan-icon"><ScanLine size={24}/></div><h2>Escanear ticket</h2><p>Usá la cámara para leer comercio, fecha, importe y forma de pago.</p><button className="sd-btn primary"><Camera size={15}/> Abrir cámara</button>
      </section>
      <section className="sd-card"><CardHead title="Otras formas de carga" subtitle="Elegí una opción"/><div className="sd-source-grid">
        <Source icon={FileText} title="Subir PDF" copy="Resumen o factura" click={()=>pdfRef.current?.click()}/>
        <Source icon={CircleDollarSign} title="Carga manual" copy="Efectivo o gasto rápido" click={()=>document.getElementById('manual')?.scrollIntoView({behavior:'smooth'})}/>
        <Source icon={Mail} title="Mail" copy="Facturas y comprobantes" click={()=>setNotice('La conexión con Gmail/Outlook se habilita con autorización OAuth.')}/>
        <Source icon={Landmark} title="Banco" copy="Cuentas y tarjetas" click={()=>setNotice('La conexión bancaria necesita autorización segura del proveedor.')}/>
        <Source icon={Wallet} title="Billetera" copy="Mercado Pago, Ualá y más" click={()=>setNotice('La conexión de billeteras queda preparada para autorización.')}/>
        <Source icon={ReceiptText} title="Factura / QR" copy="Leer con cámara" click={()=>scanRef.current?.click()}/>
      </div></section>
    </div>
    <input ref={scanRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>e.target.files?.[0]&&scan(e.target.files[0])}/>
    <input ref={pdfRef} hidden type="file" accept="application/pdf" onChange={e=>e.target.files?.[0]&&pdf(e.target.files[0])}/>
    {notice&&<div className="sd-notice">{busy?'Procesando… ':''}{notice}</div>}
    <section className="sd-card" id="manual"><CardHead title="Carga manual" subtitle="Ingresá los datos del movimiento"/><div className="sd-form-grid">
      <Field label="Concepto" value={manual.name} onChange={v=>setManual({...manual,name:v})}/>
      <Field label="Importe" value={manual.amount} onChange={v=>setManual({...manual,amount:v})}/>
      <Field label="Categoría" value={manual.category} onChange={v=>setManual({...manual,category:v})}/>
      <Field label="Origen" value={manual.source} onChange={v=>setManual({...manual,source:v})}/>
    </div><div className="sd-form-actions"><button className="sd-btn primary" onClick={()=>{if(!manual.name||!manual.amount)return;addTx({name:manual.name,amount:Number(String(manual.amount).replace(/\D/g,'')),date:new Date().toISOString().slice(0,10),category:manual.category||'Otros',source:manual.source});setManual({name:'',amount:'',category:'',source:'Efectivo'})}}>Guardar movimiento</button></div></section>
  </section>
}

function AccountsView({go}:{go:(v:View)=>void}){
  const accounts=[['Santander','Cuenta + Visa','$ 1.284.300'],['Banco Galicia','Caja de ahorro','$ 842.900'],['BBVA','Mastercard','$ 386.120'],['Mercado Pago','Billetera','$ 214.800'],['Ualá','Billetera','$ 98.700']];
  return <section className="sd-stack"><div className="sd-overview-head"><div><h1>Fuentes</h1><p>Cuentas, tarjetas y billeteras conectadas.</p></div><button className="sd-btn primary" onClick={()=>go('add')}><Plus size={15}/> Agregar fuente</button></div><section className="sd-card"><CardHead title="Mis cuentas" subtitle={`${accounts.length} fuentes`}/><div className="sd-account-table">{accounts.map(([name,type,balance])=><button key={name} className="sd-account-row"><span className="sd-account-icon"><Landmark size={17}/></span><div><b>{name}</b><small>{type}</small></div><strong>{balance}</strong><ChevronRight size={16}/></button>)}</div></section></section>
}

function AgentPanel({msgs,ask,busy,close}:{msgs:Msg[];ask:(q:string)=>void;busy:boolean;close:()=>void}){
  const prompts=['¿En qué estoy gastando de más?','¿Qué pagos se repiten todos los meses?','¿Cuánto gasté en IA estos tres meses?','¿Qué tengo que pagar esta semana?'];
  const [draft,setDraft]=useState('');
  const ignoreVoiceTranscript=useRef(false);
  const send=(raw:string)=>{const q=raw.trim();if(!q||busy)return;setDraft('');ask(q);setTimeout(()=>setDraft(''),0)};
  const dictation=useChatDictation({lang:'es-AR',continuous:false,interimResults:true,onStart:()=>{ignoreVoiceTranscript.current=false},onTranscript:text=>{if(!ignoreVoiceTranscript.current)setDraft(text)},onResult:text=>{ignoreVoiceTranscript.current=true;setDraft('');send(text)},onEnd:()=>{setDraft('');window.setTimeout(()=>{ignoreVoiceTranscript.current=false},250)}});
  return <><button className="sd-agent-backdrop" onClick={close} aria-label="Cerrar asistente"/><aside className="sd-agent-panel">
    <div className="sd-agent-head"><div><span><Sparkles size={17}/></span><div><b>Asistente</b><small>Preguntá o pedí una acción</small></div></div><button onClick={close}><X size={18}/></button></div>
    <div className="sd-agent-body">
      {msgs.length===0&&<div className="sd-prompt-grid">{prompts.map(p=><button key={p} onClick={()=>send(p)}>{p}</button>)}</div>}
      <div className="sd-chat-list">{msgs.map((m,i)=><div className={`sd-chat-message ${m.role}`} key={i}>{m.text}</div>)}</div>
    </div>
    <div className="sd-agent-composer"><ChatComposer value={draft} onChange={setDraft} onSubmit={send} isDisabled={busy} placeholder={busy?'Pensando…':'Preguntá por tus gastos…'} density="compact" elevation="none" sendActions={<ChatDictationButton dictation={dictation} size="sm" isHiddenWhenUnsupported={false} label={dictation.isListening?'Detener':'Hablar'}/>} sendButton={<button className="sd-send" type="button" onClick={()=>send(draft)} disabled={busy||!draft.trim()}><ArrowUp size={18}/></button>}/></div>
  </aside></>
}

function Metric({title,value,note}:{title:string;value:string;note:string}){return <article className="sd-metric"><span>{title}</span><strong>{value}</strong><small>{note}</small></article>}
function Payment({date,name,amount}:{date:string;name:string;amount:string}){return <div className="sd-payment"><span>{date}</span><div><b>{name}</b></div><strong>{amount}</strong></div>}
function CardHead({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return <div className="sd-card-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="sd-field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Source({icon:Icon,title,copy,click}:{icon:any;title:string;copy:string;click:()=>void}){return <button className="sd-source" onClick={click}><span><Icon size={18}/></span><div><b>{title}</b><small>{copy}</small></div></button>}
function NavItem({icon:Icon,label,active,onClick}:{icon:any;label:string;active:boolean;onClick:()=>void}){return <button className={`sd-nav-item ${active?'active':''}`} onClick={onClick}><Icon size={17}/><span>{label}</span></button>}

function CategorizedTxList({items}:{items:Tx[]}){
  const groups=Object.entries(items.reduce<Record<string,Tx[]>>((acc,t)=>{(acc[t.category]??=[]).push(t);return acc},{})).map(([category,group])=>({category,group,total:group.reduce((s,t)=>s+t.amount,0)})).sort((a,b)=>b.total-a.total);
  return <div className="sd-accordion">{groups.map(({category,group,total})=><details key={category}><summary><div className="sd-summary-main"><ChevronDown size={15}/><div><b>{category}</b><small>{group.length} movimiento{group.length===1?'':'s'}</small></div></div><strong>{money(total)}</strong></summary><div className="sd-tx-table">{group.map(t=><div className="sd-tx-row" key={t.id}><span className="sd-tx-icon"><ShoppingBag size={15}/></span><div><b>{t.name}</b><small>{new Date(t.date+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'})} · {t.source}</small></div><strong>{money(t.amount)}</strong></div>)}</div></details>)}</div>
}

function categorySummary(items:Tx[]){return Object.entries(items.reduce<Record<string,{total:number,count:number}>>((a,t)=>{a[t.category]??={total:0,count:0};a[t.category].total+=t.amount;a[t.category].count++;return a},{})).map(([category,v])=>({category,...v})).sort((a,b)=>b.total-a.total)}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
