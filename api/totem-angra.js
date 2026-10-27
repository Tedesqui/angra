// api/totem-angra.js
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Totem Angra Online (v3 - Com Transcricao)!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 1. ETAPA 1: Gemini 2.5 Flash transcreve a pergunta e gera a resposta em JSON
    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const resTexto = await fetch(urlTexto, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/wav",
                  data: wavBuffer.toString("base64"),
                },
              },
              {
                text: `Você é o guia de voz do Totem Turístico de Angra dos Reis - RJ.
Ouça o áudio do turista e retorne APENAS um objeto JSON com duas chaves:
1. "transcricao": O que a pessoa falou no áudio (ou "[Silêncio/Ruído]" se não houver fala clara).
2. "resposta": Sua resposta calorosa, direta e curta (máximo 2 frases ou 30 palavras, sem emojis).`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    const dataTexto = await resTexto.json();
    if (!resTexto.ok) {
      return res.status(500).json({ etapa: "gemini_texto", erro: dataTexto });
    }

    const jsonBruto = dataTexto.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let dados = { transcricao: "...", resposta: "Olá! Como posso ajudar em Angra dos Reis?" };
    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

    // 2. ETAPA 2: Gera o áudio PCM 24kHz da resposta
    const urlTts = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const resTts = await fetch(urlTts, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: dados.resposta }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
        },
      }),
    });

    const dataTts = await resTts.json();
    const partAudio = dataTts.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!partAudio) {
      return res.status(500).json({ etapa: "sem_audio_no_tts", dataTts });
    }

    const pcm24k = Buffer.from(partAudio.inlineData.data, "base64");
    const pcm16k = reamostrar24kPara16k(pcm24k);

    // Envia a transcrição e a resposta nos Headers HTTP (codificados para manter os acentos)
    res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || ""));
    res.setHeader("X-Resposta", encodeURIComponent(dados.resposta || ""));
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", pcm16k.length);
    return res.status(200).send(pcm16k);

  } catch (err) {
    return res.status(500).json({ erroGeral: err.message });
  }
}

function reamostrar24kPara16k(buf24k) {
  const totalAmostras24k = Math.floor(buf24k.length / 2);
  const totalAmostras16k = Math.floor((totalAmostras24k * 2) / 3);
  const buf16k = Buffer.alloc(totalAmostras16k * 2);

  for (let i = 0; i < totalAmostras16k; i++) {
    const idxOrigem = Math.floor((i * 3) / 2) * 2;
    if (idxOrigem + 1 < buf24k.length) {
      buf16k.writeInt16LE(buf24k.readInt16LE(idxOrigem), i * 2);
    }
  }
  return buf16k;
}

function adicionarCabecalhoWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
