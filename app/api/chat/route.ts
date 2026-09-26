import { NextResponse } from 'next/server';
const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
export async function POST(req: Request) {
  const { question, context } = await req.json();
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY en el servidor.' }, { status: 503 });
  const system = `Sos el asistente financiero personal de una app de finanzas domésticas. Respondé en español rioplatense, claro, humano y breve. Tu trabajo es ayudar a la persona a entender su actividad financiera, no recitar una planilla. Podés comparar meses, sumar categorías, detectar gastos recurrentes, explicar qué aumentó, señalar próximos pagos, distinguir gastos fijos y variables y responder preguntas sobre comercios, servicios, colegio, streaming, inteligencia artificial, salidas, supermercado, salud, auto, vivienda y demás categorías. No inventes ningún dato que no esté en el contexto. Si algo no está registrado, decilo. Cuando sea útil, hacé cuentas con los movimientos. Evitá jerga financiera innecesaria. Formato de salida: respuesta corta, idealmente 2 a 5 líneas; sin tablas; sin títulos grandes; si enumerás, usá como máximo 3 viñetas simples. Contexto completo del usuario:\n${JSON.stringify(context).slice(0,50000)}`;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:system},{role:'user',content:question}],temperature:0.2,max_completion_tokens:900})});
  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data?.error?.message || 'No se pudo consultar Groq.' }, {status:r.status});
  return NextResponse.json({ answer: data.choices?.[0]?.message?.content || 'No pude responder.' });
}
