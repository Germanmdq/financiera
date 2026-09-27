import {NextResponse} from 'next/server';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY;

async function rpc(name:string,body:Record<string,unknown>){
  if(!url||!key)throw new Error('Falta configurar el enlace de escaneo.');
  const r=await fetch(`${url}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store',
  });
  if(!r.ok)throw new Error((await r.text())||'Error de sincronización.');
  const text=await r.text();
  return text?JSON.parse(text):null;
}

export async function POST(req:Request){
  try{
    const body=await req.json();
    const token=String(body.token||'');
    if(!/^[a-zA-Z0-9-]{20,100}$/.test(token))return NextResponse.json({error:'Sesión inválida.'},{status:400});
    if(body.action==='create'){
      await rpc('cifra_scan_create',{p_token:token,p_expires_at:new Date(Date.now()+10*60*1000).toISOString()});
      return NextResponse.json({ok:true});
    }
    if(body.action==='get'){
      const rows=await rpc('cifra_scan_get',{p_token:token});
      return NextResponse.json(rows?.[0]||{status:'expired'});
    }
    if(body.action==='set'){
      const status=String(body.status||'');
      if(!['processing','ready','error'].includes(status))return NextResponse.json({error:'Estado inválido.'},{status:400});
      const ok=await rpc('cifra_scan_set',{p_token:token,p_status:status,p_result:body.result??null,p_error:body.error??null});
      return NextResponse.json({ok:Boolean(ok)});
    }
    return NextResponse.json({error:'Acción inválida.'},{status:400});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'No se pudo sincronizar.'},{status:500});
  }
}
