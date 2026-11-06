// api/totem-angra.js (Otimizado para Palavras Isoladas: "10", "7", "Mago", "Sim", "Não")
export const config = {
  api: { bodyParser: false },
};

// Faixas de sistema extras na pasta /mp3/
const FAIXA_JOGAR_NOVAMENTE = 94;  // "Você deseja jogar novamente?"
const FAIXA_DESPEDIDA = 95;        // "Até a próxima aventura!"
const FAIXA_PULAR_INTRODUCAO = 96; // "Deseja pular a introdução?"

// Lista de todas as faixas que encerram a partida (Vitória ou Morte) nas duas histórias
const FAIXAS_FIM_DE_JOGO = new Set([
  102, 108, 109, 113, 117, 121, 123, 124, 127, 132, 133,
  51, 52, 53, 61, 62, 63, 64, 65, 66, 83, 84,
]);

// ============================================================================
// TABELA OFICIAL E ESTRITA DAS 33 AÇÕES DA SUMÉRIA (101 a 133)
// ============================================================================
const OPCOES_VALIDAS_SUMERIA = {
  101: [7, 30, 16],     // Ação 1
  102: [],              // Ação 2: Fim de jogo
  103: [13, 20],        // Ação 3
  104: [13, 20],        // Ação 4
  105: [10, 28],        // Ação 5
  106: [21, 17, 2],     // Ação 6
  107: [12, 25],        // Ação 7
  108: [],              // Ação 8: Fim de jogo
  109: [],              // Ação 9: Fim de jogo
  110: [19, 32],        // Ação 10
  111: [18, 23],        // Ação 11
  112: [15, 22, 4],     // Ação 12
  113: [],              // Ação 13: Fim de jogo
  114: [2, 8, 27],      // Ação 14
  115: [29, 5],         // Ação 15
  116: [27, 8],         // Ação 16
  117: [],              // Ação 17: Fim de jogo
  118: [9, 23, 26],     // Ação 18
  119: [2, 32, 14],     // Ação 19
  120: [9, 17],         // Ação 20
  121: [],              // Ação 21: Fim de jogo
  122: [24, 31],        // Ação 22
  123: [],              // Ação 23: Fim de jogo
  124: [],              // Ação 24: Fim de jogo
  125: [21, 17],        // Ação 25
  126: [33, 17],        // Ação 26
  127: [],              // Ação 27: Fim de jogo
  128: [11, 23],        // Ação 28
  129: [3, 8],          // Ação 29
  130: [6, 27],         // Ação 30
  131: [2, 24],         // Ação 31
  132: [],              // Ação 32: Fim de jogo
  133: [],              // Ação 33: Fim de jogo
};

function parseEstado(estadoStr) {
  const limpo = (estadoStr || "").replace(/\+/g, " ");
  const partes = limpo.split("|").map((s) => s.trim());
  const obj = {
    HISTORIA: "MENU",
    ETAPA: "MENU_PRINCIPAL",
    ESTILO: "NENHUM",
    ROTA: "MOINHO",
    ULTIMO_AUDIO: 85,
  };
  for (const p of partes) {
    const idx = p.indexOf(":");
    if (idx !== -1) {
      const k = p.substring(0, idx).replace(/\+/g, "").trim();
      const v = p.substring(idx + 1).replace(/\+/g, "").trim();
      if (k && v) {
        obj[k] = k === "ULTIMO_AUDIO" ? parseInt(v, 10) : v;
      }
    }
  }
  return obj;
}

function montarEstado(obj) {
  return `HISTORIA:${obj.HISTORIA} | ETAPA:${obj.ETAPA} | ESTILO:${obj.ESTILO} | ROTA:${obj.ROTA} | ULTIMO_AUDIO:${obj.ULTIMO_AUDIO}`;
}

