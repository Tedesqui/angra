// api/totem-angra.js (Mestre de RPG Acessível com Boas-Vindas e Escolha de Aventura)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Audio-Acessivel Online (Com Boas-Vindas e Save)!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    const acaoInicial = req.headers["x-acao-inicial"] || "";
    const memoriaAnterior = decodeURIComponent(
      req.headers["x-memoria-rpg"] ||
        "Início da aventura. O jogador acabou de entrar no mundo do RPG."
    );

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let bodyGeminiTexto;

    // CENÁRIO A: Aparelho acabou de ligar -> Mestre dá boas-vindas e pergunta sobre o save
    if (acaoInicial === "boas_vindas") {
      const temJogoSalvo = !memoriaAnterior.includes("Início da aventura");

      const promptBoasVindas = `
Você é um Mestre de RPG narrativo criado especialmente para pessoas cegas.
O aparelho acabou de ser ligado. Crie uma fala de boas-vindas calorosa e clara (máximo de 4 frases curtas, até 55 palavras, sem emojis, asteriscos ou formatação markdown):
1. Dê as boas-vindas ao RPG de Aventuras por Voz.
2. ${
        temJogoSalvo
          ? `Diga que encontrou uma aventura salva e pergunte com clareza: "Você quer continuar de onde parou ou quer começar uma nova aventura?"`
          : `Pergunte qual tipo de aventura a pessoa quer jogar hoje: Fantasia Medieval, Mistério ou Ficção Científica.`
      }

Retorne APENAS um JSON com as chaves:
- "transcricao": "[Aparelho Ligado - Boas Vindas]"
- "resposta": O texto falado de boas-vindas e a pergunta.
- "memoria_atualizada": "${memoriaAnterior}"
`;

      bodyGeminiTexto = {
        contents: [{ role: "user", parts: [{ text: promptBoasVindas }] }],
        generationConfig: { responseMimeType: "application/json" },
      };
    } 
    // CENÁRIO B: Turno normal do jogo -> Processa a fala do jogador
    else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const pcmBuffer = Buffer.concat(chunks);

      if (pcmBuffer.length < 1000) {
        throw new Error(`Audio muito curto recebido: ${pcmBuffer.length} bytes`);
      }

      const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

      const promptRPG = `
Você é um Mestre de RPG narrativo e imersivo criado especialmente para pessoas cegas.
Use descrições sensoriais ricas (sons do ambiente, ecos, vento, passos, cheiros, texturas), mas mantenha cada resposta concisa (máximo de 3 a 4 frases curtas, até 45 palavras) para a narração por voz ficar dinâmica.
Sempre termine narrando o que acontece e fazendo uma pergunta clara de escolha ou de rumo (sem emojis, sem asteriscos e sem markdown).

MEMÓRIA ATUAL DA AVENTURA ATÉ AQUI:
"${memoriaAnterior}"

INSTRUÇÕES DE RETORNO (JSON OBRIGATÓRIO):
Ouça o áudio do jogador e retorne APENAS um objeto JSON com estas 3 chaves:
1. "transcricao": O que o jogador disse no áudio.
2. "resposta": A continuação da história seguindo a decisão do jogador, terminando com uma pergunta de escolha. Se o jogador respondeu que quer "nova aventura" ou "recomeçar", limpe a história e comece um tema novo.
3. "memoria_atualizada": O resumo atualizado da história (cenário atual, itens, última decisão). Se o jogador pediu nova aventura, reinicie a memória do zero.
`;

      bodyGeminiTexto = {
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
        generationConfig: { responseMimeType: "application/json" },
      };
    }

    const resTexto = await fetch(urlTexto, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyGeminiTexto),
    });

    const dataTexto = await resTexto.json();
    if (!resTexto.ok) {
      return res.status(500).json({ etapa: "gemini_texto", erro: dataTexto });
    }

    const jsonBruto = dataTexto.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let dados = {
      transcricao: "...",
      resposta: "Bem-vindo ao RPG por voz. Você quer continuar de onde parou ou iniciar uma nova aventura?",
      memoria_atualizada: memoriaAnterior,
    };

    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

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
              prebuiltVoiceConfig: { voiceName: "Charon" }, // Voz imponente de narrador
            },
          },
        },
      }),
    });

    const dataTts = await resTts.json();
    if (!resTts.ok) {
      return res.status(500).json({ etapa: "gemini_tts", erro: dataTts });
    }

    const partAudio = dataTts.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!partAudio) {
      return res.status(500).json({ etapa: "sem_audio_no_tts", dataTts });
    }

    const pcm24k = Buffer.from(partAudio.inlineData.data, "base64");
    const pcm16k = reamostrar24kPara16k(pcm24k);

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

    let amostraSuave = Math.round(s1 + (s2 - s1) * fracao);
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
