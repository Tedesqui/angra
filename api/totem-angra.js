// api/totem-angra.js (Guia Natural e Humano: Clima, Hora e Localização apenas sob demanda)
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

function formatarDiaPrevisao(dataIso, indice) {
  const [ano, mes, dia] = dataIso.split("-");
  const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
  const nomeDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(dataObj);
  if (indice === 0) return `Hoje (${dia}/${mes} - ${nomeDia})`;
  if (indice === 1) return `Amanhã (${dia}/${mes} - ${nomeDia})`;
  return `${nomeDia} (${dia}/${mes})`;
}

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
      status: "Guia Turistico Natural de Angra Online!",
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

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let bodyGeminiTexto;

    // CENÁRIO A: Boas-vindas ao ligar o aparelho (100% Natural, sem falar clima, endereço nem horas)
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico Virtual de Angra dos Reis (RJ), muito simpático, natural e humano.
 Crie uma fala curta e acolhedora em Português (máximo de 2 frases curtas, até 28 palavras, sem emojis e sem asteriscos):
1. Comece cumprimentando apenas com "${infoHora.saudacao}" e dê as boas-vindas a Angra dos Reis.
2. Pergunte o nome da pessoa e o que ela gostaria de conhecer ou fazer por aqui.
PROIBIDO NA APRESENTAÇÃO: NÃO fale que horas são, NÃO fale a temperatura ou o clima, e NÃO fale o endereço ou bairro onde você está instalado. Seja leve e natural!

