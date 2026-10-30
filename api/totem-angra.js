// api/totem-angra.js (Versão TURBO: Thinking Desativado + GPS Instantâneo + Sem Gargalo de Search)
export const config = {
  api: { bodyParser: false },
};

const COORD_PADRAO_TOTEM = { lat: -22.9968, lon: -44.3045 };

// Dicionário Instantâneo (0ms) dos locais mais buscados em Angra (evita esperar a API Nominatim!)
const LOCAIS_RAPIDOS_ANGRA = {
  "shopping piratas": { lat: -23.0016, lon: -44.3029, nomeOficial: "Shopping Piratas" },
  "marina piratas": { lat: -23.0022, lon: -44.3035, nomeOficial: "Marina Piratas" },
  "zona sul": { lat: -23.0015, lon: -44.3028, nomeOficial: "Supermercado Zona Sul (Shopping Piratas)" },
  "rede market": { lat: -22.9965, lon: -44.3075, nomeOficial: "Supermercado Rede Market (Balneário)" },
  "mercado": { lat: -22.9965, lon: -44.3075, nomeOficial: "Supermercado Rede Market (Rua Pref. João Galindo)" },
  "supermercado": { lat: -22.9965, lon: -44.3075, nomeOficial: "Supermercado Rede Market (Balneário)" },
  "farmacia": { lat: -23.0014, lon: -44.3029, nomeOficial: "Drogaria no Shopping Piratas / João Galindo" },
  "drogaria": { lat: -23.0014, lon: -44.3029, nomeOficial: "Drogaria no Shopping Piratas" },
  "rodoviaria": { lat: -22.9972, lon: -44.3088, nomeOficial: "Terminal Rodoviário de Angra dos Reis" },
  "cais de santa luzia": { lat: -23.0094, lon: -44.3182, nomeOficial: "Cais de Santa Luzia (Centro)" },
  "cais da lapa": { lat: -23.0079, lon: -44.3168, nomeOficial: "Cais da Lapa (Centro)" },
  "centro": { lat: -23.0085, lon: -44.3175, nomeOficial: "Centro de Angra dos Reis" },
  "convento do carmo": { lat: -23.0088, lon: -44.3179, nomeOficial: "Convento do Carmo (Praça Gen. Osório)" },
  "igreja matriz": { lat: -23.0075, lon: -44.3188, nomeOficial: "Igreja Matriz de Nossa Senhora da Conceição" },
  "santa casa": { lat: -23.0068, lon: -44.3195, nomeOficial: "Santa Casa de Misericórdia de Angra" },
  "hospital": { lat: -23.0068, lon: -44.3195, nomeOficial: "Hospital Santa Casa de Angra" },
  "upa": { lat: -22.9765, lon: -44.2942, nomeOficial: "UPA / Hospital Municipal da Japuíba" },
  "praia da chacara": { lat: -22.9998, lon: -44.3055, nomeOficial: "Praia da Chácara" },
  "praia do jardim": { lat: -23.0038, lon: -44.3025, nomeOficial: "Praia do Jardim" },
  "praia do bonfim": { lat: -23.0218, lon: -44.3275, nomeOficial: "Praia do Bonfim" },
  "praia grande": { lat: -23.0252, lon: -44.3315, nomeOficial: "Praia Grande" },
  "praia das gordas": { lat: -23.0205, lon: -44.3258, nomeOficial: "Praia das Gordas" },
  "colegio naval": { lat: -23.0155, lon: -44.3238, nomeOficial: "Colégio Naval (Enseada Batista das Neves)" },
  "cachoeira da caputera": { lat: -22.9785, lon: -44.3150, nomeOficial: "Estrada da Caputera / Serra D'Água" },
  "banqueta": { lat: -22.9710, lon: -44.3020, nomeOficial: "Poços da Banqueta" },
  "bracuhy": { lat: -22.9055, lon: -44.3895, nomeOficial: "Cachoeira do Bracuhy (Usina)" },
  "ariro": { lat: -22.9120, lon: -44.3390, nomeOficial: "Cachoeira do Ariró" },
  "banco": { lat: -23.0082, lon: -44.3180, nomeOficial: "Agências Bancárias (Rua Coronel Carvalho)" },
};

let cacheClima = { dados: "Sol entre nuvens, 27°C.", previsaoDias: "Dias firmes.", expiraEm: 0 };
const cacheCoordenadas = new Map();
const cacheRotasOSRM = new Map();

