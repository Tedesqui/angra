// api/totem-angra.js (Guia Completo + Hora de Brasília + Clima Agora e Previsão para os Próximos Dias)
export const config = {
  api: { bodyParser: false },
};

// Obtém o dia da semana, hora exata e saudação no fuso de Brasília/Angra dos Reis (America/Sao_Paulo)
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
    horaNum,
    minutoNum: parseInt(mapa.minute, 10),
    diaSemana: mapa.weekday,
  };
}

// Traduz o código meteorológico WMO da Open-Meteo para Português claro
function traduzirCodigoWMO(codigo) {
  const codigosWMO = {
    0: "Céu limpo e ensolarado",
    1: "Predominantemente aberto",
    2: "Sol entre nuvens",
    3: "Céu encoberto / nublado",
    45: "Nevoeiro",
    48: "Nevoeiro úmido",
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
    96: "Tempestade forte",
  };
  return codigosWMO[codigo] || "Tempo variável";
}

// Formata uma data "YYYY-MM-DD" para dia da semana (ex: "Sexta-feira (30/10)")
function formatarDiaPrevisao(dataIso, indice) {
  const [ano, mes, dia] = dataIso.split("-");
  const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
  const nomeDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(dataObj);
  if (indice === 0) return `Hoje (${dia}/${mes} - ${nomeDia})`;
  if (indice === 1) return `Amanhã (${dia}/${mes} - ${nomeDia})`;
  return `${nomeDia} (${dia}/${mes})`;
}

// Consulta gratuita em tempo real do clima atual + previsão para os próximos dias em Angra
async function obterClimaEPrevisaoAngra() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);

    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-22.9994&longitude=-44.3039&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=America%2FSao_Paulo";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { agora: "Clima indisponível.", previsaoDias: "Previsão indisponível." };
    const data = await res.json();
    const c = data.current;
    const d = data.daily;

    const condicaoAgora = c ? traduzirCodigoWMO(c.weather_code) : "Indisponível";
    const textoAgora = c
      ? `${condicaoAgora}, Temperatura atual: ${Math.round(c.temperature_2m)}°C (Sensação: ${Math.round(c.apparent_temperature)}°C), Chuva no momento: ${c.precipitation} mm, Vento: ${Math.round(c.wind_speed_10m)} km/h.`
      : "Clima indisponível no momento.";

    let listaDias = [];
    if (d && d.time) {
      for (let i = 0; i < d.time.length; i++) {
        const rotuloDia = formatarDiaPrevisao(d.time[i], i);
        const condDia = traduzirCodigoWMO(d.weather_code[i]);
        const min = Math.round(d.temperature_2m_min[i]);
        const max = Math.round(d.temperature_2m_max[i]);
        const chanceChuva = d.precipitation_probability_max?.[i] ?? 0;
        listaDias.push(`${rotuloDia}: ${condDia}, Mín ${min}°C / Máx ${max}°C, Chance de chuva: ${chanceChuva}%`);
      }
    }

    return {
      agora: textoAgora,
      previsaoDias: listaDias.join(" | "),
    };
  } catch (e) {
    return {
      agora: "Clima em tempo real indisponível.",
      previsaoDias: "Previsão para os próximos dias indisponível.",
    };
  }
}