function normalizarTexto(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "")
    .trim();
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Motor Determinístico RPG Online - Reconhecimento de Palavras Isoladas Ativo!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const headerRaw = (req.headers["x-estado-rpg"] || "").replace(/\+/g, "%20");
    const estadoRaw = decodeURIComponent(
      headerRaw ||
        "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"
    );
    const est = parseEstado(estadoRaw);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      return res.status(200).json({ ignorado: true });
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);
    const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // ========================================================================
    // PROMPT OTIMIZADO PARA PALAVRAS ISOLADAS E NÚMEROS SOLTOS
    // ========================================================================
    const promptTranscricaoCega = `
Você é um transcritor de comandos de voz em Português do Brasil.
ATENÇÃO: O usuário frequentemente fala APENAS UMA ÚNICA PALAVRA CURTA ou UM ÚNICO NÚMERO ISOLADO (exemplos: "dez", "sete", "dois", "trinta", "mago", "duende", "sábio", "camponês", "mercenário", "guerreiro", "sim", "não", "repetir").

REGRAS DE TRANSCRIÇÃO:
1. Palavras isoladas e números falados sozinhos ("10", "7", "mago", "sim") SÃO VOZ HUMANA VÁLIDA ("eh_voz_humana": true).
2. Só marque "eh_voz_humana": false se o áudio contiver exclusivamente silêncio, chiado puro ou batida seca sem nenhuma vogal humana.
3. Se a pessoa disse um número (sozinho ou em frase), preencha "numero_dito" com o valor inteiro exato (ex: se disse "dez", coloque "transcricao": "dez" e "numero_dito": 10). Se não disse número, coloque null.
4. Nunca altere o número falado por outro diferente.

Retorne APENAS este JSON:
{
  "eh_voz_humana": true,
  "transcricao": "palavra ou numero falado",
  "numero_dito": null
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
              { text: promptTranscricaoCega },
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
    let analise;

    try {
      analise = JSON.parse(textoJson);
    } catch {
      return res.status(200).json({ ignorado: true });
    }

    const fala = normalizarTexto(analise.transcricao);
    const temNumero = typeof analise.numero_dito === "number";

    // IMPORTANTE: Aceita números de 1 dígito ("7", "2", "3") sem bloquear por tamanho de string!
    if (!analise.eh_voz_humana || (!fala && !temNumero)) {
      return res.status(200).json({ ignorado: true });
    }

    // ========================================================================
    // 2. COMANDOS GLOBAIS DE SISTEMA
    // ========================================================================
    if (fala.includes("repetir apresentacao") || fala.includes("menu principal") || fala.includes("trocar historia")) {
      const novoEst = { HISTORIA: "MENU", ETAPA: "MENU_PRINCIPAL", ESTILO: "NENHUM", ROTA: "MOINHO", ULTIMO_AUDIO: 85 };
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "REPETIR_APRESENTACAO",
        transcricao: analise.transcricao,
        faixas: [85],
        novo_estado: montarEstado(novoEst),
      });
    }

    if (fala.includes("repetir") || fala.includes("repete") || fala.includes("nao ouvi") || fala.includes("fala de novo")) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "REPETIR_ULTIMO",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    if (fala.includes("salvar jogo") || fala.includes("salvar progresso") || fala.includes("guardar jogo")) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "SALVAR_JOGO",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    if (fala.includes("continuar jogo") || fala.includes("carregar jogo") || fala.includes("abrir jogo")) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "CARREGAR_JOGO",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    if (fala.includes("reiniciar") || fala.includes("comecar do zero") || fala.includes("jogar novamente") || fala.includes("jogar de novo")) {
      const novoEst = { HISTORIA: "MENU", ETAPA: "MENU_PRINCIPAL", ESTILO: "NENHUM", ROTA: "MOINHO", ULTIMO_AUDIO: 85 };
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [85],
        novo_estado: montarEstado(novoEst),
      });
    }

    // ========================================================================
    // 3. TRATAMENTO DA PERGUNTA "JOGAR NOVAMENTE?" (FAIXA 94 OU FIM DE JOGO)
    // ========================================================================
    if (est.ULTIMO_AUDIO === FAIXA_JOGAR_NOVAMENTE || FAIXAS_FIM_DE_JOGO.has(est.ULTIMO_AUDIO)) {
      const querJogar =
        fala === "sim" ||
        fala.includes("sim") ||
        fala.includes("quero") ||
        fala.includes("jogar") ||
        fala.includes("comecar") ||
        fala.includes("vamos") ||
        fala.includes("claro") ||
        fala.includes("bora");

      const querParar =
        fala === "nao" ||
        fala.includes("nao") ||
        fala.includes("parar") ||
        fala.includes("chega") ||
        fala.includes("sair");

      if (querJogar) {
        const novoEst = { HISTORIA: "MENU", ETAPA: "MENU_PRINCIPAL", ESTILO: "NENHUM", ROTA: "MOINHO", ULTIMO_AUDIO: 85 };
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [85],
          novo_estado: montarEstado(novoEst),
        });
      }

      if (querParar) {
        est.ULTIMO_AUDIO = FAIXA_DESPEDIDA;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [FAIXA_DESPEDIDA],
          novo_estado: montarEstado(est),
        });
      }

      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    // ========================================================================
    // 4. TRATAMENTO DA PERGUNTA "PULAR INTRODUÇÃO?" (ULTIMO_AUDIO = 96)
    // ========================================================================
    if (est.ULTIMO_AUDIO === FAIXA_PULAR_INTRODUCAO) {
      const querNaoPular =
        fala === "nao" ||
        fala.includes("nao") ||
        fala.includes("ouvir") ||
        fala.includes("escutar") ||
        fala.includes("normal") ||
        fala.includes("completa");

      const querSimPular =
        !querNaoPular &&
        (fala === "sim" ||
          fala.includes("sim") ||
          fala.includes("pular") ||
          fala.includes("quero") ||
          fala.includes("direto") ||
          fala.includes("pode"));

      if (querSimPular) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "AVENTURA";
        est.ULTIMO_AUDIO = 101;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [100, 101],
          novo_estado: montarEstado(est),
        });
      }

      if (querNaoPular) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "AVENTURA";
        est.ULTIMO_AUDIO = 101;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [98, 99, 100, 101],
          novo_estado: montarEstado(est),
        });
      }

      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    // ========================================================================
    // 5. SELEÇÃO DE PERSONAGENS DA SUMÉRIA (ULTIMO_AUDIO = 86 a 92)
    // ========================================================================
    if (
      (est.ULTIMO_AUDIO >= 86 && est.ULTIMO_AUDIO <= 92) ||
      est.ETAPA === "SELECAO_PERSONAGEM"
    ) {
      const mapaPersonagens = [
        { chaves: ["mago", "maga", "magu", "magia"], estilo: "MAGO", faixa: 87 },
        { chaves: ["duende", "duendi"], estilo: "DUENDE", faixa: 88 },
        { chaves: ["campones", "camponesa", "campo"], estilo: "CAMPONES", faixa: 89 },
        { chaves: ["sabio", "sabia", "sabiu"], estilo: "SABIO", faixa: 90 },
        { chaves: ["mercenario", "mercenaria"], estilo: "MERCENARIO", faixa: 91 },
        { chaves: ["guerreiro", "guerreira"], estilo: "GUERREIRO", faixa: 92 },
      ];

      let charDetectado = null;
      for (const item of mapaPersonagens) {
        if (item.chaves.some((k) => fala.includes(k))) {
          charDetectado = item;
          break;
        }
      }

      const querConfirmarDireto =
        fala.includes("confirmar") ||
        fala.includes("confirmo") ||
        fala.includes("escolho") ||
        fala.includes("quero esse") ||
        fala.includes("quero ser") ||
        fala.includes("comecar") ||
        fala.includes("iniciar") ||
        fala === "sim" ||
        fala.includes("sim");

      // Caso 1: Falou o nome do personagem junto com confirmação ("quero ser mago")
      if (charDetectado && querConfirmarDireto) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "PULAR_INTRO";
        est.ESTILO = charDetectado.estilo;
        est.ULTIMO_AUDIO = FAIXA_PULAR_INTRODUCAO;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [charDetectado.faixa, 93, FAIXA_PULAR_INTRODUCAO],
          novo_estado: montarEstado(est),
        });
      }

      // Caso 2: Falou APENAS o nome do personagem sozinho ("Mago") -> Toca a descrição (87 a 92)
      if (charDetectado) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "SELECAO_PERSONAGEM";
        est.ESTILO = charDetectado.estilo;
        est.ULTIMO_AUDIO = charDetectado.faixa;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [charDetectado.faixa],
          novo_estado: montarEstado(est),
        });
      }

      // Caso 3: Já ouviu a descrição (87 a 92) e disse "sim" / "confirmar" / "quero"
      if (est.ULTIMO_AUDIO >= 87 && est.ULTIMO_AUDIO <= 92 && (querConfirmarDireto || fala.includes("quero"))) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "PULAR_INTRO";
        est.ULTIMO_AUDIO = FAIXA_PULAR_INTRODUCAO;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [93, FAIXA_PULAR_INTRODUCAO],
          novo_estado: montarEstado(est),
        });
      }

      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    // ========================================================================
    // 6. MENU PRINCIPAL (ULTIMO_AUDIO = 85)
    // ========================================================================
    if (est.ULTIMO_AUDIO === 85) {
      if (fala.includes("sumeria") || fala.includes("primeira") || fala === "1" || fala === "um") {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "SELECAO_PERSONAGEM";
        est.ESTILO = "NENHUM";
        est.ROTA = "NENHUMA";
        est.ULTIMO_AUDIO = 86;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [86],
          novo_estado: montarEstado(est),
        });
      }
      if (fala.includes("arthur") || fala.includes("principe") || fala.includes("resgate") || fala.includes("segunda") || fala === "2" || fala === "dois") {
        est.HISTORIA = "ARTHUR";
        est.ETAPA = "SELECAO";
        est.ESTILO = "NENHUM";
        est.ROTA = "MOINHO";
        est.ULTIMO_AUDIO = 2;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [1, 2],
          novo_estado: montarEstado(est),
        });
      }
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    // ========================================================================
    // 7. MOTOR DETERMINÍSTICO DAS 33 AÇÕES DA SUMÉRIA (ULTIMO_AUDIO = 101 a 133)
    // ========================================================================
    if (est.ULTIMO_AUDIO >= 101 && est.ULTIMO_AUDIO <= 133) {
      const opcoesPermitidasNaCena = OPCOES_VALIDAS_SUMERIA[est.ULTIMO_AUDIO] || [];
      const num = extrairNumeroFalado(analise.numero_dito, fala);

      if (num !== null && opcoesPermitidasNaCena.includes(num)) {
        const proximaFaixa = 100 + num;
        est.ULTIMO_AUDIO = proximaFaixa;

        const faixasParaTocar = FAIXAS_FIM_DE_JOGO.has(proximaFaixa)
          ? [proximaFaixa, FAIXA_JOGAR_NOVAMENTE]
          : [proximaFaixa];

        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: faixasParaTocar,
          novo_estado: montarEstado(est),
        });
      }

      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: montarEstado(est),
      });
    }

    // ========================================================================
    // 8. CAMPANHA: O RESGATE DO PRÍNCIPE ARTHUR (ULTIMO_AUDIO = 2 a 84)
    // ========================================================================
    const resultadoArthur = processarPrincipeArthur(est, fala);
    if (resultadoArthur) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: resultadoArthur.faixas,
        novo_estado: montarEstado(resultadoArthur.novoEst),
      });
    }

    return res.status(200).json({
      ignorado: false,
      acao_sistema: "NENHUMA",
      transcricao: analise.transcricao,
      faixas: [],
      novo_estado: montarEstado(est),
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}

function extrairNumeroFalado(numeroJson, fala) {
  if (typeof numeroJson === "number" && Number.isInteger(numeroJson)) {
    return numeroJson;
  }
  const matchDigito = fala.match(/\b(\d{1,2})\b/);
  if (matchDigito) return parseInt(matchDigito[1], 10);

  const extenso = {
    um: 1, dois: 2, tres: 3, treis: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, seti: 7,
    oito: 8, nove: 9, novi: 9, dez: 10, deis: 10, onze: 11, doze: 12, dozi: 12,
    treze: 13, trezi: 13, quatorze: 14, catorze: 14, quinze: 15, quinzi: 15,
    dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, vinti: 20,
    "vinte e um": 21, "vinte e dois": 22, "vinte e tres": 23, "vinte e quatro": 24,
    "vinte e cinco": 25, "vinte e seis": 26, "vinte e sete": 27, "vinte e oito": 28,
    "vinte e nove": 29, trinta: 30, "trinta e um": 31, "trinta e dois": 32, "trinta e tres": 33,
  };
  const chavesOrdenadas = Object.keys(extenso).sort((a, b) => b.length - a.length);
  for (const chave of chavesOrdenadas) {
    const regex = new RegExp(`\\b${chave}\\b`, "i");
    if (regex.test(fala)) return extenso[chave];
  }
  return null;
}

function identificarOpcaoArthur(fala) {
  if (fala.includes("primeira") || fala.includes("opcao 1") || fala.includes("numero 1") || /\b1\b/.test(fala) || /\bum\b/.test(fala)) return 1;
  if (fala.includes("segunda") || fala.includes("opcao 2") || fala.includes("numero 2") || /\b2\b/.test(fala) || /\bdois\b/.test(fala)) return 2;
  if (fala.includes("terceira") || fala.includes("opcao 3") || fala.includes("numero 3") || /\b3\b/.test(fala) || /\btres\b/.test(fala)) return 3;
  return null;
}

function processarPrincipeArthur(est, fala) {
  const u = est.ULTIMO_AUDIO;
  const op = identificarOpcaoArthur(fala);

  if (u === 2) {
    if (fala.includes("guardiao") || fala.includes("escudo") || op === 1) est.ESTILO = "GUARDIAO";
    else if (fala.includes("explorador") || fala.includes("arco") || op === 2) est.ESTILO = "EXPLORADOR";
    else if (fala.includes("estrategista") || fala.includes("espada") || op === 3) est.ESTILO = "ESTRATEGISTA";

    if (fala.includes("finalizada") || fala.includes("confirmar") || fala.includes("iniciar") || fala.includes("comecar") || fala === "sim") {
      if (est.ESTILO === "NENHUM") est.ESTILO = "GUARDIAO";
      est.ETAPA = "FLORESTA";
      est.ULTIMO_AUDIO = 71;
      return { faixas: [3, 71], novoEst: est };
    }
    return { faixas: [], novoEst: est };
  }

  if (!op) return null;

  const mapaArthur = {
    71: { 1: 72, 2: 73, 3: 73 },
    72: { 1: 74, 2: 74, 3: 83 },
    73: { 1: 74, 2: 74, 3: 62 },
    74: {
      1: est.ESTILO === "EXPLORADOR" ? 12 : est.ESTILO === "ESTRATEGISTA" ? 13 : 11,
      2: est.ESTILO === "EXPLORADOR" ? 12 : est.ESTILO === "ESTRATEGISTA" ? 13 : 11,
      3: 62,
    },
    11: { 1: 75, 2: 61, 3: 75 },
    12: { 1: 75, 2: 75, 3: 62 },
    13: { 1: 75, 2: 75, 3: 75 },
    75: { 1: 76, 2: 76, 3: 61 },
    76: { 1: 77, 2: 77, 3: 65 },
    77: { 1: 78, 2: 78, 3: 64 },
    78: {
      1: est.ROTA === "PONTE" ? 22 : est.ROTA === "ROCHAS" ? 23 : 21,
      2: est.ROTA === "PONTE" ? 22 : est.ROTA === "ROCHAS" ? 23 : 21,
      3: 63,
    },
    21: { 1: 79, 2: 79, 3: 63 },
    22: { 1: 79, 2: 79, 3: 64 },
    23: { 1: 79, 2: 79, 3: 63 },
    79: { 1: 80, 2: 80, 3: 65 },
    80: { 1: 81, 2: 81, 3: 84 },
    81: { 1: 82, 2: 82, 3: 65 },
    82: { 1: 31, 2: 32, 3: 62 },
    31: { 1: 34, 2: 33, 3: 65 },
    32: { 1: 42, 2: 33, 3: 62 },
    33: { 1: 42, 2: 41, 3: 63 },
    34: { 1: 41, 2: 42, 3: 65 },
    41: { 1: 51, 2: 53, 3: 66 },
    42: { 1: 51, 2: 52, 3: 66 },
  };

  if (u === 11 && op === 1) est.ROTA = "MOINHO";
  if (u === 11 && op === 3) est.ROTA = "PONTE";
  if (u === 12 && op === 1) est.ROTA = "MOINHO";
  if (u === 12 && op === 2) est.ROTA = "PONTE";
  if (u === 13 && op === 1) est.ROTA = "MOINHO";
  if (u === 13 && op === 2) est.ROTA = "PONTE";
  if (u === 13 && op === 3) est.ROTA = "ROCHAS";

  const prox = mapaArthur[u]?.[op];
  if (!prox) return null;

  est.ULTIMO_AUDIO = prox;

  const listaFaixas = FAIXAS_FIM_DE_JOGO.has(prox)
    ? [prox, FAIXA_JOGAR_NOVAMENTE]
    : [prox];

  return { faixas: listaFaixas, novoEst: est };
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