function obterDataHoraAngra() {
  const agora = new Date();
  const opcoes = {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const partes = new Intl.DateTimeFormat("pt-BR", opcoes).formatToParts(agora);
  const mapa = {};
  for (const p of partes) mapa[p.type] = p.value;

  const horaNum = parseInt(mapa.hour, 10);
  let saudacao = "Boa noite";
  if (horaNum >= 5 && horaNum < 12) saudacao = "Bom dia";
  else if (horaNum >= 12 && horaNum < 18) saudacao = "Boa tarde";

  return {
    textoCompleto: `${mapa.weekday}, ${mapa.day}/${mapa.month} às ${mapa.hour}:${mapa.minute}`,
    saudacao,
  };
}

// Atualiza o clima em segundo plano sem nunca travar a pergunta do turista!
async function obterClimaRapido() {
  if (Date.now() < cacheClima.expiraEm) return cacheClima;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900); // Máximo 0.9s!

    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-22.9968&longitude=-44.3045&current=temperature_2m,precipitation,weather_code&daily=weather_code,temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=America%2FSao_Paulo";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const c = data.current;
      const d = data.daily;
      const temp = c ? Math.round(c.temperature_2m) : 26;
      const chuva = c ? c.precipitation : 0;
      const amanhaMax = d?.temperature_2m_max?.[1] ? Math.round(d.temperature_2m_max[1]) : 28;
      const amanhaChuva = d?.precipitation_probability_max?.[1] ?? 10;

      cacheClima = {
        dados: `${temp}°C agora (${chuva > 0 ? "Chovendo" : "Sem chuva"}).`,
        previsaoDias: `Amanhã: Máx ${amanhaMax}°C, chance de chuva ${amanhaChuva}%.`,
        expiraEm: Date.now() + 20 * 60 * 1000,
      };
    }
  } catch (e) {}
  return cacheClima;
}

