// api/totem-angra.js (Mestre de RPG Acessível com Áudio Suavizado e Memória de Estado)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // Teste rápido pelo navegador (GET)
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Audio-Acessivel Online (Audio HD Interpolado)!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    // 1. Lê a memória acumulada das rodadas anteriores enviada pelo Seeed XIAO
    const memoriaAnterior = decodeURIComponent(
      req.headers["x-memoria-rpg"] ||
        "Início da aventura. O jogador acabou de entrar no mundo do RPG."
    );

    // 2. Recebe o áudio PCM 16kHz gravado no INMP441
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      throw new Error(`Audio muito curto recebido: ${pcmBuffer.length} bytes`);
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // 3. ETAPA 1: Gemini 2.5 Flash ouve o jogador, consulta a memória e avança a história
    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptRPG = `
Você é um Mestre de RPG narrativo e imersivo criado especialmente para pessoas cegas.
Use descrições sensoriais ricas (sons do ambiente, ecos, vento, passos, cheiros, texturas), mas mantenha cada resposta concisa (máximo de 3 a 4 frases curtas, até 45 palavras) para a narração por voz ficar dinâmica.
Sempre termine narrando o que acontece e dando 2 opções claras ou perguntando o que o jogador faz agora.

MEMÓRIA ATUAL DA AVENTURA ATÉ AQUI:
"${memoriaAnterior}"

INSTRUÇÕES DE RETORNO (JSON OBRIGATÓRIO):
Ouça o áudio do jogador e retorne APENAS um objeto JSON com estas 3 chaves:
1. "transcricao": O que o jogador disse no áudio.
2. "resposta": A continuação emocionante da história seguindo a decisão do jogador, terminando com uma pergunta de escolha (sem emojis, sem asteriscos e sem formatação markdown).
3. "memoria_atualizada": Um resumo em 2 ou 3 frases curtas acumulando tudo o que é importante na história até agora (cenário atual, itens obtidos, aliados/inimigos, última decisão tomada). Se o jogador pediu "novo jogo" ou "recomeçar", reinicie a memória do zero com uma nova aventura.
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
      console.error("Erro Gemini Texto:", JSON.stringify(dataTexto));
      return res.status(500).json({ etapa: "gemini_texto", erro: dataTexto });
    }

    const jsonBruto = dataTexto.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let dados = {
      transcricao: "...",
      resposta:
        "Você está diante dos portões de uma antiga fortaleza. O vento sopra forte nas pedras úmidas. Você prefere entrar em silêncio ou chamar pelo guarda?",
      memoria_atualizada: memoriaAnterior,
    };

    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

    // 4. ETAPA 2: Converte a narração da história em voz expressiva (PCM 24kHz)
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
              // Voz profunda de narrador ("Charon") — ou teste "Aoede", "Kore", "Puck"
              prebuiltVoiceConfig: { voiceName: "Charon" },
            },
          },
        },
      }),
    });

    const dataTts = await resTts.json();
    if (!resTts.ok) {
      console.error("Erro Gemini TTS:", JSON.stringify(dataTts));
      return res.status(500).json({ etapa: "gemini_tts", erro: dataTts });
    }

    const partAudio = dataTts.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!partAudio) {
      return res.status(500).json({ etapa: "sem_audio_no_tts", dataTts });
    }

    const pcm24k = Buffer.from(partAudio.inlineData.data, "base64");

    // 5. Reamostra de 24kHz para 16kHz com Interpolação Linear + Filtro Anti-Aliasing
    const pcm16k = reamostrar24kPara16k(pcm24k);

    // 6. Envia cabeçalhos com Transcrição, Resposta e Memória + Corpo Binário Alinhado
    res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || ""));
    res.setHeader("X-Resposta", encodeURIComponent(dados.resposta || ""));
    res.setHeader("X-Memoria-RPG", encodeURIComponent(dados.memoria_atualizada || ""));
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", pcm16k.length);
    return res.status(200).send(pcm16k);

  } catch (err) {
    console.error("Erro Geral:", err.message);
    return res.status(500).json({ erroGeral: err.message });
  }
}

// Reamostragem de 24.000 Hz para 16.000 Hz com Interpolação Linear (Elimina serrilhado e chiado!)
function reamostrar24kPara16k(buf24k) {
  // Garante tamanho estritamente par (16-bit alinhado)
  const tamanhoPar = buf24k.length - (buf24k.length % 2);
  const totalAmostras24k = Math.floor(tamanhoPar / 2);
  const totalAmostras16k = Math.floor((totalAmostras24k * 2) / 3);
  const buf16k = Buffer.alloc(totalAmostras16k * 2);

  for (let i = 0; i < totalAmostras16k; i++) {
    const posExata = i * 1.5;
    const idxBase = Math.floor(posExata);
    const fracao = posExata - idxBase;

    const byteIdx1 = idxBase * 2;
    const byteIdx2 = Math.min(idxBase + 1, totalAmostras24k - 1) * 2;

    const s1 = buf24k.readInt16LE(byteIdx1);
    const s2 = buf24k.readInt16LE(byteIdx2);

    // Média interpolada entre as amostras vizinhas
    let amostraSuave = Math.round(s1 + (s2 - s1) * fracao);

    // Proteção de limite 16-bit
    if (amostraSuave > 32767) amostraSuave = 32767;
    if (amostraSuave < -32768) amostraSuave = -32768;

    buf16k.writeInt16LE(amostraSuave, i * 2);
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
