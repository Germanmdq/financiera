import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
const MODEL=process.env.GROQ_MODEL||'qwen/qwen3.8-27b';
export async function POST(req:Request){
  const key=process.env.GROQ_API_KEY;
  if(!key)return NextResponse.json({error:'Falta configurar GROQ_API_KEY.'},{status:503});
  const form=await req.formData(); const file=form.get('file');
  if(!(file instanceof File)) return NextResponse.json({error:'Archivo inválido.'},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer()); const parser=new PDFParse({data:bytes});
  const parsed=await parser.getText(); await parser.destroy();
  const text=parsed.text.slice(0,30000);
  const prompt=`Extraé datos útiles de este PDF financiero. Devolvé SOLO JSON con summary, dueDate, totalDue, minimumPayment y transactions (máximo 40), cada una con merchant,date,amount,category,installments,notes. No inventes. Texto:\n${text}`;
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:prompt}],temperature:0,max_completion_tokens:2000,response_format:{type:'json_object'}})});
  const data=await r.json(); if(!r.ok)return NextResponse.json({error:data?.error?.message||'No se pudo analizar el PDF.'},{status:r.status});
  try{return NextResponse.json({result:JSON.parse(data.choices[0].message.content)})}catch{return NextResponse.json({error:'Respuesta inválida al analizar PDF.'},{status:502})}
}