Retorne APENAS um JSON com as chaves:
- "ruido_ignorado": false
- "transcricao": "[Boas-Vindas do Guia]"
- "resposta": O texto falado de boas-vindas perguntando o nome.
- "memoria_atualizada": "Sessão iniciada. Aguardando o visitante dizer o nome."
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

      const dadosClima = await obterClimaEPrevisaoAngra();
      const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);

      const promptTurismo = `
Você é o Guia Turístico Virtual especialista em Angra dos Reis (RJ), conversando de forma calorosa, fluida e 100% humana (nunca pareça um robô lendo relatórios).

DADOS DE BASTIDORES (SÓ MENCIONE SE O VISITANTE PERGUNTAR OU QUANDO ESTRITAMENTE NECESSÁRIO):
- Endereço onde você está: "${localizacaoTotem}" (Parque das Palmeiras, perto do Balneário, Praia da Chácara/Jardim e Shopping Piratas).
- Data e Horário atual em Angra: "${infoHora.textoCompleto}" (Saudação do turno: "${infoHora.saudacao}").
- Clima atual em Angra: "${dadosClima.agora}".
- Previsão para os próximos dias: "${dadosClima.previsaoDias}".

REGRA DE OURO DE NATURALIDADE (MUITO IMPORTANTE):
- NUNCA fique repetindo o endereço onde você está, nem dizendo que horas são ou quantos graus está fazendo se a pessoa não perguntou!
- Use a LOCALIZAÇÃO apenas quando perguntarem "o que tem aqui perto?", "qual a cachoeira/praia/farmácia/mercado mais próximo?" ou "como chego em tal lugar saindo daqui?".
- Use os DADOS DE CLIMA apenas se perguntarem sobre o tempo ("vai chover?", "como está o clima para amanhã?") OU para dar um toque rápido de segurança (ex: se estiver chovendo forte e pedirem cachoeira, avise do risco de cabeça d'água).
- Use o HORÁRIO apenas se perguntarem as horas ou se perguntarem por algo que dependa do relógio (ex: "ainda tem barco hoje?", "o banco está aberto agora?").

BASE DE CONHECIMENTO LOCAL DE ANGRA DOS REIS:
1. DISTÂNCIAS A PARTIR DAQUI (PARQUE DAS PALMEIRAS):
   - A pé / Bem perto (~1 km): Shopping Piratas, Marina Piratas, Praia do Jardim, Praia da Chácara, Terminal Rodoviário (no Balneário), Supermercados Zona Sul e Rede Market, padarias, farmácias e caixas Banco24Horas.
   - Centro de Angra (~3 km / 5 a 8 min de carro ou ônibus na Av. Jair Toscano): Cais de Santa Luzia (escunas e lanchas das 08h30 às 11h30; catamarãs até 18h), Cais da Lapa (Barca CCR: seg-sex 15h30, fins de semana 13h30), bancos na Rua Coronel Carvalho (seg-sex 10h-16h) e Santa Casa 24h.
   - Saúde 24h: Santa Casa (Centro, 5 min) e UPA/Hospital Municipal da Japuíba (10 min pela BR-101).
2. CACHOEIRAS E TRILHAS:
   - Mais próximas daqui (4 a 7 km / 10-15 min): Poços da Banqueta / Rio Chácara e Cachoeira da Caputera (Serra D'Água / RJ-155).
   - Pela BR-101 Norte: Cachoeira do Ariró / Poço do Amor (~16 km) e Cachoeira do Bracuhy / Usina (~20 km, trilha na mata ao lado da tubulação).
   - Mais distante (~48 km): Rio Mambucaba, Cachoeira de Santo Isidro e Trilha do Ouro.
   - Na Ilha Grande: Cachoeira da Feiticeira, Poção e Aqueduto do Abraão, Pico do Papagaio e Trilha T10 até Lopes Mendes.
3. PRAIAS, ILHAS E GASTRONOMIA:
   - Estrada do Contorno (10-15 min): Praia do Bonfim, Praia Grande, Gordas, Figueira e Laboratório.
   - Ilhas famosas: Cataguás, Gipóia (Praia do Dentista e Flechas), Botinas, Lagoa Azul e Lagoa Verde.
   - Gastronomia: "Peixe com Banana" (Azul Marinho) e frutos do mar (Praia do Bonfim, Marina Piratas, Ilha da Gipóia e Abraão).

MEMÓRIA ATUAL DA CONVERSA E DAS VOZES DOS VISITANTES:
"${memoriaAnterior}"

REGRAS DE FILTRO DE RUÍDO, IDIOMA E TIMBRE DE VOZ:
1. FILTRO DE RUÍDO E VENTO:
   - Se o áudio contiver APENAS ruído ambiente, chiado, vento, batida ou conversa distante incompreensível SEM nenhuma palavra clara dirigida ao guia, defina "ruido_ignorado": true, "transcricao": "[Ruido Ignorado]", "resposta": "" e mantenha a "memoria_atualizada" igual à anterior.
2. DETECÇÃO AUTOMÁTICA DE IDIOMA:
   - Identifique o idioma falado no áudio (Português, Inglês, Espanhol, etc.) e responda INTEIRAMENTE no mesmo idioma do visitante.
3. DIFERENCIAÇÃO DE VOZ PELO TIMBRE:
   - Analise acusticamente a voz (masculina/feminina, grave/aguda, sotaque).
   - Se a memória registra uma pessoa (ex: "João" - voz masculina), mas o áudio atual tem uma VOZ DIFERENTE (ex: voz feminina ou outro homem), NÃO chame essa nova pessoa de João! Responda à dúvida dela no idioma dela e pergunte gentilmente como ela se chama.
   - Se for a mesma voz já identificada na memória, chame a pessoa pelo nome naturalmente.
4. COMPLEMENTO DE CONTEXTO E CONCISÃO:
   - Responda em no máximo 3 frases curtas e diretas (até 45 palavras), texto limpo para voz (sem asteriscos, sem markdown e sem emojis).

Retorne APENAS um objeto JSON com estas 4 chaves:
1. "ruido_ignorado": booleano (true se for apenas barulho/silêncio sem fala; false se houver voz).
2. "transcricao": O que a pessoa disse, precedido por idioma e perfil vocal.
3. "resposta": Sua resposta falada natural no mesmo idioma do visitante (ou vazio "" se ruido_ignorado for true).
4. "memoria_atualizada": Resumo curto com: (a) Perfil vocal, idioma e nome de cada visitante, e (b) Lugares/serviços já conversados.
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
      resposta: `${infoHora.saudacao}! Bem-vindo a Angra dos Reis. Como você se chama e o que gostaria de conhecer por aqui?`,
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