async function buscarCoordenadasInstantanea(termoBusca) {
  const chave = termoBusca
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // 1. Verifica no Dicionário Instantâneo de Angra (0 milissegundos!)
  for (const [k, val] of Object.entries(LOCAIS_RAPIDOS_ANGRA)) {
    if (chave.includes(k) || k.includes(chave)) return val;
  }

  if (cacheCoordenadas.has(chave)) return cacheCoordenadas.get(chave);

  // 2. Fallback rápido no Nominatim (timeout curto de 1.1s)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1100);
    const query = encodeURIComponent(`${termoBusca}, Angra dos Reis, RJ`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: { "User-Agent": "TotemAngraTurbo/3.0" },
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

  if (dist < 15 || tipo === "arrive" || !rua) return null;

  if (idioma.toLowerCase().startsWith("en")) {
    const dirEn = mod.includes("left") ? "turn left on" : mod.includes("right") ? "turn right on" : "follow";
    return `${dirEn} ${rua} for ${dist}m`;
  }
  if (idioma.toLowerCase().startsWith("es")) {
    const dirEs = mod.includes("left") ? "gira a la izquierda en" : mod.includes("right") ? "gira a la derecha en" : "sigue por";
    return `${dirEs} ${rua} por ${dist}m`;
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
  const chaveRota = `${destinoDesejado}|${idioma}`.toLowerCase().trim();
  if (cacheRotasOSRM.has(chaveRota)) return cacheRotasOSRM.get(chaveRota);

  try {
    const coordDestino = await buscarCoordenadasInstantanea(destinoDesejado);
    if (!coordDestino) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1100); // Timeout rápido de 1.1s
    const urlOsrm = `https://router.project-osrm.org/route/v1/driving/${COORD_PADRAO_TOTEM.lon},${COORD_PADRAO_TOTEM.lat};${coordDestino.lon},${coordDestino.lat}?overview=false&steps=true`;

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
    const manobras = [];
    for (const s of passos) {
      const m = traduzirManobraCurta(s, idioma);
      if (m && manobras.length < 2) manobras.push(m);
    }

    const distTexto =
      distanciaMetros >= 1000
        ? `${(distanciaMetros / 1000).toFixed(1)} km`
        : `${distanciaMetros} metros`;

    const tempoTexto =
      distanciaMetros <= 1400 ? `${tempoPeMin} minutos a pé` : `${tempoCarroMin} minutos de carro`;

    let fraseGpsPronta = "";
    if (manobras.length > 0) {
      if (idioma.toLowerCase().startsWith("en")) {
        fraseGpsPronta = ` It is ${distTexto} away (${tempoTexto}): ${manobras.join(", then ")}.`;
      } else if (idioma.toLowerCase().startsWith("es")) {
        fraseGpsPronta = ` Está a ${distTexto} (${tempoTexto}): ${manobras.join(", luego ")}.`;
      } else {
        fraseGpsPronta = ` Fica a ${distTexto}, cerca de ${tempoTexto}: ${manobras.join(" e depois ")}.`;
      }
    }

    const resultado = { destinoEncontrado: coordDestino.nomeOficial, fraseFalaDireta: fraseGpsPronta };
    cacheRotasOSRM.set(chaveRota, resultado);
    return resultado;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const tInicio = Date.now();
  const infoHora = obterDataHoraAngra();

  if (req.method === "GET") {
    const destinoTeste = req.query?.destino || "Shopping Piratas";
    const rotaTeste = await calcularRotaExataOSRM("", destinoTeste, "pt");
    return res.status(200).json({
      status: "Guia Angra TURBO Online (Thinking OFF + Dicionario Instantaneo)!",
      latenciaTotalMs: `${Date.now() - tInicio} ms`,
      testeRotaGPS: rotaTeste,
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
      req.headers["x-memoria-turismo"] || "Sessão recém-iniciada."
    );

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // CENÁRIO A: Boas-vindas Instantâneas
    if (acaoInicial === "boas_vindas") {
      const textoBoasVindas = `${infoHora.saudacao}! Bem-vindo a Angra dos Reis. Como você se chama e o que gostaria de conhecer hoje?`;
      return await sintetizarEEnviarAudio(
        {
          transcricao: "[Boas-Vindas]",
          resposta: textoBoasVindas,
          memoria_atualizada: "Sessão iniciada.",
        },
        apiKey,
        res
      );
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

    const dadosClima = await obterClimaRapido();
    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

    const promptTurbo = `
Você é o Guia Turístico, Navegador GPS e Historiador de Angra dos Reis (RJ).
Contexto silencioso (só mencione se perguntarem): Totem na "${localizacaoTotem}" (Parque das Palmeiras, perto da Rua Pref. João Galindo, Av. Jair Toscano, Balneário e Shopping Piratas) | Hora: ${infoHora.textoCompleto} | Clima: ${dadosClima.dados} ${dadosClima.previsaoDias} | Memória: "${memoriaAnterior}".

REGRAS DE RESPOSTA ULTRA-RÁPIDA:
1. Se for apenas barulho/vento sem fala, retorne "ruido_ignorado": true.
2. DIREÇÕES E LOCALIZAÇÃO: Se perguntarem ONDE FICA ou COMO CHEGAR a um local (mercado, farmácia, shopping, rodoviária, praia, cais, hospital, igreja, cachoeira):
   - Defina "precisa_rota_gps": true e coloque o nome simples em "destino_busca_gps" (ex: "Rede Market", "Shopping Piratas", "Cais de Santa Luzia", "Praia do Bonfim").
   - Na "resposta", diga APENAS 1 frase curta (máximo 16 palavras) indicando qual é o local, pois o GPS vai colar os metros e as ruas logo em seguida!
3. HISTÓRIA, NAUFRÁGIOS E PIRATAS (QUANDO SOLICITADO):
   - Se pedirem história (fundação em 1502, Convento do Carmo, São Bernardino, Lazareto, Presídio de Dois Rios, naufrágios Pinguino, Califórnia e Aquidabã, ou corsários como Thomas Cavendish e Jorge Grego), defina "precisa_rota_gps": false e conte em até 3 frases curtas (máximo 48 palavras).
4. Responda no mesmo idioma do visitante, diferencie pessoas pelo timbre da voz e NUNCA use asteriscos ou emojis.

Retorne APENAS JSON:
{
  "ruido_ignorado": false,
  "precisa_rota_gps": false,
  "destino_busca_gps": "",
  "idioma_detectado": "pt",
  "transcricao": "[Idioma/Voz] fala",
  "resposta": "Fala curta e direta",
  "memoria_atualizada": "Vozes/nomes e assuntos"
}`;

    const resUnico = await fetch(urlTexto, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/wav", data: wavBuffer.toString("base64") } },
              { text: promptTurbo },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          // SEGREDO DA VELOCIDADE: Desativa o pensamento oculto demorado do Gemini 2.5 Flash!
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    const dataUnico = await resUnico.json();
    if (!resUnico.ok) {
      return res.status(500).json({ etapa: "gemini_turbo", erro: dataUnico });
    }

    const textoUnico = dataUnico.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let dados;
    try {
      dados = JSON.parse(textoUnico);
    } catch (e) {
      dados = {
        ruido_ignorado: false,
        precisa_rota_gps: false,
        transcricao: "[Voz]",
        resposta: textoUnico.replace(/[*#`{}"]/g, "").substring(0, 220),
        memoria_atualizada: memoriaAnterior,
      };
    }

    if (dados.ruido_ignorado === true || (!dados.resposta && !dados.destino_busca_gps)) {
      res.setHeader("X-Ignorado", "1");
      res.setHeader("Content-Length", "0");
      return res.status(200).end();
    }

    // Anexa a rota GPS em 0ms (se estiver no dicionário/cache) ou em <1s via OSRM
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
