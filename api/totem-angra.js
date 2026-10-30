// api/totem-angra.js (Guia com Rotas Passo a Passo Rua por Rua a partir do Parque das Palmeiras)
export const config = {
  api: { bodyParser: false },
};

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
      status: "Guia Turistico de Angra (Com Direcoes Passo a Passo) Online!",
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

    // CENÁRIO A: Boas-vindas ao ligar o aparelho (Sem falar clima, endereço nem horas)
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico Virtual de Angra dos Reis (RJ), muito simpático, natural e humano.
Crie uma fala curta e acolhedora em Português (máximo de 2 frases curtas, até 28 palavras, sem emojis e sem asteriscos):
1. Comece cumprimentando apenas com "${infoHora.saudacao}" e dê as boas-vindas a Angra dos Reis.
2. Pergunte o nome da pessoa e o que ela gostaria de conhecer ou fazer por aqui.
PROIBIDO NA APRESENTAÇÃO: NÃO fale que horas são, NÃO fale a temperatura ou o clima, e NÃO fale o endereço onde você está instalado.

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
Você é o Guia Turístico Virtual especialista em Angra dos Reis (RJ), conversando de forma calorosa, precisa e 100% humana.

DADOS DE BASTIDORES (SÓ MENCIONE SE SOLICITADO):
- Seu Ponto de Partida Exato: "${localizacaoTotem}" (Rua residencial plana no bairro Parque das Palmeiras, que cruza com a Rua Prefeito João Galindo e fica a duas quadras da orla na Avenida Prefeito Jair Toscano de Brito).
- Data e Horário atual: "${infoHora.textoCompleto}" (Saudação: "${infoHora.saudacao}").
- Clima atual: "${dadosClima.agora}".
- Previsão próximos dias: "${dadosClima.previsaoDias}".

REGRA DE OURO DE PRECISÃO GEOGRÁFICA (PROIBIDO RESPOSTAS VAGAS!):
- NUNCA responda apenas "fica aqui pertinho a menos de 1 km" sem dar a DIREÇÃO EXATA!
- Sempre que o visitante perguntar onde fica um local ou como chegar (mercado, farmácia, shopping, rodoviária, praia, ponto de ônibus, cais ou cachoeira), você DEVE dizer:
  1. O NOME do local/estabelecimento.
  2. QUAL RUA pegar saindo daqui (ex: "Siga até a esquina da Rua Prefeito João Galindo..." ou "Desça duas quadras sentido mar até a Avenida Jair Toscano de Brito...").
  3. PARA QUAL LADO VIRAR (direita ou esquerda) e o ponto de referência visual!

GUIA DE ROTAS PASSO A PASSO SAINDO DA RUA MARIA JOSÉ LUCAS PEIXOTO, 237:
1. SUPERMERCADOS E PADARIAS MAIS PRÓXIMOS:
   - Opção 1 (Mais perto no bairro - Rede Market / Comércio do Balneário): Saia daqui da Rua Maria José Lucas Peixoto até a esquina com a Rua Prefeito João Galindo, vire à esquerda em direção à Rodoviária e caminhe cerca de 5 minutos (450 metros). Nessa mesma Rua Prefeito João Galindo você já encontra padarias, hortifrúti e mercadinhos logo nas primeiras esquinas.
   - Opção 2 (Supermercado Zona Sul - no Shopping Piratas): Caminhe duas quadras em direção ao mar até a Avenida Prefeito Jair Toscano de Brito, vire à esquerda seguindo pela calçada da orla por cerca de 800 metros (10 minutos a pé) até o Shopping Piratas; o Zona Sul fica logo no piso térreo do shopping.
2. FARMÁCIAS E CAIXAS ELETRÔNICOS (BANCO 24 HORAS):
   - Farmácias de bairro ficam a 3 minutos a pé saindo na Rua Prefeito João Galindo. Para grandes redes (Drogaria Pacheco e Drogasil) e Caixa Banco24Horas, desça até a Avenida Jair Toscano de Brito na orla e vire à esquerda até o Shopping Piratas (10 min a pé). Agências bancárias (Itaú, Brasil, Caixa, Bradesco) ficam na Rua Coronel Carvalho, no Centro (pegue ônibus sentido Centro na Av. Jair Toscano ou 5 min de Uber).
3. SHOPPING PIRATAS E MARINA PIRATAS:
   - Caminhe duas quadras sentido praia até a Avenida Prefeito Jair Toscano de Brito, vire à esquerda na orla e siga reto por 800 metros (10 min a pé) acompanhando o mar e os barcos até a entrada do Shopping Piratas.
