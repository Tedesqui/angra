// api/totem-angra.js (Transcrição Cega Antivício + Motor de Estados 100% Determinístico em JS)
export const config = {
  api: { bodyParser: false },
};

// ============================================================================
// TABELA ESTRITA DAS 33 AÇÕES DA SUMÉRIA (Fórmula: Número dito -> Faixa 100 + N)
// O Gemini NÃO tem acesso a esta tabela para nunca forçar um número parecido!
// ============================================================================
const OPCOES_VALIDAS_SUMERIA = {
  101: [7, 30, 16],
  102: [17, 12],
  103: [28, 16],
  104: [30, 11],
  105: [21, 10],
  106: [14, 27],
  107: [19, 3, 23],
  108: [20, 25],
  109: [], // Fim de jogo
  110: [33, 9],
  111: [], // Fim de jogo
  112: [26, 32],
  113: [15, 26],
  114: [13, 12],
  115: [], // Fim de jogo
  116: [4, 22],
  117: [], // Fim de jogo
  118: [31, 24],
  119: [29, 8, 5],
  120: [], // Fim de jogo
  121: [], // Fim de jogo
  122: [18],
  123: [6, 27],
  124: [], // Fim de jogo
  125: [], // Fim de jogo
  126: [], // Fim de jogo
  127: [12, 32, 7],
  128: [10],
  129: [8],
  130: [6, 27, 19, 23],
  131: [2, 24],
  132: [], // Fim de jogo
  133: [], // Fim de jogo
};

