// api/totem-angra.js (Guia Completo: Cachoeiras, Trilhas, Embarques, Gastronomia, Multilíngue e Filtro Anti-Ruído)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Guia Turistico Completo de Angra dos Reis Online!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    const acaoInicial = req.headers["x-acao-inicial"] || "";
    const memoriaAnterior = decodeURIComponent(
      req.headers["x-memoria-turismo"] ||
        "Sessão recém-iniciada. Nenhum visitante identificado ainda."
    );

    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let bodyGeminiTexto;

    // CENÁRIO A: Boas-vindas ao ligar o aparelho
    if (acaoInicial === "boas_vindas") {
      const promptBoasVindas = `
Você é o Guia Turístico Virtual de Angra dos Reis (RJ), muito simpático, acolhedor e prestativo.
O totem acabou de ficar pronto. Crie uma fala curta e calorosa em Português (máximo de 2 a 3 frases curtas, até 35 palavras, sem emojis e sem asteriscos):
1. Dê as boas-vindas a Angra dos Reis (mencionando que você fala português, inglês ou espanhol).
2. Pergunte o nome da pessoa e se ela quer dicas de ilhas, cachoeiras, passeios de barco ou gastronomia hoje.

Retorne APENAS um JSON com as chaves:
- "ruido_ignorado": false
- "transcricao": "[Boas-Vindas do Guia]"
- "resposta": O texto falado de boas-vindas perguntando o nome.
- "memoria_atualizada": "Sessão iniciada. Aguardando o visitante dizer o nome e o idioma."
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
Você é um Guia Turístico Virtual especialista em Angra dos Reis (RJ).

BASE DE CONHECIMENTO COMPLETA DE ANGRA DOS REIS:
1. CACHOEIRAS E TRILHAS DO CONTINENTE:
   - Bracuhy: Cachoeira do Bracuhy / Usina (trilha pela Mata Atlântica seguindo a tubulação histórica, poços cristalinos no Rio Bracuhy e ruínas).
   - Ariró: Cachoeira do Ariró e Poço do Amor (águas doces cercadas por mata nativa, próximo à aldeia indígena Guarani Sapukai).
   - Banqueta e Sertãozinho: Poços naturais de águas super cristalinas que descem da serra.
   - Serra D'Água (RJ-155): Cachoeira da Caputera e quedas d'água da Serra do Mar.
   - Mambucaba / Serra da Bocaina: Rio Mambucaba (boia-cross, rafting e poços), Cachoeira de Santo Isidro e a histórica Trilha do Ouro.
2. TRILHAS E CACHOEIRAS DA ILHA GRANDE:
   - Cachoeira da Feiticeira (queda de 15m), Circuito do Abraão (Ruínas do Lazareto, Aqueduto Imperial e Poção), Pico do Papagaio (Trilha T13 - 982m de altitude) e Trilha T10 (Abraão até Lopes Mendes passando por Palmas e Mangues).
3. PRAIAS E ILHAS FAMOSAS:
   - Ilha de Cataguás, Ilha da Gipóia (Praia do Dentista, Flechas, Piedade), Ilhas Botinas, Lagoa Azul, Lagoa Verde e praias da Estrada do Contorno (Grande, Bonfim, Gordas, Figueira, Laboratório).
4. EMBARQUES, BARCAS E PASSEIOS NÁUTICOS:
   - Cais de Santa Luzia (Centro de Angra): Principal ponto turístico de embarque para escunas, lanchas compartilhadas (Ilhas Paradisíacas / Ilha Grande), taxi-boat e catamarãs rápidos para a Vila do Abraão.
   - Cais da Lapa (Centro): Ponto de partida da Barca Oficial da CCR Barcas para a Vila do Abraão (viagem de aprox. 1h20, opção mais econômica) e embarcações locais.
   - Outros pontos de embarque: Marina Verolme, Marina Piratas (ao lado do Shopping Piratas) e Porto Bracuhy para aluguel de lanchas privativas; além de Conceição de Jacareí (distrito de Mangaratiba vizinho a Angra, com travessia rápida de 15 a 20 min para o Abraão).
5. GASTRONOMIA CAIÇARA E ONDE COMER:
   - Prato Típico Oficial: "Peixe com Banana" (ou Azul Marinho, feito com peixe fresco, banana-da-terra ou caturra meia-verde e pirão no caldo), além de caldeiradas de frutos do mar, camarão na moranga, ostras e vieiras frescas da baía.
   - Principais Polos Gastronômicos: Vila do Abraão (Ilha Grande), Praia do Bonfim e Praia Grande (Estrada do Contorno), Canto do Saco e Praia das Flechas (Ilha da Gipóia, com restaurantes pé na areia e bares flutuantes na Praia do Dentista), Vila Histórica de Mambucaba e Porto Bracuhy.

MEMÓRIA ATUAL DA CONVERSA E DAS VOZES DOS VISITANTES:
"${memoriaAnterior}"

REGRAS DE OURO (FILTRO DE RUÍDO, IDIOMA, TIMBRE DE VOZ E CONTEXTO):
1. FILTRO DE RUÍDO E VENTO (ECONOMIA DE API):
   - Se o áudio contiver APENAS ruído ambiente, chiado, vento, batida, tosse, cachorro latindo, televisão ao fundo ou conversa distante incompreensível SEM nenhuma palavra clara dirigida ao guia, defina "ruido_ignorado": true, "transcricao": "[Ruido Ignorado]", "resposta": "" e mantenha a "memoria_atualizada" igual à anterior.
   - Se houver fala humana real, defina "ruido_ignorado": false.
2. DETECÇÃO AUTOMÁTICA DE IDIOMA:
   - Identifique o idioma falado no áudio (Português, Inglês, Espanhol, Francês, etc.) e responda INTEIRAMENTE no mesmo idioma do visitante.
3. DIFERENCIAÇÃO DE VOZ PELO TIMBRE:
   - Analise acusticamente a voz (masculina/feminina, grave/aguda, sotaque).
   - Se a memória registra uma pessoa (ex: "João" - voz masculina), mas o áudio atual tem uma VOZ DIFERENTE (ex: voz feminina ou outro homem), NÃO chame essa nova pessoa de João! Responda à dúvida dela no idioma dela e pergunte gentilmente como ela se chama.
   - Se for a mesma voz já identificada na memória, chame a pessoa pelo nome naturalmente.
   - Se ainda não souber o nome de quem falou, responda à dúvida turística primeiro e pergunte o nome no final.
4. COMPLEMENTO DE CONTEXTO E CONCISÃO:
   - Use a memória para ligar perguntas seguidas (ex: "e como chego lá?", "onde comer perto daí?").
   - Responda em no máximo 3 frases curtas e diretas (até 45 palavras), texto limpo para voz (sem asteriscos, sem markdown e sem emojis).

Retorne APENAS um objeto JSON com estas 4 chaves:
1. "ruido_ignorado": booleano (true se for apenas barulho/silêncio sem fala; false se houver voz).
2. "transcricao": O que a pessoa disse, precedido por idioma e perfil vocal (ex: "[PT - Voz Feminina] Onde pego o barco para a Ilha Grande?").
3. "resposta": Sua resposta falada no mesmo idioma do visitante (ou vazio "" se ruido_ignorado for true).
4. "memoria_atualizada": Resumo curto com: (a) Perfil vocal, idioma e nome de cada visitante, e (b) Lugares/assuntos já conversados.
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
      resposta: "Olá! Bem-vindo a Angra dos Reis. Como você se chama e o que gostaria de conhecer hoje?",
      memoria_atualizada: memoriaAnterior,
    };

    try {
      dados = JSON.parse(jsonBruto);
    } catch (e) {
      dados.resposta = jsonBruto;
    }

    // SE FOR APENAS RUÍDO/VENTO: Cancela a geração de voz (TTS) para economizar API e tempo!
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
