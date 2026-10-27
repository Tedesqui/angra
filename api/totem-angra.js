// api/totem-angra.js (Node.js na Vercel)
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const config = {
  api: { bodyParser: false }, // Recebe os bytes binários puros do XIAO
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // 1. Lê os bytes PCM vindos do Seeed XIAO e monta um cabeçalho WAV em memória
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 2. Chama o Gemini 2.5 Flash passando o áudio do turista
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav",
          data: wavBuffer.toString("base64"),
        },
      },
      `Você é o guia oficial do Totem Turístico de Angra dos Reis - RJ.
       Responda à pergunta do áudio de forma calorosa, direta e em no máximo 2 frases curtas (máximo 35 palavras).
       Se o usuário falar em inglês ou espanhol, responda no idioma dele.`,
    ]);

    const textoResposta = result.response.text().trim();
    console.log("Resposta gerada:", textoResposta);

    // 3. Converte o texto em voz (TTS) já em PCM 16-bit 16000Hz Mono
    // Usando a API REST do Google Cloud TTS (ou Gemini Audio Output)
    const ttsRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: textoResposta },
          voice: { languageCode: "pt-BR", name: "pt-BR-Neural2-B" },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 16000,
          },
        }),
      }
    );

    const ttsJson = await ttsRes.json();
    const audioWavFinal = Buffer.from(ttsJson.audioContent, "base64");

    // Remove os primeiros 44 bytes (cabeçalho WAV) para entregar só o som PCM puro ao XIAO
    const pcmPuroResposta = audioWavFinal.subarray(44);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", pcmPuroResposta.length);
    return res.status(200).send(pcmPuroResposta);

  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
}

function adicionarCabecalhoWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); // 16-bit
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}