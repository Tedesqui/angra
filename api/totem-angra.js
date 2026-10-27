// api/totem-angra.js
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Totem Angra Online (v2)!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY ausente na Vercel");
    }

    // 1. Recebe os bytes PCM do Seeed XIAO e monta o WAV em memória
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      throw new Error(`Audio muito curto recebido: ${pcmBuffer.length} bytes`);
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 2. ETAPA 1: Gemini 2.5 Flash ouve o turista e gera a resposta em TEXTO
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
                text: "Você é o guia de voz do Totem Turístico de Angra dos Reis - RJ. Ouça o áudio e responda de forma calorosa, direta e muito curta (máximo de 2 frases ou 30 palavras), sem usar emojis nem asteriscos.",
              },
            ],
          },
        ],
      }),
    });

    const dataTexto = await resTexto.json();
    if (!resTexto.ok) {
      console.error("Erro Gemini Texto:", JSON.stringify(dataTexto));
      return res.status(500).json({ etapa: "gemini_texto", erro: dataTexto });
    }

    const textoResposta =
      dataTexto.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Olá! Bem-vindo a Angra dos Reis. Como posso ajudar?";

    console.log("Texto gerado pelo Gemini:", textoResposta);

    // 3. ETAPA 2: Converte o texto gerado em Áudio PCM 24kHz usando o modelo TTS do Gemini
    const urlTts = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const resTts = await fetch(urlTts, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: textoResposta }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
      }),
    });

    const dataTts = await resTts.json();
    if (!resTts.ok) {
      console.error("Erro Gemini TTS:", JSON.stringify(dataTts));
      return res.status(500).json({ etapa: "gemini_tts", textoGerado: textoResposta, erro: dataTts });
    }

    const partAudio = dataTts.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!partAudio) {
      return res.status(500).json({ etapa: "sem_audio_no_tts", dataTts });
    }

    const pcm24k = Buffer.from(partAudio.inlineData.data, "base64");
    const pcm16k = reamostrar24kPara16k(pcm24k);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", pcm16k.length);
    return res.status(200).send(pcm16k);

  } catch (err) {
    console.error("Erro Geral:", err.message);
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
      const amostra = buf24k.readInt16LE(idxOrigem);
      buf16k.writeInt16LE(amostra, i * 2);
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