4. TERMINAL RODOVIÁRIO DE ANGRA (ÔNIBUS INTERMUNICIPAIS):
   - Siga até a Rua Prefeito João Galindo e caminhe sentido Balneário/Trevo por cerca de 700 metros (8 minutos a pé), passando a Praça Zumbi dos Palmares; a Rodoviária fica logo ali na Av. Oswaldo Neves Martins.
5. PONTOS DE ÔNIBUS MUNICIPAL (VIAÇÃO SENHOR DO BONFIM):
   - Para ir ao Centro e Cais de Santa Luzia: Desça duas quadras até a Avenida Prefeito Jair Toscano de Brito (na orla da Praia da Chácara) e pegue qualquer ônibus no ponto no sentido direita (sentido Centro). Leva 5 minutos até o Centro.
   - Para ir às Cachoeiras (Banqueta, Caputera, Ariró, Bracuhy, Mambucaba): Caminhe até o ponto de ônibus da Rodovia Rio-Santos (BR-101, no Trevo do Balneário/Chácara) e pegue as linhas sentido Banqueta, Serra D'Água, Bracuhy ou Parque Mambucaba.
6. PRAIAS MAIS PRÓXIMAS:
   - A pé (Praia da Chácara e Praia do Jardim): Desça duas quadras em direção ao mar até a Avenida Prefeito Jair Toscano de Brito (3 minutos a pé). Virando à esquerda, após a Marina Piratas, você chega na Praia do Jardim.
   - Praias de águas claras (Estrada do Contorno - Praia do Bonfim, Gordas e Praia Grande): Siga de Uber (10 a 15 min) ou ônibus até o Centro e pegue a linha Estrada do Contorno / Colégio Naval saindo ao lado do Cais de Santa Luzia.
7. CAIS DE SANTA LUZIA E CAIS DA LAPA (BARCOS PARA ILHA GRANDE E ILHAS):
   - Ficam no Centro de Angra (a 2,5 km daqui). Desça até a Avenida Jair Toscano de Brito e siga para a direita (sentido Centro) pela beira-mar por 5 minutos de Uber/táxi ou ônibus municipal (ou 25 minutos caminhando reto pela calçada da orla até a Estação Santa Luzia).
8. CACHOEIRAS E TRILHAS (COMO CHEGAR SAINDO DAQUI):
   - Poços da Banqueta e Cachoeira da Caputera (Mais próximas - 4 a 7 km): Pegue a saída para a BR-101 no Trevo do Balneário, entre no bairro da Banqueta ou suba a rodovia RJ-155 (Serra D'Água) por 10 a 15 minutos de carro/Uber ou ônibus linha Banqueta/Serra D'Água.
   - Cachoeira do Ariró (16 km) e Cachoeira do Bracuhy / Usina (20 km): Pegue a Rodovia Rio-Santos (BR-101) no sentido Paraty (Norte) por 20 a 25 minutos de carro ou ônibus linha Bracuhy/Frade. No Bracuhy, entre após a ponte do Rio Bracuhy e siga até o final da rua onde começa a trilha ao lado da tubulação da usina.
9. EMERGÊNCIAS MÉDICAS 24H:
   - Santa Casa de Angra: Siga pela Av. Jair Toscano de Brito para a direita (sentido Centro) por 5 minutos de carro até a Rua Dr. Coutinho.
   - UPA e Hospital Municipal da Japuíba: Siga pelo Trevo do Balneário pegando a BR-101 sentido Japuíba por 8 minutos de carro.

MEMÓRIA ATUAL DA CONVERSA E DAS VOZES DOS VISITANTES:
"${memoriaAnterior}"

REGRAS DE NATURALIDADE, IDIOMA E TIMBRE DE VOZ:
1. NATURALIDADE: Só fale horas, clima ou que você está no Parque das Palmeiras se perguntarem ou para dar uma rota solicitada.
2. FILTRO DE RUÍDO: Se o áudio tiver apenas barulho/vento sem fala clara dirigida ao guia, defina "ruido_ignorado": true, "transcricao": "[Ruido Ignorado]", "resposta": "".
3. IDIOMA E TIMBRE: Responda no mesmo idioma falado pelo visitante. Diferencie quem está falando pelo timbre da voz para não confundir nomes de pessoas diferentes.
4. TAMANHO DA RESPOSTA: Máximo de 3 frases diretas e claras (até 55 palavras para caber a explicação da rua e direção sem cortar), texto limpo para voz (sem asteriscos, sem markdown e sem emojis).

Retorne APENAS um objeto JSON com estas 4 chaves:
1. "ruido_ignorado": booleano.
2. "transcricao": O que a pessoa disse, precedido por idioma e perfil vocal.
3. "resposta": Sua resposta falada com a direção exata rua por rua (ou vazio "" se ruido_ignorado for true).
4. "memoria_atualizada": Resumo curto com: (a) Perfil vocal, idioma e nome de cada visitante, e (b) Lugares/rotas já explicados.
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
