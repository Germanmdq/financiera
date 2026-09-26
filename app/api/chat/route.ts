import { NextResponse } from 'next/server';

const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

export async function POST(req: Request) {
  const { question, context } = await req.json();
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 });
  const system = `Sos el asistente financiero personal de Cifra. Respondé en español rioplatense, claro, humano y breve. No uses jerga financiera innecesaria ni inventes datos. Trabajá únicamente con este contexto del usuario:\n${JSON.stringify(context).slice(0,24000)}`;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{role:'system',content:system},{role:'user',content:question}], temperature: 0.25, max_completion_tokens: 700 })
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data?.error?.message || 'No se pudo consultar Groq.' }, {status:r.status});
  return NextResponse.json({ answer: data.choices?.[0]?.message?.content || 'No pude responder.' });
}
