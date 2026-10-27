// api/totem-angra.js (Mestre de RPG Acessível com Memória de Estado)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Audio-Acessivel Online!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    // 1. Lê a memória acumulada das rodadas anteriores enviada pelo Seeed XIAO
    const memoriaAnterior = decodeURIComponent(req.headers["x-memoria-rpg"] || "Início da aventura. O jogador acabou de começar.");

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 2. ETAPA 1: Gemini 2.5 Flash processa a ação do jogador + memória da história
    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptRPG = `
Você é um Mestre de RPG narrativo e imersivo criado especialmente para pessoas cegas.
Use descrições sensoriais ricas (sons do ambiente, ecos, vento, cheiros, texturas) mas mantenha cada resposta concisa (máximo de 3 a 4 frases curtas, até 45 palavras) para a narração por voz ficar dinâmica.
Sempre termine narrando o que acontece e dando 2 opções claras ou perguntando o que o jogador faz agora.

MEMÓRIA ATUAL DA AVENTURA ATÉ AQUI:
"${memoriaAnterior}"

INSTRUÇÕES DE RETORNO (JSON OBRIGATÓRIO):
Ouça o áudio do jogador e retorne APENAS um JSON com estas 3 chaves:
1. "transcricao": O que o jogador disse no áudio.
2. "resposta": A continuação emocionante da história seguindo a decisão do jogador, terminando com uma pergunta de escolha (sem emojis ou asteriscos).
3. "memoria_atualizada": Um resumo em 2 ou 3 frases curtas acumulando tudo o que é importante na história até agora (cenário atual, itens obtidos, aliados/inimigos, última decisão tomada). Se o jogador pediu "novo jogo" ou "recomeçar", reinicie a memória com uma nova aventura.
`;

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
              { text: promptRPG },
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
    let dados = {
      transcricao: "...",
      resposta: "Você está diante dos portões de uma antiga fortaleza. Ouça o vento uivando. Você entra em silêncio ou chama pelo guarda?",
      memoria_atualizada: memoriaAnterior,
    };

    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

    // 3. ETAPA 2: Converte a narração da história em voz expressiva (PCM 24kHz)
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
              prebuiltVoiceConfig: { voiceName: "Charon" }, // Voz profunda de narrador de RPG (ou "Aoede" / "Puck")
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

    // Devolve a transcrição, a narração e a MEMÓRIA ATUALIZADA para o Seeed XIAO guardar
    res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || ""));
    res.setHeader("X-Resposta", encodeURIComponent(dados.resposta || ""));
    res.setHeader("X-Memoria-RPG", encodeURIComponent(dados.memoria_atualizada || ""));
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
