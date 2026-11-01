// api/totem-angra.js (Atualizado com Rigor contra Alucinação de Áudio Vazio)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "Mestre de RPG Online!" });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const estadoAtual = decodeURIComponent(
      req.headers["x-estado-rpg"] || "ETAPA:SELECAO | ESTILO:NENHUM | ULTIMO_AUDIO:2"
    );

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      return res.status(200).json({ ignorado: true });
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);
    const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptRPG = `
Você é o Mestre de um RPG Medieval. 

ESTADO ATUAL: "${estadoAtual}"

ATENÇÃO CRÍTICA (REGRA ABSOLUTA DE SILÊNCIO):
- Se o arquivo de áudio contiver apenas vento, chiado de fundo, som de moto ou carro, eco, ruído da mesa ou silêncio (sem uma frase clara dita por uma pessoa), você DEVE retornar obrigatoriamente: {"ignorado": true}.
- NUNCA invente que o usuário disse "escolha finalizada" ou qualquer outra frase se o áudio estiver vazio ou apenas com ruídos. Se houver dúvida, retorne {"ignorado": true}.

COMANDOS DE SISTEMA:
1. REPETIR: "repetir", "repete", "não ouvi" -> {"acao_sistema": "REPETIR_ULTIMO", "faixas": []}
2. SALVAR: "salvar jogo" -> {"acao_sistema": "SALVAR_JOGO", "faixas": []}
3. CONTINUAR: "continuar jogo" -> {"acao_sistema": "CARREGAR_JOGO", "faixas": []}

FAIXAS MP3 DA AVENTURA:
- 2: Escolha de equipamento (Guardião=11, Explorador=12, Estrategista=13) | 3: Início da marcha (ao falar "escolha finalizada")
- ATO 2: 11, 12, 13 | ATO 3: 21, 22, 23 | ATO 4: 31, 32, 33, 34 | ATO 5: 41, 42 | Vitórias: 51, 52, 53 | Mortes: 61 a 66

Retorne APENAS um JSON válido:
{
  "ignorado": false,
  "acao_sistema": "NENHUMA",
  "transcricao": "o que a pessoa disse",
  "faixas": [3, 11],
  "novo_estado": "ETAPA:VALE | ESTILO:GUARDIAO | ULTIMO_AUDIO:11"
}`;

    const resGemini = await fetch(urlGemini, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/wav", data: wavBuffer.toString("base64") } },
              { text: promptRPG },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    const data = await resGemini.json();
    const textoJson = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return res.status(200).send(textoJson);
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
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
