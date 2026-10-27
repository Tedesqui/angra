// api/totem-angra.js
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // Se você abrir o link no navegador do Mac (GET), ele testa se a chave está configurada!
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Totem Angra Online!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A variavel GEMINI_API_KEY nao foi configurada na Vercel!");
    }

    // 1. Recebe o áudio PCM 16kHz enviado pelo Seeed XIAO
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 2. Chama o Gemini 2.5 Flash pedindo resposta DIRETO EM ÁUDIO (Voz Nativa)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
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
              text: "Você é o guia turístico oficial de Angra dos Reis - RJ. Ouça o turista e responda em português (ou no idioma que ele falar) de forma simpática, direta e muito curta (no máximo 2 frases rápidas).",
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede", // Voz natural da IA (pode trocar por "Puck" ou "Kore")
            },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro da API Gemini:", JSON.stringify(data));
      return res.status(500).json({ erroGemini: data });
    }

    // 3. Extrai o áudio PCM 24kHz gerado pelo Gemini
    const partAudio = data.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.mimeType.startsWith("audio/")
    );

    if (!partAudio) {
      console.error("Resposta sem audio:", JSON.stringify(data));
      return res.status(500).json({ erro: "Gemini nao retornou audio", data });
    }

    const pcm24k = Buffer.from(partAudio.inlineData.data, "base64");

    // 4. Converte de 24.000 Hz para 16.000 Hz para tocar na velocidade certa no XIAO
    const pcm16k = reamostrar24kPara16k(pcm24k);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", pcm16k.length);
    return res.status(200).send(pcm16k);

  } catch (err) {
    console.error("Erro interno no servidor:", err.message);
    return res.status(500).json({ erroServidor: err.message });
  }
}

// Reamostra áudio PCM 16-bit de 24kHz para 16kHz (proporção 3:2)
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
