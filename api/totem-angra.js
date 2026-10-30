// api/totem-angra.js (Versão Ultra-Rápida: 1 Única Chamada Gemini + Cache de Clima e GPS OSRM)
export const config = {
  api: { bodyParser: false },
};

const COORD_PADRAO_TOTEM = { lat: -22.9968, lon: -44.3045 };

// Caches em memória (persistem enquanto a instância Serverless da Vercel estiver quente)
let cacheClima = { dados: null, expiraEm: 0 };
const cacheCoordenadas = new Map();
const cacheRotasOSRM = new Map();

function obterDataHoraAngra() {
  const agora = new Date();
  const opcoes = {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const formatador = new Intl.DateTimeFormat("pt-BR", opcoes);
  const partes = formatador.formatToParts(agora);
  const mapa = {};
  for (const p of partes) mapa[p.type] = p.value;

  const horaNum = parseInt(mapa.hour, 10);
  let saudacao = "Boa noite";
  let periodo = "noite";

  if (horaNum >= 5 && horaNum < 12) {
    saudacao = "Bom dia";
    periodo = "manhã";
  } else if (horaNum >= 12 && horaNum < 18) {
    saudacao = "Boa tarde";
    periodo = "tarde";
  }

  return {
    textoCompleto: `${mapa.weekday}, ${mapa.day}/${mapa.month}/${mapa.year} às ${mapa.hour}:${mapa.minute} (Período da ${periodo})`,
    saudacao,
  };
}

function traduzirCodigoWMO(codigo) {
  const codigosWMO = {
    0: "Céu limpo e ensolarado",
    1: "Predominantemente aberto",
    2: "Sol entre nuvens",
    3: "Céu encoberto / nublado",
    45: "Nevoeiro",
    51: "Garoa leve",
    53: "Garoa moderada",
    55: "Garoa intensa",
    61: "Chuva fraca",
    63: "Chuva moderada",
    65: "Chuva forte",
    80: "Pancadas de chuva rápidas",
    81: "Pancadas de chuva moderadas",
    82: "Pancadas de chuva fortes",
    95: "Tempestade com trovoadas",
  };
  return codigosWMO[codigo] || "Tempo variável";
}

function formatarDiaPrevisao(dataIso, indice) {
  const [ano, mes, dia] = dataIso.split("-");
  const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
  const nomeDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(dataObj);
  if (indice === 0) return `Hoje (${dia}/${mes})`;
  if (indice === 1) return `Amanhã (${dia}/${mes})`;
  return `${nomeDia} (${dia}/${mes})`;
}

// Clima com Cache de 15 minutos (Evita atrasar as respostas do microfone!)
async function obterClimaEPrevisaoAngra() {
  if (cacheClima.dados && Date.now() < cacheClima.expiraEm) {
    return cacheClima.dados;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);

    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-22.9968&longitude=-44.3045&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=America%2FSao_Paulo";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { agora: "Indisponível", previsaoDias: "Indisponível" };
    const data = await res.json();
    const c = data.current;
    const d = data.daily;

    const condicaoAgora = c ? traduzirCodigoWMO(c.weather_code) : "Indisponível";
    const textoAgora = c
      ? `${condicaoAgora}, ${Math.round(c.temperature_2m)}°C (Sensação: ${Math.round(c.apparent_temperature)}°C), Chuva: ${c.precipitation} mm.`
      : "Indisponível.";

    let listaDias = [];
    if (d && d.time) {
      for (let i = 0; i < d.time.length; i++) {
        listaDias.push(
          `${formatarDiaPrevisao(d.time[i], i)}: ${traduzirCodigoWMO(d.weather_code[i])}, Mín ${Math.round(d.temperature_2m_min[i])}°C/Máx ${Math.round(d.temperature_2m_max[i])}°C, Chuva: ${d.precipitation_probability_max?.[i] ?? 0}%`
        );
      }
    }

    const resultado = { agora: textoAgora, previsaoDias: listaDias.join(" | ") };
    cacheClima = { dados: resultado, expiraEm: Date.now() + 15 * 60 * 1000 };
    return resultado;
  } catch (e) {
    return cacheClima.dados || { agora: "Indisponível", previsaoDias: "Indisponível" };
  }
}

