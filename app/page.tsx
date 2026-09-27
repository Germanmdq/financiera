'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChatComposer,ChatDictationButton,useChatDictation} from '@astryxdesign/core/Chat';
import {
  Activity as ActivityIcon,
  BarChart3,
  ArrowLeft,
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

type View='home'|'stats'|'expenses'|'categories'|'add'|'accounts';
type Msg={role:'user'|'assistant',text:string};

const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const currentMonth='2026-09';
const previousMonth='2026-08';

export default function Page(){
  const [view,setView]=useState<View>('home');
  const [selectedCategory,setSelectedCategory]=useState<string|null>(null);
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

  const navigate=(next:View)=>{setView(next);if(next!=='categories')setSelectedCategory(null);setSidebarOpen(false)};
  const openCategory=(category:string)=>{setSelectedCategory(category);setView('categories');setSidebarOpen(false)};

  const ask=async(q:string)=>{
    const clean=q.trim();
    if(!clean||busy)return;
    setMsgs(v=>[...v,{role:'user',text:clean}]);
    const n=clean.toLocaleLowerCase('es-AR');
    const action=(target:View,label:string)=>{setView(target);setMsgs(v=>[...v,{role:'assistant',text:`Listo. Abrí ${label}.`}]);};
    if(/\b(cargar|carga|agregar gasto|nuevo gasto|sumar gasto)\b/.test(n)){action('add','Cargar');return;}
    if(/\b(estadísticas|estadisticas|resumen|cómo voy|como voy)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('stats','Estadísticas');return;}
    if(/\b(gastos|movimientos|qué gasté|que gaste)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('expenses','Mis gastos');return;}
    if(/\b(categorías|categorias|rubros)\b/.test(n)&&/\b(mostrar|mostrame|abrir|abre|andá|anda|ir|ver)\b/.test(n)){action('categories','Categorías');return;}
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

  const title=view==='home'?'Panel general':view==='stats'?'Estadísticas':view==='expenses'?'Mis gastos':view==='categories'?'Categorías':view==='add'?'Cargar':'Fuentes';

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
        <NavItem icon={BarChart3} label="Estadísticas" active={view==='stats'} onClick={()=>navigate('stats')}/>
        <NavItem icon={ActivityIcon} label="Mis gastos" active={view==='expenses'} onClick={()=>navigate('expenses')}/>
        <NavItem icon={Tags} label="Categorías" active={view==='categories'} onClick={()=>navigate('categories')}/>
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
        {view==='home'&&<DashboardHome monthTotal={monthTotal} previousTotal={previousTotal} txs={txs} go={navigate} openCategory={openCategory} openAgent={()=>setAgentOpen(true)}/>} 
        {view==='stats'&&<StatsView txs={txs} monthTotal={monthTotal} previousTotal={previousTotal}/>} 
        {view==='expenses'&&<ExpensesView txs={txs} monthTotal={monthTotal}/>} 
        {view==='categories'&&<CategoriesView txs={txs} selectedCategory={selectedCategory} openCategory={openCategory} back={()=>setSelectedCategory(null)}/>} 
        {view==='add'&&<AddView manual={manual} setManual={setManual} addTx={addTx} scanRef={scanRef} pdfRef={pdfRef} scan={scan} pdf={pdf} notice={notice} setNotice={setNotice} busy={busy}/>} 
        {view==='accounts'&&<AccountsView go={navigate}/>} 
      </div></div>
    </main>

    <nav className="sd-mobile-dock" aria-label="Navegación móvil">
      <NavItem icon={Home} label="Inicio" active={view==='home'} onClick={()=>navigate('home')}/>
      <NavItem icon={BarChart3} label="Estadísticas" active={view==='stats'} onClick={()=>navigate('stats')}/>
      <button className="sd-mobile-plus" onClick={()=>navigate('add')} aria-label="Cargar"><Plus size={20}/></button>
      <NavItem icon={WalletCards} label="Fuentes" active={view==='accounts'} onClick={()=>navigate('accounts')}/>
      <button className={`sd-mobile-agent ${agentOpen?'active':''}`} onClick={()=>setAgentOpen(true)}><Sparkles size={17}/><span>Asistente</span></button>
    </nav>

    <button className="sd-agent-fab" onClick={()=>setAgentOpen(true)}><Sparkles size={18}/><span>Asistente</span></button>
    {agentOpen&&<AgentPanel msgs={msgs} ask={ask} busy={busy} close={()=>setAgentOpen(false)}/>} 
  </div>
}

function DashboardHome({monthTotal,previousTotal,txs,go,openCategory,openAgent}:{monthTotal:number;previousTotal:number;txs:Tx[];go:(v:View)=>void;openCategory:(category:string)=>void;openAgent:()=>void}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):0;
  const categories=categorySummary(current).slice(0,6);
  return <section className="sd-stack">
    <div className="sd-overview-head">
      <div><h1>Resumen de septiembre</h1><p>Información actualizada con tus movimientos cargados.</p></div>
      <div className="sd-overview-actions"><button className="sd-btn secondary" onClick={()=>go('stats')}>Ver estadísticas</button><button className="sd-btn primary" onClick={()=>go('add')}><Plus size={15}/> Cargar movimiento</button></div>
    </div>

    <div className="sd-kpi-grid">
      <Metric title="Gastado este mes" value={money(monthTotal)} note={`${current.length} movimientos`} />
      <Metric title="Comparación mensual" value={`${delta>=0?'+':''}${delta}%`} note={`Agosto: ${money(previousTotal)}`} />
      <Metric title="Próximos pagos" value="$ 959.490" note="Hasta el 8 de octubre" />
      <Metric title="Mayor categoría" value={categories[0]?.category||'—'} note={categories[0]?money(categories[0].total):'Sin datos'} />
    </div>

    <div className="sd-quick-grid">
      <button className="sd-quick-card" onClick={()=>go('add')}><span><Plus size={21}/></span><div><b>Cargar</b><small>Ticket, PDF o manual</small></div><ChevronRight size={18}/></button>
      <button className="sd-quick-card" onClick={()=>go('stats')}><span><BarChart3 size={21}/></span><div><b>Estadísticas</b><small>Gráficos y evolución</small></div><ChevronRight size={18}/></button>
      <button className="sd-quick-card" onClick={()=>go('expenses')}><span><ShoppingBag size={21}/></span><div><b>Mis gastos</b><small>Todos los movimientos</small></div><ChevronRight size={18}/></button>
      <button className="sd-quick-card" onClick={()=>go('categories')}><span><Tags size={21}/></span><div><b>Categorías</b><small>Rubros y totales</small></div><ChevronRight size={18}/></button>
    </div>

    <div className="sd-home-grid">
      <section className="sd-card">
        <CardHead title="Categorías principales" subtitle="Septiembre" action={<button onClick={()=>go('categories')}>Ver todas</button>}/>
        <div className="sd-category-cards">
          {categories.slice(0,4).map((c,i)=><button className="sd-category-card-item" key={c.category} onClick={()=>openCategory(c.category)}>
            <span className="sd-category-index">{String(i+1).padStart(2,'0')}</span>
            <div><b>{c.category}</b><small>{c.count} movimiento{c.count===1?'':'s'}</small></div>
            <strong>{money(c.total)}</strong>
            <ChevronRight className="sd-category-chevron" size={18}/>
          </button>)}
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

    <section className="sd-card">
      <CardHead title="Movimientos" subtitle="Agrupados por categoría" action={<button onClick={()=>go('expenses')}>Ver gastos</button>}/>
      <CategorizedTxList items={txs}/>
    </section>

    <section className="sd-assistant-strip">
      <div><span><Sparkles size={17}/></span><div><b>Asistente</b><small>Encontrá gastos, compará meses o pedile que abra una sección.</small></div></div>
      <button className="sd-btn primary" onClick={openAgent}>Abrir asistente</button>
    </section>
  </section>
}

function StatsView({txs,monthTotal,previousTotal}:{txs:Tx[];monthTotal:number;previousTotal:number}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  const categories=categorySummary(current);
  const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):0;
  const months=[
    {label:'Jul',value:txs.filter(t=>t.date.startsWith('2026-07')).reduce((s,t)=>s+t.amount,0)},
    {label:'Ago',value:previousTotal},
    {label:'Sep',value:monthTotal},
  ];
  const maxMonth=Math.max(...months.map(m=>m.value),1);
  const topMax=Math.max(...categories.slice(0,6).map(c=>c.total),1);
  const recurringNames=['Colegio San José','Netflix','Spotify','OpenAI','Claude','Flow','Personal','Sancor Seguros','EDEA','Camuzzi'];
  const recurring=current.filter(t=>recurringNames.includes(t.name)).reduce((s,t)=>s+t.amount,0);
  const daily=Math.round(monthTotal/26);
  const average=current.length?Math.round(monthTotal/current.length):0;
  const donutTop=categories.slice(0,5);
  const donutTotal=Math.max(1,donutTop.reduce((s,c)=>s+c.total,0));
  let angle=0;
  const palette=['#17191f','#5865f2','#7c8aa5','#aab2c3','#d8dde7'];
  const donutStops=donutTop.map((c,i)=>{const start=angle;angle+=c.total/donutTotal*360;return `${palette[i]} ${start}deg ${angle}deg`}).join(',');
  return <section className="sd-stack">
    <div className="sd-overview-head"><div><h1>Estadísticas</h1><p>Evolución, distribución y comportamiento de tus gastos.</p></div></div>
    <div className="sd-kpi-grid compact">
      <Metric title="Septiembre" value={money(monthTotal)} note={`${current.length} movimientos`} />
      <Metric title="Variación mensual" value={`${delta>=0?'+':''}${delta}%`} note="Contra agosto" />
      <Metric title="Promedio diario" value={money(daily)} note="Sobre 26 días" />
      <Metric title="Recurrentes" value={money(recurring)} note="Este mes" />
    </div>
    <div className="sd-stats-grid">
      <section className="sd-card sd-chart-card"><CardHead title="Distribución por categoría" subtitle="Septiembre"/><div className="sd-donut-wrap"><div className="sd-donut" style={{background:`conic-gradient(${donutStops})`}}><div><strong>{money(monthTotal)}</strong><span>Total</span></div></div><div className="sd-donut-legend">{donutTop.map((c,i)=><div key={c.category}><i style={{background:palette[i]}}/><span>{c.category}</span><b>{Math.round(c.total/donutTotal*100)}%</b></div>)}</div></div></section>
      <section className="sd-card sd-chart-card"><CardHead title="Evolución mensual" subtitle="Últimos 3 meses"/><div className="sd-bar-chart">{months.map(m=><div className="sd-bar-col" key={m.label}><div className="sd-bar-value">{money(m.value)}</div><div className="sd-bar-track"><div className="sd-bar-fill" style={{height:`${Math.max(12,(m.value/maxMonth)*100)}%`}}/></div><span>{m.label}</span></div>)}</div></section>
    </div>
    <section className="sd-card"><CardHead title="Peso por categoría" subtitle="Top 6 de septiembre"/><div className="sd-share-list">{categories.slice(0,6).map(c=><div className="sd-share-row" key={c.category}><div><b>{c.category}</b><span>{money(c.total)}</span></div><div className="sd-share-track"><span style={{width:`${Math.max(8,(c.total/topMax)*100)}%`}}/></div></div>)}</div></section>
    <div className="sd-stats-grid secondary">
      <section className="sd-card"><CardHead title="Indicadores" subtitle="Lectura rápida"/><div className="sd-stat-cards"><div><span>Mayor categoría</span><b>{categories[0]?.category||'—'}</b><strong>{categories[0]?money(categories[0].total):'—'}</strong></div><div><span>Categorías activas</span><b>{categories.length}</b><strong>este mes</strong></div><div><span>Ticket promedio</span><b>{money(average)}</b><strong>por movimiento</strong></div></div></section>
      <section className="sd-card"><CardHead title="Comparación" subtitle="Septiembre vs agosto"/><div className="sd-compare-card"><div><span>Agosto</span><b>{money(previousTotal)}</b></div><div className="sd-compare-arrow">→</div><div><span>Septiembre</span><b>{money(monthTotal)}</b></div><strong className={delta>=0?'up':'down'}>{delta>=0?'+':''}{delta}%</strong></div></section>
    </div>
  </section>
}