function parseEstado(estadoStr) {
  const partes = estadoStr.split("|").map((s) => s.trim());
  const obj = {
    HISTORIA: "MENU",
    ETAPA: "MENU_PRINCIPAL",
    ESTILO: "NENHUM",
    ROTA: "MOINHO",
    ULTIMO_AUDIO: 85,
  };
  for (const p of partes) {
    const [k, v] = p.split(":");
    if (k && v) {
      obj[k.trim()] = k.trim() === "ULTIMO_AUDIO" ? parseInt(v.trim(), 10) : v.trim();
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
    .trim();
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Motor Determinístico RPG Online (Transcrição Cega Antialucinação)!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const estadoRaw = decodeURIComponent(
      req.headers["x-estado-rpg"] ||
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
    // PROMPT CEGO: A IA NÃO SABE QUAIS SÃO AS OPÇÕES VÁLIDAS DA CENA ATUAL!
    // Assim ela NUNCA transforma "12" em "19" e NUNCA aceita batida de teclado.
    // ========================================================================
    const promptTranscricaoCega = `
Você é um detector acústico forense e transcritor de voz humana em Português do Brasil.
Você NÃO conhece as regras do jogo e NÃO deve adivinhar intenções.

TAREFA 1 - DETECÇÃO RIGOROSA DE VOZ HUMANA VS RUÍDO MECÂNICO:
- Analise se há cordas vocais humanas falando claramente uma palavra ou número.
- Se o áudio for batida de teclado, clique de mouse, toque na mesa, estalo seco, passo, tosse, pigarro, sopro no microfone, TV ao fundo, ruído branco ou silêncio, defina OBRIGATORIAMENTE "eh_voz_humana": false.
- Sons curtos percussivos ("tec", "toc", "clic", batidas de teclas) NUNCA são voz humana.

TAREFA 2 - TRANSCRIÇÃO LITERAL SEM CORREÇÃO:
- Transcreva exatamente o que a voz humana disse em "transcricao".
- Se a pessoa falou um número (ex: 1, 2, 3, 7, 10, 12, 15, 16, 19, 20, 23, 30, etc.), coloque esse número exato no campo "numero_dito" (inteiro). Se não falou número, coloque null.
- NUNCA substitua um número por outro parecido (se ouvir "doze", escreva 12; se ouvir "dezenove", escreva 19; se ouvir "vinte", escreva 20).

Retorne APENAS este JSON:
{
  "eh_voz_humana": true,
  "transcricao": "texto exato falado",
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

    // 1. Bloqueio imediato se não for voz humana nítida ou se a transcrição for vazia
    if (!analise.eh_voz_humana || !fala || fala.length < 2) {
      return res.status(200).json({ ignorado: true });
    }

    // ========================================================================
    // 2. COMANDOS GLOBAIS DE SISTEMA (Verificados em código JS)
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
        novo_estado: estadoRaw,
      });
    }

    if (fala.includes("salvar jogo") || fala.includes("salvar progresso") || fala.includes("guardar jogo")) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "SALVAR_JOGO",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: estadoRaw,
      });
    }

    if (fala.includes("continuar jogo") || fala.includes("carregar jogo") || fala.includes("abrir jogo")) {
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "CARREGAR_JOGO",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: estadoRaw,
      });
    }

    if (fala.includes("reiniciar") || fala.includes("comecar do zero") || fala.includes("jogar novamente")) {
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
    // 3. MENU PRINCIPAL (ULTIMO_AUDIO = 85)
    // ========================================================================
    if (est.ULTIMO_AUDIO === 85) {
      if (fala.includes("sumeria") || fala.includes("primeira")) {
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
      if (fala.includes("arthur") || fala.includes("principe") || fala.includes("resgate") || fala.includes("segunda")) {
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
      // Qualquer outra fala no menu 85 é bloqueada
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: estadoRaw,
      });
    }

    // ========================================================================
    // 4. SELEÇÃO DE PERSONAGENS DA SUMÉRIA (ULTIMO_AUDIO = 86 a 92)
    // ========================================================================
    if (est.ULTIMO_AUDIO >= 86 && est.ULTIMO_AUDIO <= 92) {
      const mapaPersonagens = [
        { chaves: ["mago", "maga"], estilo: "MAGO", faixa: 87 },
        { chaves: ["duende"], estilo: "DUENDE", faixa: 88 },
        { chaves: ["campones", "camponesa"], estilo: "CAMPONES", faixa: 89 },
        { chaves: ["sabio", "sabia"], estilo: "SABIO", faixa: 90 },
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
        fala.includes("escolho") ||
        fala.includes("quero esse") ||
        fala.includes("quero ser") ||
        fala.includes("comecar") ||
        fala.includes("iniciar") ||
        fala === "sim";

      // Se falou o nome de um personagem + intenção de confirmar/iniciar direto
      if (charDetectado && querConfirmarDireto) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "AVENTURA";
        est.ESTILO = charDetectado.estilo;
        est.ULTIMO_AUDIO = 101;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [charDetectado.faixa, 93, 98, 99, 100, 101],
          novo_estado: montarEstado(est),
        });
      }

      // Se falou apenas o nome do personagem para ouvir a descrição (ex: "Mago")
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

      // Se já ouviu a descrição (87 a 92) e confirmou ("confirmar", "quero esse", "sim")
      if (est.ULTIMO_AUDIO >= 87 && est.ULTIMO_AUDIO <= 92 && querConfirmarDireto) {
        est.HISTORIA = "SUMERIA";
        est.ETAPA = "AVENTURA";
        est.ULTIMO_AUDIO = 101;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [93, 98, 99, 100, 101],
          novo_estado: montarEstado(est),
        });
      }

      // Qualquer outra frase ou número dito na seleção de personagens é ignorado
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: estadoRaw,
      });
    }

    // ========================================================================
    // 5. MOTOR DETERMINÍSTICO DAS 33 AÇÕES DA SUMÉRIA (ULTIMO_AUDIO = 101 a 133)
    // ========================================================================
    if (est.ULTIMO_AUDIO >= 101 && est.ULTIMO_AUDIO <= 133) {
      const opcoesPermitidasNaCena = OPCOES_VALIDAS_SUMERIA[est.ULTIMO_AUDIO] || [];
      const num = extrairNumeroFalado(analise.numero_dito, fala);

      // TRAVA ABSOLUTA: Só avança se o jogador falou um número E ele está na lista exata da cena atual!
      if (num !== null && opcoesPermitidasNaCena.includes(num)) {
        const proximaFaixa = 100 + num; // Ex: disse 19 -> faixa 119! Nunca tocará 109 por engano!
        est.ULTIMO_AUDIO = proximaFaixa;
        return res.status(200).json({
          ignorado: false,
          acao_sistema: "NENHUMA",
          transcricao: analise.transcricao,
          faixas: [proximaFaixa],
          novo_estado: montarEstado(est),
        });
      }

      // Se disse 12 quando a cena pedia 19, 3 ou 23 (ou se não disse número válido): NÃO FAZ NADA!
      return res.status(200).json({
        ignorado: false,
        acao_sistema: "NENHUMA",
        transcricao: analise.transcricao,
        faixas: [],
        novo_estado: estadoRaw,
      });
    }

    // ========================================================================
    // 6. CAMPANHA: O RESGATE DO PRÍNCIPE ARTHUR (ULTIMO_AUDIO = 2 a 84)
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
      novo_estado: estadoRaw,
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}

// Extrai número exato sem permitir aproximações
function extrairNumeroFalado(numeroJson, fala) {
  if (typeof numeroJson === "number" && Number.isInteger(numeroJson)) {
    return numeroJson;
  }
  const matchDigito = fala.match(/\b(\d{1,2})\b/);
  if (matchDigito) return parseInt(matchDigito[1], 10);

  const extenso = {
    um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
    dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
    dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
    "vinte e um": 21, "vinte e dois": 22, "vinte e tres": 23, "vinte e quatro": 24,
    "vinte e cinco": 25, "vinte e seis": 26, "vinte e sete": 27, "vinte e oito": 28,
    "vinte e nove": 29, trinta: 30, "trinta e um": 31, "trinta e dois": 32, "trinta e tres": 33,
  };
  // Testa primeiro os compostos ("vinte e tres") e depois os simples
  const chavesOrdenadas = Object.keys(extenso).sort((a, b) => b.length - a.length);
  for (const chave of chavesOrdenadas) {
    const regex = new RegExp(`\\b${chave}\\b`, "i");
    if (regex.test(fala)) return extenso[chave];
  }
  return null;
}

function identificarOpcaoArthur(fala) {
  if (fala.includes("primeira") || fala.includes("opcao 1") || fala.includes("numero 1") || /\b1\b/.test(fala)) return 1;
  if (fala.includes("segunda") || fala.includes("opcao 2") || fala.includes("numero 2") || /\b2\b/.test(fala)) return 2;
  if (fala.includes("terceira") || fala.includes("opcao 3") || fala.includes("numero 3") || /\b3\b/.test(fala)) return 3;
  return null;
}

function processarPrincipeArthur(est, fala) {
  const u = est.ULTIMO_AUDIO;
  const op = identificarOpcaoArthur(fala);

  if (u === 2) {
    if (fala.includes("guardiao") || fala.includes("escudo") || op === 1) est.ESTILO = "GUARDIAO";
    else if (fala.includes("explorador") || fala.includes("arco") || op === 2) est.ESTILO = "EXPLORADOR";
    else if (fala.includes("estrategista") || fala.includes("espada") || op === 3) est.ESTILO = "ESTRATEGISTA";

    if (fala.includes("finalizada") || fala.includes("confirmar") || fala.includes("iniciar") || fala.includes("comecar")) {
      if (est.ESTILO === "NENHUM") est.ESTILO = "GUARDIAO";
      est.ETAPA = "FLORESTA";
      est.ULTIMO_AUDIO = 71;
      return { faixas: [3, 71], novoEst: est };
    }
    return { faixas: [], novoEst: est };
  }

  if (!op) return null; // Exige 1ª, 2ª ou 3ª opção claramente dita

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
  return { faixas: [prox], novoEst: est };
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
