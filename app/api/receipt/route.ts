import { NextResponse } from 'next/server';
const MODEL = 'qwen/qwen3.8-27b';
export async function POST(req:Request){
  const key=process.env.GROQ_API_KEY;
  if(!key) return NextResponse.json({error:'Falta configurar GROQ_API_KEY.'},{status:503});
  const {image}=await req.json();
  const prompt='Leé este ticket o comprobante. Devolvé SOLO JSON válido con: merchant, amount (número), date (YYYY-MM-DD si aparece), category, paymentMethod, taxes, notes. Si no sabés un campo usá null.';
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:image}}]}],temperature:0,max_completion_tokens:500,response_format:{type:'json_object'}})});
  const data=await r.json();
  if(!r.ok)return NextResponse.json({error:data?.error?.message||'No se pudo leer el comprobante.'},{status:r.status});
  try{return NextResponse.json({result:JSON.parse(data.choices[0].message.content)})}catch{return NextResponse.json({error:'La IA devolvió un formato inválido.'},{status:502})}
}