function ExpensesView({txs,monthTotal}:{txs:Tx[];monthTotal:number}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  return <section className="sd-stack"><div className="sd-overview-head"><div><h1>Mis gastos</h1><p>{current.length} movimientos en septiembre · {money(monthTotal)}</p></div></div><section className="sd-card"><CardHead title="Movimientos" subtitle="Agrupados por categoría"/><CategorizedTxList items={txs}/></section></section>
}

function CategoriesView({txs,selectedCategory,openCategory,back}:{txs:Tx[];selectedCategory:string|null;openCategory:(category:string)=>void;back:()=>void}){
  const current=txs.filter(t=>t.date.startsWith(currentMonth));
  const categories=categorySummary(current);
  if(selectedCategory){
    const all=txs.filter(t=>t.category===selectedCategory).sort((a,b)=>b.date.localeCompare(a.date));
    const month=all.filter(t=>t.date.startsWith(currentMonth));
    const previous=all.filter(t=>t.date.startsWith(previousMonth));
    const monthTotal=month.reduce((s,t)=>s+t.amount,0);
    const previousTotal=previous.reduce((s,t)=>s+t.amount,0);
    const delta=previousTotal?Math.round(((monthTotal-previousTotal)/previousTotal)*100):null;
    const sources=Object.entries(month.reduce<Record<string,number>>((acc,t)=>{acc[t.source]=(acc[t.source]||0)+t.amount;return acc},{})).sort((a,b)=>b[1]-a[1]);
    const months=['2026-07','2026-08','2026-09'].map(key=>({label:key==='2026-07'?'Jul':key==='2026-08'?'Ago':'Sep',value:all.filter(t=>t.date.startsWith(key)).reduce((s,t)=>s+t.amount,0)}));
    const max=Math.max(...months.map(m=>m.value),1);
    return <section className="sd-stack">
      <div className="sd-category-detail-head"><button className="sd-back-button" onClick={back}><ArrowLeft size={17}/> Categorías</button><div><h1>{selectedCategory}</h1><p>Detalle de gastos de septiembre.</p></div></div>
      <div className="sd-kpi-grid compact">
        <Metric title="Total septiembre" value={money(monthTotal)} note={`${month.length} movimiento${month.length===1?'':'s'}`} />
        <Metric title="Agosto" value={money(previousTotal)} note={`${previous.length} movimiento${previous.length===1?'':'s'}`} />
        <Metric title="Variación" value={delta===null?'—':`${delta>=0?'+':''}${delta}%`} note="Contra agosto" />
        <Metric title="Ticket promedio" value={month.length?money(Math.round(monthTotal/month.length)):'—'} note="Por movimiento" />
      </div>
      <div className="sd-category-detail-grid">
        <section className="sd-card"><CardHead title="Movimientos" subtitle={`${month.length} en septiembre`}/><div className="sd-detail-tx-list">{month.map(t=><div className="sd-detail-tx" key={t.id}><span className="sd-tx-icon"><ShoppingBag size={16}/></span><div><b>{t.name}</b><small>{new Date(t.date+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long'})} · {t.source}</small></div><strong>{money(t.amount)}</strong></div>)}</div></section>
        <div className="sd-category-detail-side">
          <section className="sd-card"><CardHead title="Evolución" subtitle="Últimos 3 meses"/><div className="sd-mini-bars">{months.map(m=><div key={m.label}><span>{money(m.value)}</span><div><i style={{height:`${Math.max(8,(m.value/max)*100)}%`}}/></div><b>{m.label}</b></div>)}</div></section>
          <section className="sd-card"><CardHead title="Origen de los gastos" subtitle="Septiembre"/><div className="sd-source-breakdown">{sources.map(([source,total])=><div key={source}><span>{source}</span><b>{money(total)}</b></div>)}</div></section>
        </div>
      </div>
    </section>
  }
  return <section className="sd-stack"><div className="sd-overview-head"><div><h1>Categorías</h1><p>Cómo se distribuyen tus gastos este mes. Tocá una categoría para ver el detalle.</p></div></div><div className="sd-category-card-grid">{categories.map((c,i)=><button className="sd-category-big-card" key={c.category} onClick={()=>openCategory(c.category)}><span>{String(i+1).padStart(2,'0')}</span><h3>{c.category}</h3><strong>{money(c.total)}</strong><small>{c.count} movimiento{c.count===1?'':'s'}</small><ChevronRight className="sd-category-big-chevron" size={18}/></button>)}</div></section>
}

function AddView({manual,setManual,addTx,scanRef,pdfRef,scan,pdf,notice,setNotice,busy}:{manual:any;setManual:any;addTx:any;scanRef:any;pdfRef:any;scan:any;pdf:any;notice:string;setNotice:(s:string)=>void;busy:boolean}){
  return <section className="sd-stack">
    <div className="sd-overview-head"><div><h1>Cargar</h1><p>Agregá movimientos desde ticket, PDF, banco o carga manual.</p></div></div>
    <div className="sd-load-card-grid">
      <button className="sd-load-card primary" onClick={()=>scanRef.current?.click()}><span><ScanLine size={26}/></span><div><b>Escanear ticket</b><small>Cámara, factura o QR</small></div><ChevronRight size={18}/></button>
      <button className="sd-load-card" onClick={()=>pdfRef.current?.click()}><span><FileText size={26}/></span><div><b>Subir PDF</b><small>Resumen, factura o tarjeta</small></div><ChevronRight size={18}/></button>
      <button className="sd-load-card" onClick={()=>document.getElementById('manual')?.scrollIntoView({behavior:'smooth'})}><span><CircleDollarSign size={26}/></span><div><b>Carga manual</b><small>Efectivo o gasto rápido</small></div><ChevronRight size={18}/></button>
      <button className="sd-load-card" onClick={()=>setNotice('Conexiones disponibles: banco, billetera y mail.')}><span><Landmark size={26}/></span><div><b>Conectar una fuente</b><small>Banco, billetera o mail</small></div><ChevronRight size={18}/></button>
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
