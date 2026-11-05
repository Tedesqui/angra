// api/totem-angra.js (Com Trava Estrita por Cena em JavaScript + Sem Exemplo Viciado)
export const config = {
  api: { bodyParser: false },
};

// ============================================================================
// TRAVA ESTRITA EM JAVASCRIPT: Lista exata de faixas que podem ser acionadas
// a partir de cada ULTIMO_AUDIO. Se não estiver na lista da pergunta atual, é bloqueado!
// ============================================================================
const FAIXAS_PERMITIDAS_POR_AUDIO = {
  // Menu Principal
  85: [1, 2, 86],

  // Seleção de Personagens da Suméria (86 = Menu, 87 a 92 = Descrições)
  86: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  87: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  88: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  89: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  90: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  91: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],
  92: [87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101],

  // As 33 Ações da Suméria (Cada pergunta SÓ aceita suas próprias respostas)
  101: [107, 130, 116],       // Ação 1: só aceita 7, 30 ou 16
  102: [117, 112],            // Ação 2: só aceita 17 ou 12
  103: [128, 116],            // Ação 3: só aceita 28 ou 16
  104: [130, 111],            // Ação 4: só aceita 30 ou 11
  105: [121, 110],            // Ação 5: só aceita 21 ou 10
  106: [114, 127],            // Ação 6: só aceita 14 ou 27
  107: [119, 103, 123],       // Ação 7: só aceita 19, 3 ou 23
  108: [120, 125],            // Ação 8: só aceita 20 ou 25
  109: [85],                  // Fim de jogo
  110: [133, 109],            // Ação 10: só aceita 33 ou 9
  111: [85],                  // Fim de jogo
  112: [126, 132],            // Ação 12: só aceita 26 ou 32
  113: [115, 126],            // Ação 13: só aceita 15 ou 26
  114: [113, 112],            // Ação 14: só aceita 13 ou 12
  115: [85],                  // Fim de jogo
  116: [104, 122],            // Ação 16: só aceita 4 ou 22
  117: [85],                  // Fim de jogo
  118: [131, 124],            // Ação 18: só aceita 31 ou 24
  119: [129, 108, 105],       // Ação 19: só aceita 29, 8 ou 5
  120: [85],                  // Fim de jogo
  121: [85],                  // Fim de jogo
  122: [118],                 // Ação 22: só aceita 18
  123: [106, 127],            // Ação 23: só aceita 6 ou 27
  124: [85],                  // Fim de jogo
  125: [85],                  // Fim de jogo
  126: [85],                  // Fim de jogo
  127: [112, 132, 107],       // Ação 27: só aceita 12, 32 ou 7
  128: [110],                 // Ação 28: só aceita 10
  129: [108],                 // Ação 29: só aceita 8
  130: [106, 127, 119, 123],  // Ação 30: só aceita 6, 27, 19 ou 23
  131: [102, 124],            // Ação 31: só aceita 2 ou 24
  132: [85],                  // Fim de jogo
  133: [85],                  // Fim de jogo

  // O Resgate do Príncipe Arthur (Faixas 2 a 84)
  2:  [3, 71],
  71: [72, 73],
  72: [74, 83],
  73: [74, 62],
  74: [11, 12, 13, 62],
  11: [75, 61],
  12: [75, 62],
  13: [75],
  75: [76, 61],
  76: [77, 65],
  77: [78, 64],
  78: [21, 22, 23, 63],
  21: [79, 63],
  22: [79, 64],
  23: [79, 63],
  79: [80, 65],
  80: [81, 84],
  81: [82, 65],
  82: [31, 32, 62],
  31: [34, 33, 65],
  32: [42, 33, 62],
  33: [42, 41, 63],
  34: [41, 42, 65],
  41: [51, 53, 66],
  42: [51, 52, 66],
};