export default async function handler(req, res) {
  const infoHora = obterDataHoraAngra();

  if (req.method === "GET") {
    const climaTeste = await obterClimaEPrevisaoAngra();
    return res.status(200).json({
      status: "Guia Turistico Completo de Angra (Com Previsao de 4 Dias) Online!",
      dataHoraBrasilia: infoHora.textoCompleto,
      saudacaoTurno: infoHora.saudacao,
      climaAgoraEmAngra: climaTeste.agora,
      previsaoProximosDias: climaTeste.previsaoDias,
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

    const dadosClima = await obterClimaEPrevisaoAngra();

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let bodyGeminiTexto;

    // CENÁRIO A: Boas-vindas ao ligar o aparelho
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico e de Serviços Locais de Angra dos Reis (RJ), instalado em: "${localizacaoTotem}".
HORÁRIO EXATO DE BRASÍLIA AGORA: "${infoHora.textoCompleto}" (Use a saudação "${infoHora.saudacao}").
CLIMA EXATO AGORA: "${dadosClima.agora}".
PREVISÃO PARA OS PRÓXIMOS DIAS: "${dadosClima.previsaoDias}".

O totem acabou de ficar pronto. Crie uma fala curta e calorosa em Português (máximo de 2 a 3 frases curtas, até 38 palavras, sem emojis e sem asteriscos):
1. Comece cumprimentando com "${infoHora.saudacao}" e dê as boas-vindas a Angra dos Reis aqui no Parque das Palmeiras, comentando brevemente o clima atual.
2. Pergunte o nome da pessoa e como pode ajudá-la hoje ou no roteiro de amanhã.

Retorne APENAS um JSON com as chaves:
- "ruido_ignorado": false
- "transcricao": "[Boas-Vindas do Guia]"
- "resposta": O texto falado de boas-vindas perguntando o nome.
- "memoria_atualizada": "Sessão iniciada (${infoHora.textoCompleto}). Clima: ${dadosClima.agora}. Aguardando o visitante dizer o nome."
`;

      bodyGeminiTexto = {
        contents: [{ role: "user", parts: [{ text: promptBoasVindas }] }],
        generationConfig: { responseMimeType: "application/json" },
      };
    } 
    // CENÁRIO B: Áudio captado pelo microfone
    else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const pcmBuffer = Buffer.concat(chunks);

      if (pcmBuffer.length < 1000) {
        res.setHeader("X-Ignorado", "1");
        res.setHeader("Content-Length", "0");
        return res.status(200).end();
      }

      const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

      const promptTurismo = `
Você é o Guia Turístico e de Utilidade Pública especialista em Angra dos Reis (RJ).

SUA LOCALIZAÇÃO FÍSICA EXATA NESTE MOMENTO:
"${localizacaoTotem}" (Bairro Parque das Palmeiras, região central e plana de Angra dos Reis, colado no Balneário, Praia da Chácara, Praia do Jardim e Shopping Piratas).

DATA E HORÁRIO EXATO DE BRASÍLIA AGORA:
"${infoHora.textoCompleto}" — Saudação correta para este turno: "${infoHora.saudacao}".

CONDIÇÃO METEOROLÓGICA REAL EM ANGRA DOS REIS:
- CLIMA AGORA: "${dadosClima.agora}"
- PREVISÃO PARA HOJE, AMANHÃ E PRÓXIMOS DIAS: "${dadosClima.previsaoDias}"

REGRAS DE USO DA PREVISÃO DO TEMPO E HORÁRIOS:
1. PLANEJAMENTO PARA AMANHÃ E PRÓXIMOS DIAS:
   - Se o visitante perguntar sobre o tempo para amanhã ou para os próximos dias (ou se já for noite e ele quiser planejar passeio de barco/praia/cachoeira para o dia seguinte), consulte a lista "PREVISÃO PARA HOJE, AMANHÃ E PRÓXIMOS DIAS", informe a temperatura máxima e a chance de chuva exata e recomende o melhor passeio!
   - Se a previsão de amanhã indicar chuva forte (acima de 70% de chance com pancadas fortes ou tempestade), alerte sobre o risco de cabeça d'água em cachoeiras e sugira alternativas seguras ou passeios nos dias de sol da lista.
2. BARCAS E PASSEIOS NÁUTICOS (Cais de Santa Luzia e Cais da Lapa - a 3 km daqui):
   - Escunas e Lanchas Compartilhadas (Cais de Santa Luzia / Marina Piratas): Saídas concentradas pela manhã entre 08h30 e 11h30. Se já passou das 12h30, sugira Taxi-Boat, lancha privativa ou programar o passeio para amanhã de manhã (informando como estará o clima amanhã!).
   - Catamarãs Rápidos / Flexboat (Cais de Santa Luzia para Vila do Abraão): Saídas frequentes das 08h00 às 18h00.
   - Barca Oficial da CCR (Cais da Lapa para Vila do Abraão): Segunda a sexta às 15h30; sábados, domingos e feriados às 13h30.
3. HORÁRIOS DO COMÉRCIO E SERVIÇOS PRÓXIMOS AO PARQUE DAS PALMEIRAS:
   - Shopping Piratas (a 1 km daqui): Lojas das 10h às 22h (domingos 14h às 20h); Praça de Alimentação, cinema e restaurantes da Marina até as 22h/23h.
   - Supermercados (Zona Sul e Rede Market próximos): Das 07h30 às 21h/22h (domingos até ~20h).
   - Bancos (Agências na Rua Coronel Carvalho, Centro): Segunda a sexta, das 10h às 16h (caixas Banco24Horas no Shopping Piratas e mercados funcionam até as 22h).
   - Emergências 24 horas: Santa Casa de Angra (Centro, a 5 min), UPA/Hospital Municipal da Japuíba (a 10 min pela BR-101) e farmácias 24h no Centro.

MAPA COMPLETO DE REFERÊNCIAS A PARTIR DA RUA MARIA JOSÉ LUCAS PEIXOTO, 237:
- Transporte: Terminal Rodoviário a ~1 km (no Balneário). Pontos de ônibus da Viação Senhor do Bonfim na Av. Prefeito Jair Toscano de Brito (sentido Centro/Cais) e no Trevo da BR-101 (sentido Banqueta, Caputera, Ariró, Bracuhy e Mambucaba). Uber e Táxi rápidos no local.
- Cachoeiras: Poços da Banqueta e Caputera/Serra D'Água (4 a 7 km / 10-15 min); Ariró (~16 km); Bracuhy (~20 km); Mambucaba (~48 km). Na Ilha Grande: Cachoeira da Feiticeira, Poção do Abraão e Pico do Papagaio.
- Praias e Gastronomia: Praia do Jardim e Chácara (a 1 km a pé); Estrada do Contorno (Bonfim, Grande, Gordas, Figueira a 10-15 min). Prato típico: Peixe com Banana (Azul Marinho) e frutos do mar.

MEMÓRIA ATUAL DA CONVERSA E DAS VOZES DOS VISITANTES:
"${memoriaAnterior}"

REGRAS DE OURO (FILTRO DE RUÍDO, IDIOMA, SAUDAÇÃO E TIMBRE DE VOZ):
1. FILTRO DE RUÍDO E VENTO (ECONOMIA DE API):
   - Se o áudio contiver APENAS ruído ambiente, chiado, vento, batida ou conversa distante incompreensível SEM nenhuma palavra clara dirigida ao guia, defina "ruido_ignorado": true, "transcricao": "[Ruido Ignorado]", "resposta": "" e mantenha a "memoria_atualizada" igual à anterior.
2. DETECÇÃO DE IDIOMA E SAUDAÇÃO DO TURNO:
   - Identifique o idioma falado no áudio (Português, Inglês, Espanhol, etc.) e responda INTEIRAMENTE no mesmo idioma do visitante, usando a saudação correspondente ao horário atual ("${infoHora.saudacao}") ao iniciar conversa com alguém novo.
3. DIFERENCIAÇÃO DE VOZ PELO TIMBRE:
   - Analise acusticamente a voz (masculina/feminina, grave/aguda, sotaque).
   - Se a memória registra uma pessoa (ex: "João" - voz masculina), mas o áudio atual tem uma VOZ DIFERENTE (ex: voz feminina ou outro homem), NÃO chame essa nova pessoa de João! Cumprimente de acordo com o horário, responda à dúvida dela e pergunte gentilmente como ela se chama.
   - Se for a mesma voz já identificada na memória, chame a pessoa pelo nome naturalmente.
4. COMPLEMENTO DE CONTEXTO E CONCISÃO:
   - Responda em no máximo 3 frases curtas e diretas (até 45 palavras), texto limpo para voz (sem asteriscos, sem markdown e sem emojis).

Retorne APENAS um objeto JSON com estas 4 chaves:
1. "ruido_ignorado": booleano (true se for apenas barulho/silêncio sem fala; false se houver voz).
2. "transcricao": O que a pessoa disse, precedido por idioma e perfil vocal (ex: "[PT - Voz Masculina] Vai fazer sol amanhã para ir à Lagoa Azul?").
3. "resposta": Sua resposta falada no mesmo idioma do visitante (ou vazio "" se ruido_ignorado for true).
4. "memoria_atualizada": Resumo curto com: (a) Perfil vocal, idioma e nome de cada visitante, e (b) Lugares/serviços já perguntados.
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
              { text: promptTurismo },
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
      ruido_ignorado: false,
      transcricao: "...",
      resposta: `${infoHora.saudacao}! Bem-vindo a Angra dos Reis, aqui no Parque das Palmeiras. Como você se chama e como posso ajudar você agora?`,
      memoria_atualizada: memoriaAnterior,
    };

    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

    if (dados.ruido_ignorado === true || !dados.resposta || dados.resposta.trim() === "") {
      res.setHeader("X-Ignorado", "1");
      res.setHeader("X-Transcricao", encodeURIComponent(dados.transcricao || "[Ruido Ignorado]"));
      res.setHeader("X-Memoria-Turismo", encodeURIComponent(memoriaAnterior));
      res.setHeader("Content-Length", "0");
      return res.status(200).end();
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