// ============================================================================
// MOTOR GPS RÁPIDO COM CACHE E FORMATADOR ZERO-LATÊNCIA
// ============================================================================
async function buscarCoordenadasOSM(termoBusca) {
  const chave = termoBusca.toLowerCase().trim();
  if (cacheCoordenadas.has(chave)) return cacheCoordenadas.get(chave);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const query = encodeURIComponent(`${termoBusca}, Angra dos Reis, RJ, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: { "User-Agent": "TotemGuiaAngra/2.0 (FastRoute)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const lista = await res.json();
    if (!lista || lista.length === 0) return null;

    const coord = {
      lat: parseFloat(lista[0].lat),
      lon: parseFloat(lista[0].lon),
      nomeOficial: lista[0].display_name.split(",")[0],
    };
    cacheCoordenadas.set(chave, coord);
    return coord;
  } catch (e) {
    return null;
  }
}

function traduzirManobraCurta(step, idioma = "pt") {
  const tipo = step.maneuver?.type || "";
  const mod = step.maneuver?.modifier || "";
  const rua = step.name ? step.name : "";
  const dist = Math.round(step.distance || 0);

  if (dist < 12 || tipo === "arrive" || !rua) return null;

  const ehIngles = idioma.toLowerCase().startsWith("en");
  const ehEspanhol = idioma.toLowerCase().startsWith("es");

  if (ehIngles) {
    const dirEn = mod.includes("left") ? "turn left onto" : mod.includes("right") ? "turn right onto" : "continue on";
    return tipo === "depart" ? `head on ${rua} for ${dist} meters` : `${dirEn} ${rua} for ${dist} meters`;
  }
  if (ehEspanhol) {
    const dirEs = mod.includes("left") ? "gira a la izquierda en" : mod.includes("right") ? "gira a la derecha en" : "sigue por";
    return tipo === "depart" ? `sal por ${rua} durante ${dist} metros` : `${dirEs} ${rua} por ${dist} metros`;
  }

  const dirPt = mod.includes("left")
    ? "vire à esquerda na"
    : mod.includes("right")
    ? "vire à direita na"
    : "siga pela";

  if (tipo === "depart") return `saia pela ${rua} por ${dist} metros`;
  return `${dirPt} ${rua} por ${dist} metros`;
}

async function calcularRotaExataOSRM(enderecoOrigem, destinoDesejado, idioma = "pt") {
  const chaveRota = `${enderecoOrigem}|${destinoDesejado}|${idioma}`.toLowerCase();
  if (cacheRotasOSRM.has(chaveRota)) return cacheRotasOSRM.get(chaveRota);

  try {
    let coordOrigem = COORD_PADRAO_TOTEM;
    if (!enderecoOrigem.toLowerCase().includes("maria jose lucas peixoto")) {
      const buscaOrig = await buscarCoordenadasOSM(enderecoOrigem);
      if (buscaOrig) coordOrigem = buscaOrig;
    }

    const coordDestino = await buscarCoordenadasOSM(destinoDesejado);
    if (!coordDestino) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const urlOsrm = `https://router.project-osrm.org/route/v1/driving/${coordOrigem.lon},${coordOrigem.lat};${coordDestino.lon},${coordDestino.lat}?overview=false&steps=true`;

    const res = await fetch(urlOsrm, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const rota = data.routes?.[0];
    if (!rota) return null;

    const distanciaMetros = Math.round(rota.distance);
    const tempoPeMin = Math.max(1, Math.round(distanciaMetros / 80));
    const tempoCarroMin = Math.max(1, Math.round(rota.duration / 60));

    const passos = rota.legs?.[0]?.steps || [];
    const manobrasPrincipais = [];
    for (const s of passos) {
      const m = traduzirManobraCurta(s, idioma);
      if (m && manobrasPrincipais.length < 3) {
        manobrasPrincipais.push(m);
      }
    }

    const distTexto =
      distanciaMetros >= 1000
        ? `${(distanciaMetros / 1000).toFixed(1)} quilômetros`
        : `${distanciaMetros} metros`;

    const tempoTexto =
      distanciaMetros <= 1500
        ? `${tempoPeMin} minutos a pé`
        : `${tempoCarroMin} minutos de carro ou ônibus`;

    let fraseGpsPronta = "";
    if (manobrasPrincipais.length > 0) {
      if (idioma.toLowerCase().startsWith("en")) {
        fraseGpsPronta = ` It is ${distanciaMetros} meters away: ${manobrasPrincipais.join(", then ")}.`;
      } else if (idioma.toLowerCase().startsWith("es")) {
        fraseGpsPronta = ` Está a ${distanciaMetros} metros: ${manobrasPrincipais.join(", luego ")}.`;
      } else {
        fraseGpsPronta = ` Pelo GPS dá ${distTexto}, cerca de ${tempoTexto}: ${manobrasPrincipais.join(", depois ")}.`;
      }
    }

    const resultado = {
      destinoEncontrado: coordDestino.nomeOficial,
      distanciaTotal: distTexto,
      tempoEstimado: tempoTexto,
      fraseFalaDireta: fraseGpsPronta,
    };

    cacheRotasOSRM.set(chaveRota, resultado);
    return resultado;
  } catch (e) {
    return null;
  }
}

function extrairJsonLimpo(textoBruto, fallbackMemoria) {
  try {
    const limpo = textoBruto.replace(/```json/gi, "").replace(/```/g, "").trim();
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio !== -1 && fim !== -1) {
      return JSON.parse(limpo.substring(inicio, fim + 1));
    }
    return JSON.parse(limpo);
  } catch (e) {
    return {
      ruido_ignorado: false,
      precisa_rota_gps: false,
      destino_busca_gps: "",
      idioma_detectado: "pt-BR",
      transcricao: "[Processado]",
      resposta: textoBruto.replace(/[*#`]/g, "").substring(0, 300),
      memoria_atualizada: fallbackMemoria,
    };
  }
}

export default async function handler(req, res) {
  const infoHora = obterDataHoraAngra();

  if (req.method === "GET") {
    const destinoTeste = req.query?.destino || "Shopping Piratas";
    const t0 = Date.now();
    const rotaTeste = await calcularRotaExataOSRM(
      "Rua Maria José Lucas Peixoto, 237, Parque das Palmeiras",
      destinoTeste,
      "pt"
    );
    const latenciaMs = Date.now() - t0;
    return res.status(200).json({
      status: "Guia de Angra Ultra-Rapido (Single-Pass + Cache) Online!",
      tempoCalculoGpsMs: `${latenciaMs} ms`,
      testeRotaGPS: rotaTeste,
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    const acaoInicial = req.headers["x-acao-inicial"] || "";
    const localizacaoTotem = decodeURIComponent(
      req.headers["x-localizacao-totem"] ||
        "Rua Maria José Lucas Peixoto, N° 237 - Parque das Palmeiras, Angra dos Reis - RJ"
    );
    const memoriaAnterior = decodeURIComponent(
      req.headers["x-memoria-turismo"] ||
        "Sessão recém-iniciada. Nenhum visitante identificado ainda."
    );

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // CENÁRIO A: Boas-vindas
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico Virtual de Angra dos Reis (RJ), muito simpático, natural e humano.
Crie uma fala curta em Português (máximo de 2 frases curtas, até 28 palavras, sem emojis e sem asteriscos):
1. Cumprimente apenas com "${infoHora.saudacao}" e dê as boas-vindas a Angra dos Reis.
2. Pergunte o nome da pessoa e como pode ajudá-la.
PROIBIDO NA APRESENTAÇÃO: NÃO fale horas, NÃO fale clima/temperatura e NÃO fale o endereço do totem.

Retorne APENAS um JSON válido com as chaves:
{"ruido_ignorado": false, "transcricao": "[Boas-Vindas]", "resposta": "...", "memoria_atualizada": "Sessão iniciada."}
`;

      const resBoasVindas = await fetch(urlTexto, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptBoasVindas }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      const dataBV = await resBoasVindas.json();
      const textoBV = dataBV.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const dadosBV = extrairJsonLimpo(textoBV, memoriaAnterior);
      return await sintetizarEEnviarAudio(dadosBV, apiKey, res);
    }

    // CENÁRIO B: Pergunta do visitante pelo microfone
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      res.setHeader("X-Ignorado", "1");
      res.setHeader("Content-Length", "0");
      return res.status(200).end();
    }

    // Busca clima instantâneo do cache (ou da API se expirou os 15 min)
    const dadosClima = await obterClimaEPrevisaoAngra();
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    // CHAMADA ÚNICA AO GEMINI (Sem segunda rodada!)
    const promptUnico = `
Você é o Guia Turístico e Navegador GPS de Angra dos Reis (RJ).

DADOS DE BASTIDORES (SÓ MENCIONE SE SOLICITADO):
- Ponto de partida exato do Totem: "${localizacaoTotem}".
- Horário atual: "${infoHora.textoCompleto}".
- Clima atual: "${dadosClima.agora}" | Previsão: "${dadosClima.previsaoDias}".
- Memória da conversa e vozes: "${memoriaAnterior}".

REGRAS DE VELOCIDADE E PRECISÃO:
1. Se o áudio tiver apenas barulho/vento sem fala clara, retorne "ruido_ignorado": true.
2. Se o visitante perguntar ONDE FICA ou COMO CHEGAR a algum lugar:
   - Defina "precisa_rota_gps": true.
   - Em "destino_busca_gps", coloque APENAS o nome curto e limpo do local ou rua em Angra para o mapa OpenStreetMap achar rápido (ex: "Shopping Piratas", "Rede Market Balneário", "Cais de Santa Luzia", "Santa Casa de Angra", "Praia do Bonfim").
   - Na sua "resposta", diga de forma curta (1 frase de até 22 palavras) qual é o local mais próximo, pois o nosso sistema vai anexar automaticamente a frase com os metros e curvas do GPS logo após a sua frase!
3. Se NÃO for pergunta de direção, defina "precisa_rota_gps": false e responda normalmente em até 3 frases curtas (45 palavras).
4. Diferencie os visitantes pelo timbre de voz no áudio e responda sempre no mesmo idioma do visitante.

Retorne ESTRITAMENTE um bloco JSON válido:
{
  "ruido_ignorado": false,
  "precisa_rota_gps": true ou false,
  "destino_busca_gps": "Nome curto do local para o OpenStreetMap",
  "idioma_detectado": "pt",
  "transcricao": "[Idioma - Perfil da Voz] O que a pessoa disse",
  "resposta": "Sua resposta falada limpa (sem asteriscos)",
  "memoria_atualizada": "Resumo com perfis vocais/nomes e assuntos"
}
`;

    const resUnico = await fetch(urlTexto, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/wav", data: wavBuffer.toString("base64") } },
              { text: promptUnico },
            ],
          },
        ],
        tools: [{ google_search: {} }],
      }),
    });

    const dataUnico = await resUnico.json();
    if (!resUnico.ok) {
      return res.status(500).json({ etapa: "gemini_unico", erro: dataUnico });
    }

    const textoUnico =
      dataUnico.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
    let dados = extrairJsonLimpo(textoUnico, memoriaAnterior);

    if (dados.ruido_ignorado === true || (!dados.resposta && !dados.destino_busca_gps)) {
      res.setHeader("X-Ignorado", "1");
      res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || "[Ruido Ignorado]"));
      res.setHeader("X-Memoria-Turismo", encodeURIComponent(memoriaAnterior));
      res.setHeader("Content-Length", "0");
      return res.status(200).end();
    }

    // INJEÇÃO LOCAL DE ROTA GPS (0ms de custo de IA, sem precisar chamar o Gemini de novo!)
    if (dados.precisa_rota_gps && dados.destino_busca_gps) {
      const rotaOSRM = await calcularRotaExataOSRM(
        localizacaoTotem,
        dados.destino_busca_gps,
        dados.idioma_detectado || "pt"
      );

      if (rotaOSRM && rotaOSRM.fraseFalaDireta) {
        dados.resposta = `${dados.resposta.trim()}${rotaOSRM.fraseFalaDireta}`;
      }
    }

    return await sintetizarEEnviarAudio(dados, apiKey, res);
  } catch (err) {
    return res.status(500).json({ erroGeral: err.message });
  }
}

async function sintetizarEEnviarAudio(dados, apiKey, res) {
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
            prebuiltVoiceConfig: { voiceName: "Aoede" },
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

  res.setHeader("X-Ignorado", "0");
  res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || ""));
  res.setHeader("X-Resposta", encodeURIComponent(dados.resposta || ""));
  res.setHeader("X-Memoria-Turismo", encodeURIComponent(dados.memoria_atualizada || ""));
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", pcm16k.length);
  return res.status(200).send(pcm16k);
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