function extrairUltimoAudio(estadoStr) {
  const match = estadoStr.match(/ULTIMO_AUDIO:(\d+)/);
  return match ? parseInt(match[1], 10) : 85;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Online - Trava Estrita por Pergunta Ativada!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const estadoAtual = decodeURIComponent(
      req.headers["x-estado-rpg"] || "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"
    );
    const ultimoAudioAtual = extrairUltimoAudio(estadoAtual);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      return res.status(200).json({ ignorado: true });
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);
    const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptRPG = `
Você é o Motor Lógico de um console de Histórias Interativas controlado por voz.
ATENÇÃO: Você DEVE avaliar EXCLUSIVAMENTE a regra para o ULTIMO_AUDIO = ${ultimoAudioAtual}.
Ignore todas as outras cenas que não sejam ULTIMO_AUDIO = ${ultimoAudioAtual}.

ESTADO ATUAL DO JOGADOR:
"${estadoAtual}"

=====================================================================
1. REGRA CONTRA RUÍDO E SILÊNCIO:
=====================================================================
- Se o áudio contiver apenas chiado, vento, chuva, batida, som de motor, eco ou silêncio sem fala humana nítida, retorne OBRIGATORIAMENTE: {"ignorado": true}.

=====================================================================
2. REGRA DE OURO: A RESPOSTA SÓ SERVE PARA A PERGUNTA ATUAL (ULTIMO_AUDIO = ${ultimoAudioAtual})
=====================================================================
- Verifique abaixo QUAIS são as únicas respostas aceitas para ULTIMO_AUDIO = ${ultimoAudioAtual}.
- Se o que o jogador disse NÃO corresponder a nenhuma opção válida do ULTIMO_AUDIO = ${ultimoAudioAtual}, retorne OBRIGATORIAMENTE:
  "faixas": [], "acao_sistema": "NENHUMA", e mantenha EXATAMENTE o mesmo "novo_estado": "${estadoAtual}".

=====================================================================
3. COMANDOS DE SISTEMA (Aceitos a qualquer momento):
=====================================================================
- "repetir", "repete", "não ouvi", "fala de novo" -> "acao_sistema": "REPETIR_ULTIMO", "faixas": [], "novo_estado": "${estadoAtual}"
- "menu principal", "trocar história", "repetir apresentação" -> "acao_sistema": "REPETIR_APRESENTACAO", "faixas": [85], "novo_estado": "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"
- "salvar jogo", "salvar progresso" -> "acao_sistema": "SALVAR_JOGO", "faixas": [], "novo_estado": "${estadoAtual}"
- "continuar jogo", "carregar jogo" -> "acao_sistema": "CARREGAR_JOGO", "faixas": [], "novo_estado": "${estadoAtual}"
- "reiniciar", "começar do zero" -> "acao_sistema": "NENHUMA", "faixas": [85], "novo_estado": "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"

=====================================================================
4. REGRAS DE TRANSIÇÃO POR ULTIMO_AUDIO:
=====================================================================

[SE ULTIMO_AUDIO = 85 (Menu Principal de Histórias)]
- Dizer "Aventura na Suméria" / "Suméria" / "primeira história":
  -> "faixas": [86], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:NENHUM | ROTA:NENHUMA | ULTIMO_AUDIO:86"
- Dizer "O Resgate do Príncipe Arthur" / "Príncipe Arthur" / "Arthur" / "segunda história":
  -> "faixas": [1, 2], "novo_estado": "HISTORIA:ARTHUR | ETAPA:SELECAO | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:2"

[SE ULTIMO_AUDIO = 86 (Menu de Personagens da Suméria)]
- Se o jogador disser o nome de um personagem para ouvir sobre ele ("Mago", "Duende", "Camponês", "Sábio", "Mercenário", "Guerreiro"):
  - "Mago" / "Maga" -> "faixas": [87], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:MAGO | ROTA:NENHUMA | ULTIMO_AUDIO:87"
  - "Duende" -> "faixas": [88], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:DUENDE | ROTA:NENHUMA | ULTIMO_AUDIO:88"
  - "Camponês" / "Camponesa" -> "faixas": [89], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:CAMPONES | ROTA:NENHUMA | ULTIMO_AUDIO:89"
  - "Sábio" / "Sábia" -> "faixas": [90], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:SABIO | ROTA:NENHUMA | ULTIMO_AUDIO:90"
  - "Mercenário" / "Mercenária" -> "faixas": [91], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:MERCENARIO | ROTA:NENHUMA | ULTIMO_AUDIO:91"
  - "Guerreiro" / "Guerreira" -> "faixas": [92], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:GUERREIRO | ROTA:NENHUMA | ULTIMO_AUDIO:92"
- Se o jogador disser explicitamente que JÁ QUER CONFIRMAR E INICIAR com aquele personagem ("confirmar mago", "quero começar com guerreiro"):
  - Mago -> "faixas": [87, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:MAGO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
  - Duende -> "faixas": [88, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:DUENDE | ROTA:NENHUMA | ULTIMO_AUDIO:101"
  - Camponês -> "faixas": [89, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:CAMPONES | ROTA:NENHUMA | ULTIMO_AUDIO:101"
  - Sábio -> "faixas": [90, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:SABIO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
  - Mercenário -> "faixas": [91, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:MERCENARIO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
  - Guerreiro -> "faixas": [92, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:GUERREIRO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
- NOTA: NUNCA retorne a faixa 107 na seleção de personagem! O início da aventura é SEMPRE [93, 98, 99, 100, 101] com ULTIMO_AUDIO:101.

[SE ULTIMO_AUDIO = 87, 88, 89, 90, 91 ou 92 (Acabou de ouvir a descrição de um personagem da Suméria)]
- Se o jogador CONFIRMAR o personagem ("confirmar", "quero esse", "escolho esse", "sim", "começar"):
  -> "faixas": [93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:<mantenha o atual> | ROTA:NENHUMA | ULTIMO_AUDIO:101"
- Se o jogador pedir para ouvir OUTRO personagem ("Mago", "Duende", "Camponês", "Sábio", "Mercenário", "Guerreiro"):
  -> Toque apenas a faixa da descrição correspondente ([87] a [92]) e atualize o ESTILO e ULTIMO_AUDIO (87 a 92).

[AÇÕES DA AVENTURA NA SUMÉRIA - CADA PERGUNTA SÓ ACEITA SUAS PRÓPRIAS RESPOSTAS]
- SE ULTIMO_AUDIO = 101: Aceita APENAS número 7 (-> faixas:[107], ULTIMO_AUDIO:107), número 30 (-> faixas:[130], ULTIMO_AUDIO:130) ou número 16 (-> faixas:[116], ULTIMO_AUDIO:116).
- SE ULTIMO_AUDIO = 102: Aceita APENAS número 17 (-> faixas:[117], ULTIMO_AUDIO:117) ou número 12 (-> faixas:[112], ULTIMO_AUDIO:112).
- SE ULTIMO_AUDIO = 103: Aceita APENAS número 28 (-> faixas:[128], ULTIMO_AUDIO:128) ou número 16 (-> faixas:[116], ULTIMO_AUDIO:116).
- SE ULTIMO_AUDIO = 104: Aceita APENAS número 30 (-> faixas:[130], ULTIMO_AUDIO:130) ou número 11 (-> faixas:[111], ULTIMO_AUDIO:111).
- SE ULTIMO_AUDIO = 105: Aceita APENAS número 21 (-> faixas:[121], ULTIMO_AUDIO:121) ou número 10 (-> faixas:[110], ULTIMO_AUDIO:110).
- SE ULTIMO_AUDIO = 106: Aceita APENAS número 14 (-> faixas:[114], ULTIMO_AUDIO:114) ou número 27 (-> faixas:[127], ULTIMO_AUDIO:127).
- SE ULTIMO_AUDIO = 107: Aceita APENAS número 19 (-> faixas:[119], ULTIMO_AUDIO:119), número 3 (-> faixas:[103], ULTIMO_AUDIO:103) ou número 23 (-> faixas:[123], ULTIMO_AUDIO:123).
- SE ULTIMO_AUDIO = 108: Aceita APENAS número 20 (-> faixas:[120], ULTIMO_AUDIO:120) ou número 25 (-> faixas:[125], ULTIMO_AUDIO:125).
- SE ULTIMO_AUDIO = 110: Aceita APENAS número 33 (-> faixas:[133], ULTIMO_AUDIO:133) ou número 9 (-> faixas:[109], ULTIMO_AUDIO:109).
- SE ULTIMO_AUDIO = 112: Aceita APENAS número 26 (-> faixas:[126], ULTIMO_AUDIO:126) ou número 32 (-> faixas:[132], ULTIMO_AUDIO:132).
- SE ULTIMO_AUDIO = 113: Aceita APENAS número 15 (-> faixas:[115], ULTIMO_AUDIO:115) ou número 26 (-> faixas:[126], ULTIMO_AUDIO:126).
- SE ULTIMO_AUDIO = 114: Aceita APENAS número 13 (-> faixas:[113], ULTIMO_AUDIO:113) ou número 12 (-> faixas:[112], ULTIMO_AUDIO:112).
- SE ULTIMO_AUDIO = 116: Aceita APENAS número 4 (-> faixas:[104], ULTIMO_AUDIO:104) ou número 22 (-> faixas:[122], ULTIMO_AUDIO:122).
- SE ULTIMO_AUDIO = 118: Aceita APENAS número 31 (-> faixas:[131], ULTIMO_AUDIO:131) ou número 24 (-> faixas:[124], ULTIMO_AUDIO:124).
- SE ULTIMO_AUDIO = 119: Aceita APENAS número 29 (-> faixas:[129], ULTIMO_AUDIO:129), número 8 (-> faixas:[108], ULTIMO_AUDIO:108) ou número 5 (-> faixas:[105], ULTIMO_AUDIO:105).
- SE ULTIMO_AUDIO = 122: Aceita APENAS número 18 (-> faixas:[118], ULTIMO_AUDIO:118).
- SE ULTIMO_AUDIO = 123: Aceita APENAS número 6 (-> faixas:[106], ULTIMO_AUDIO:106) ou número 27 (-> faixas:[127], ULTIMO_AUDIO:127).
- SE ULTIMO_AUDIO = 127: Aceita APENAS número 12 (-> faixas:[112], ULTIMO_AUDIO:112), número 32 (-> faixas:[132], ULTIMO_AUDIO:132) ou número 7 (-> faixas:[107], ULTIMO_AUDIO:107).
- SE ULTIMO_AUDIO = 128: Aceita APENAS número 10 (-> faixas:[110], ULTIMO_AUDIO:110).
- SE ULTIMO_AUDIO = 129: Aceita APENAS número 8 (-> faixas:[108], ULTIMO_AUDIO:108).
- SE ULTIMO_AUDIO = 130: Aceita APENAS número 6 (-> faixas:[106], ULTIMO_AUDIO:106), número 27 (-> faixas:[127], ULTIMO_AUDIO:127), número 19 (-> faixas:[119], ULTIMO_AUDIO:119) ou número 23 (-> faixas:[123], ULTIMO_AUDIO:123).
- SE ULTIMO_AUDIO = 131: Aceita APENAS número 2 (-> faixas:[102], ULTIMO_AUDIO:102) ou número 24 (-> faixas:[124], ULTIMO_AUDIO:124).
- SE ULTIMO_AUDIO = 109, 111, 115, 117, 120, 121, 124, 125, 126, 132, 133: Fim de jogo (só aceita reiniciar ou menu principal -> faixas:[85], ULTIMO_AUDIO:85).

[O RESGATE DO PRÍNCIPE ARTHUR - FAIXAS 2 A 84]
- SE ULTIMO_AUDIO = 2: 1ª/Guardião (ESTILO:GUARDIAO), 2ª/Explorador (ESTILO:EXPLORADOR), 3ª/Estrategista (ESTILO:ESTRATEGISTA). Se confirmar/iniciar -> "faixas": [3, 71], ULTIMO_AUDIO:71.
- SE ULTIMO_AUDIO = 71: 1ª -> [72] (ULTIMO_AUDIO:72) | 2ª ou 3ª -> [73] (ULTIMO_AUDIO:73).
- SE ULTIMO_AUDIO = 72: 1ª ou 2ª -> [74] (ULTIMO_AUDIO:74) | 3ª -> [83] (ULTIMO_AUDIO:83).
- SE ULTIMO_AUDIO = 73: 1ª ou 2ª -> [74] (ULTIMO_AUDIO:74) | 3ª -> [62] (ULTIMO_AUDIO:62).
- SE ULTIMO_AUDIO = 74: 1ª ou 2ª -> (GUARDIAO:[11], EXPLORADOR:[12], ESTRATEGISTA:[13]) | 3ª -> [62] (ULTIMO_AUDIO:62).
- SE ULTIMO_AUDIO = 11: 1ª -> [75] (ROTA:MOINHO, ULTIMO_AUDIO:75) | 2ª -> [61] (ULTIMO_AUDIO:61) | 3ª -> [75] (ROTA:PONTE, ULTIMO_AUDIO:75).
- SE ULTIMO_AUDIO = 12: 1ª -> [75] (ROTA:MOINHO, ULTIMO_AUDIO:75) | 2ª -> [75] (ROTA:PONTE, ULTIMO_AUDIO:75) | 3ª -> [62] (ULTIMO_AUDIO:62).
- SE ULTIMO_AUDIO = 13: 1ª -> [75] (ROTA:MOINHO, ULTIMO_AUDIO:75) | 2ª -> [75] (ROTA:PONTE, ULTIMO_AUDIO:75) | 3ª -> [75] (ROTA:ROCHAS, ULTIMO_AUDIO:75).
- SE ULTIMO_AUDIO = 75: 1ª ou 2ª -> [76] (ULTIMO_AUDIO:76) | 3ª -> [61] (ULTIMO_AUDIO:61).
- SE ULTIMO_AUDIO = 76: 1ª ou 2ª -> [77] (ULTIMO_AUDIO:77) | 3ª -> [65] (ULTIMO_AUDIO:65).
- SE ULTIMO_AUDIO = 77: 1ª ou 2ª -> [78] (ULTIMO_AUDIO:78) | 3ª -> [64] (ULTIMO_AUDIO:64).
- SE ULTIMO_AUDIO = 78: 1ª ou 2ª -> (MOINHO:[21], PONTE:[22], ROCHAS:[23]) | 3ª -> [63] (ULTIMO_AUDIO:63).
- SE ULTIMO_AUDIO = 21: 1ª ou 2ª -> [79] (ULTIMO_AUDIO:79) | 3ª -> [63] (ULTIMO_AUDIO:63).
- SE ULTIMO_AUDIO = 22: 1ª ou 2ª -> [79] (ULTIMO_AUDIO:79) | 3ª -> [64] (ULTIMO_AUDIO:64).
- SE ULTIMO_AUDIO = 23: 1ª ou 2ª -> [79] (ULTIMO_AUDIO:79) | 3ª -> [63] (ULTIMO_AUDIO:63).
- SE ULTIMO_AUDIO = 79: 1ª ou 2ª -> [80] (ULTIMO_AUDIO:80) | 3ª -> [65] (ULTIMO_AUDIO:65).
- SE ULTIMO_AUDIO = 80: 1ª ou 2ª -> [81] (ULTIMO_AUDIO:81) | 3ª -> [84] (ULTIMO_AUDIO:84).
- SE ULTIMO_AUDIO = 81: 1ª ou 2ª -> [82] (ULTIMO_AUDIO:82) | 3ª -> [65] (ULTIMO_AUDIO:65).
- SE ULTIMO_AUDIO = 82: 1ª -> [31] (ULTIMO_AUDIO:31) | 2ª -> [32] (ULTIMO_AUDIO:32) | 3ª -> [62] (ULTIMO_AUDIO:62).
- SE ULTIMO_AUDIO = 31: 1ª -> [34] (ULTIMO_AUDIO:34) | 2ª -> [33] (ULTIMO_AUDIO:33) | 3ª -> [65] (ULTIMO_AUDIO:65).
- SE ULTIMO_AUDIO = 32: 1ª -> [42] (ULTIMO_AUDIO:42) | 2ª -> [33] (ULTIMO_AUDIO:33) | 3ª -> [62] (ULTIMO_AUDIO:62).
- SE ULTIMO_AUDIO = 33: 1ª -> [42] (ULTIMO_AUDIO:42) | 2ª -> [41] (ULTIMO_AUDIO:41) | 3ª -> [63] (ULTIMO_AUDIO:63).
- SE ULTIMO_AUDIO = 34: 1ª -> [41] (ULTIMO_AUDIO:41) | 2ª -> [42] (ULTIMO_AUDIO:42) | 3ª -> [65] (ULTIMO_AUDIO:65).
- SE ULTIMO_AUDIO = 41: 1ª -> [51] (ULTIMO_AUDIO:51) | 2ª -> [53] (ULTIMO_AUDIO:53) | 3ª -> [66] (ULTIMO_AUDIO:66).
- SE ULTIMO_AUDIO = 42: 1ª -> [51] (ULTIMO_AUDIO:51) | 2ª -> [52] (ULTIMO_AUDIO:52) | 3ª -> [66] (ULTIMO_AUDIO:66).

Retorne APENAS um objeto JSON válido com as chaves:
"ignorado" (boolean), "acao_sistema" (string), "transcricao" (string), "faixas" (array de inteiros), "novo_estado" (string).`;

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
    let respostaObj;

    try {
      respostaObj = JSON.parse(textoJson);
    } catch {
      return res.status(200).json({ ignorado: true });
    }

    // ========================================================================
    // VALIDAÇÃO RÍGIDA NO BACKEND (BLOQUEIA QUALQUER FAIXA FORA DA PERGUNTA ATUAL)
    // ========================================================================
    if (
      !respostaObj.ignorado &&
      (!respostaObj.acao_sistema || respostaObj.acao_sistema === "NENHUMA") &&
      Array.isArray(respostaObj.faixas) &&
      respostaObj.faixas.length > 0
    ) {
      const permitidas = FAIXAS_PERMITIDAS_POR_AUDIO[ultimoAudioAtual] || [85];

      // Se for um comando explícito de reiniciar voltando ao menu 85, permite
      const ehReinicioMenu =
        respostaObj.faixas.length === 1 && respostaObj.faixas[0] === 85;

      const todasFaixasValidas =
        ehReinicioMenu ||
        respostaObj.faixas.every((faixa) => permitidas.includes(faixa));

      if (!todasFaixasValidas) {
        // Bloqueia na hora! Zera as faixas e mantém exatamente o estado anterior
        respostaObj.faixas = [];
        respostaObj.novo_estado = estadoAtual;
      }
    }

    return res.status(200).json(respostaObj);
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
