// api/totem-angra.js (Guia Completo + Clima em Tempo Real via Open-Meteo + Segurança em Cachoeiras)
export const config = {
  api: { bodyParser: false },
};

// Consulta gratuita e em tempo real do clima em Angra dos Reis (Parque das Palmeiras)
async function obterClimaAtualAngra() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // Timeout rápido de 2.5s

    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-22.9994&longitude=-44.3039&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=America%2FSao_Paulo";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return "Clima indisponível no momento.";
    const data = await res.json();
    const c = data.current;
    if (!c) return "Clima indisponível no momento.";

    const codigosWMO = {
      0: "Céu limpo e ensolarado",
      1: "Predominantemente aberto",
      2: "Parcialmente nublado",
      3: "Céu encoberto / nublado",
      45: "Nevoeiro",
      51: "Garoa leve",
      53: "Garoa moderada",
      55: "Garoa intensa",
      61: "Chuva fraca",
      63: "Chuva moderada",
      65: "Chuva forte",
      80: "Pancadas de chuva leves",
      81: "Pancadas de chuva moderadas",
      82: "Pancadas de chuva fortes",
      95: "Tempestade com trovoadas",
    };

    const condicao = codigosWMO[c.weather_code] || "Tempo variável";
    return `${condicao}, Temperatura atual: ${Math.round(c.temperature_2m)}°C (Sensação térmica: ${Math.round(c.apparent_temperature)}°C), Chuva agora: ${c.precipitation} mm, Vento: ${Math.round(c.wind_speed_10m)} km/h.`;
  } catch (e) {
    return "Clima em tempo real indisponível.";
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const climaTeste = await obterClimaAtualAngra();
    return res.status(200).json({
      status: "Guia Turistico, Comercial e Climatico de Angra dos Reis Online!",
      climaAtualEmAngra: climaTeste,
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

    // Busca o clima exato de Angra dos Reis neste instante
    const climaAgora = await obterClimaAtualAngra();

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let bodyGeminiTexto;

    // CENÁRIO A: Boas-vindas ao ligar o aparelho
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico e de Serviços Locais de Angra dos Reis (RJ), instalado em: "${localizacaoTotem}".
CLIMA EXATO EM ANGRA DOS REIS AGORA: "${climaAgora}".

O totem acabou de ficar pronto. Crie uma fala curta e calorosa em Português (máximo de 2 a 3 frases curtas, até 38 palavras, sem emojis e sem asteriscos):
1. Dê as boas-vindas a Angra dos Reis aqui no Parque das Palmeiras comentando brevemente a temperatura/clima atual.
2. Pergunte o nome da pessoa e se ela quer dicas de passeios, praias, cachoeiras ou comércios aqui perto.

Retorne APENAS um JSON com as chaves:
- "ruido_ignorado": false
- "transcricao": "[Boas-Vindas do Guia]"
- "resposta": O texto falado de boas-vindas perguntando o nome.
- "memoria_atualizada": "Sessão iniciada em ${localizacaoTotem}. Clima: ${climaAgora}. Aguardando o visitante dizer o nome."
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
Você está instalado em: "${localizacaoTotem}" (Bairro Parque das Palmeiras, região central e plana de Angra dos Reis, colado no Balneário, Praia da Chácara, Praia do Jardim e Shopping Piratas).

CONDIÇÃO METEOROLÓGICA REAL EM ANGRA DOS REIS AGORA:
"${climaAgora}"

COMO USAR O CLIMA NAS SUAS RECOMENDAÇÕES (MUITO IMPORTANTE):
- Se perguntarem como está o tempo ou se vale a pena ir à praia/ilha/cachoeira hoje, informe a temperatura e a condição atual real!
- ALERTA DE SEGURANÇA EM CACHOEIRAS: Se estiver chovendo (Chuva moderada, forte ou tempestade) e alguém pedir dica de cachoeira (Bracuhy, Caputera, Banqueta, Ariró, Mambucaba), alerte com carinho que em dias de chuva há risco de "cabeça d'água" nas quedas da Serra do Mar e recomende programas seguros como o Shopping Piratas (a 1 km daqui), restaurantes caiçaras na Praia do Bonfim/Marina Piratas ou passeio histórico no Centro.
- Se estiver sol ou tempo firme, incentive os passeios náuticos saindo da Marina Piratas ou do Cais de Santa Luzia, praias da Estrada do Contorno e cachoeiras.

MAPA COMPLETO DE COMÉRCIOS, SERVIÇOS, TRANSPORTE E TURISMO A PARTIR DA RUA MARIA JOSÉ LUCAS PEIXOTO, 237:
1. COMÉRCIOS, MERCADOS, FARMÁCIAS E BANCOS (A PÉ / MUITO PERTO):
   - Supermercados e Padarias: Bem próximo, na região da Chácara/Piratas e Av. Prefeito Jair Toscano de Brito, ficam o Supermercado Zona Sul, o Rede Market, padarias locais, conveniências, lanchonetes, pizzarias e restaurantes.
   - Shopping Piratas (a ~1 km / 10 a 12 min a pé ou 3 min de carro): Lojas, cinema, supermercado, praça de alimentação vista-mar, restaurantes na Marina Piratas e Boliche (ótima opção se chover!).
   - Farmácias e Bancos: Farmácias locais no Parque das Palmeiras/Balneário e grandes redes (Drogaria Pacheco e Raia) no Shopping Piratas e no Centro. Caixas Banco24Horas no Shopping Piratas e mercados próximos, e agências bancárias na Rua Coronel Carvalho (Centro, a 5 min).
   - Postos de Combustível: Postos de gasolina e GNV na saída para a Praia da Chácara e no acesso à BR-101.
2. TRANSPORTE PÚBLICO (ÔNIBUS), UBER E TÁXI SAINDO DAQUI:
   - Uber e Táxi: Atendimento rápido na porta e ponto de táxi no Shopping Piratas e na Rodoviária.
   - Ônibus (Viação Senhor do Bonfim) e Rodoviária: O Terminal Rodoviário de Angra fica bem perto, no Balneário/Parque das Palmeiras (~1 km daqui).
   - Linhas para o Centro e Cais de Santa Luzia: Na Av. Prefeito Jair Toscano de Brito (Beira-Mar/Chácara), qualquer linha sentido Centro (5 a 8 min).
   - Linhas para Cachoeiras (Banqueta, Caputera/Serra D'Água, Ariró, Bracuhy, Mambucaba): No ponto da BR-101 (Trevo da Chácara/Balneário), linhas sentido Banqueta, Japuíba, Serra D'Água, Bracuhy, Frade e Parque Mambucaba.
3. SAÚDE E EMERGÊNCIAS PRÓXIMAS:
   - Santa Casa de Misericórdia de Angra (Centro, a 5 min de carro) e UPA / Hospital Municipal da Japuíba (HMJ, a 8-10 min pela BR-101). SAMU 192, Bombeiros 193, Polícia 190 e Defesa Civil 199.
4. CACHOEIRAS E TRILHAS (POR ORDEM DE PROXIMIDADE DAQUI):
   - Mais próximas (4 a 7 km / 10 a 15 min): Poços da Banqueta / Rio Chácara e Cachoeira da Caputera (Serra D'Água / RJ-155).
   - A 20-30 min pela BR-101 Norte: Cachoeira do Ariró / Poço do Amor (~16 km) e Cachoeira do Bracuhy / Usina (~20 km).
   - Mais distante (~48 km): Rio Mambucaba, Cachoeira de Santo Isidro e Trilha do Ouro.
   - Na Ilha Grande (embarque no Cais de Santa Luzia a 3 km daqui): Cachoeira da Feiticeira, Poção e Aqueduto do Abraão, Pico do Papagaio e Trilha T10 até Lopes Mendes.
5. PRAIAS, ILHAS, EMBARQUES E GASTRONOMIA:
   - A pé daqui: Praia do Jardim e Praia da Chácara (~1 km).
   - Estrada do Contorno (10 a 15 min): Praia do Bonfim, Praia Grande, Gordas, Figueira e Laboratório.
   - Embarques: Marina Piratas (a 1 km), Cais de Santa Luzia (a 3 km, escunas, lanchas e catamarãs para Abraão, Lagoa Azul, Cataguás e Praia do Dentista na Gipóia) e Cais da Lapa (Barca oficial CCR).
   - Gastronomia: "Peixe com Banana" (Azul Marinho) e frutos do mar na Praia do Bonfim, Marina Piratas, Ilha da Gipóia e Vila do Abraão.

MEMÓRIA ATUAL DA CONVERSA E DAS VOZES DOS VISITANTES:
"${memoriaAnterior}"

REGRAS DE OURO (FILTRO DE RUÍDO, IDIOMA E TIMBRE DE VOZ):
1. FILTRO DE RUÍDO E VENTO (ECONOMIA DE API):
   - Se o áudio contiver APENAS ruído ambiente, chiado, vento, batida ou conversa distante incompreensível SEM nenhuma palavra clara dirigida ao guia, defina "ruido_ignorado": true, "transcricao": "[Ruido Ignorado]", "resposta": "" e mantenha a "memoria_atualizada" igual à anterior.
2. DETECÇÃO AUTOMÁTICA DE IDIOMA:
   - Identifique o idioma falado no áudio (Português, Inglês, Espanhol, Francês, etc.) e responda INTEIRAMENTE no mesmo idioma do visitante.
3. DIFERENCIAÇÃO DE VOZ PELO TIMBRE:
   - Analise acusticamente a voz (masculina/feminina, grave/aguda, sotaque).
   - Se a memória registra uma pessoa (ex: "João" - voz masculina), mas o áudio atual tem uma VOZ DIFERENTE (ex: voz feminina ou outro homem), NÃO chame essa nova pessoa de João! Responda à dúvida dela no idioma dela e pergunte gentilmente como ela se chama.
   - Se for a mesma voz já identificada na memória, chame a pessoa pelo nome naturalmente.
   - Se ainda não souber o nome de quem falou, responda à dúvida primeiro e pergunte o nome no final.
4. COMPLEMENTO DE CONTEXTO E CONCISÃO:
   - Responda em no máximo 3 frases curtas e diretas (até 45 palavras), texto limpo para voz (sem asteriscos, sem markdown e sem emojis).

Retorne APENAS um objeto JSON com estas 4 chaves:
1. "ruido_ignorado": booleano (true se for apenas barulho/silêncio sem fala; false se houver voz).
2. "transcricao": O que a pessoa disse, precedido por idioma e perfil vocal (ex: "[PT - Voz Masculina] Vale a pena ir na cachoeira hoje?").
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
      resposta: "Olá! Bem-vindo a Angra dos Reis, aqui no Parque das Palmeiras. Como você se chama e como posso ajudar você hoje?",
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
