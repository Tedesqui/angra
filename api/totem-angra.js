// api/totem-angra.js (Mestre de RPG Medieval Balanceado + Salvar Jogo + Repetir Último Áudio)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Medieval (Com Salvar Jogo e Repetir Audio) Online!",
      chaveConfigurada: !!process.env.GEMINI_API_KEY,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente na Vercel");

    const estadoAtual = decodeURIComponent(
      req.headers["x-estado-rpg"] || "ETAPA:SELECAO | ESTILO:NENHUM | ULTIMO_AUDIO:2"
    );

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pcmBuffer = Buffer.concat(chunks);

    if (pcmBuffer.length < 1000) {
      return res.status(200).json({ ignorado: true });
    }

    const wavBuffer = adicionarCabecalhoWav(pcmBuffer, 16000);
    const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptRPG = `
Você é o Motor Lógico de um RPG Medieval do Guerreiro que aciona faixas MP3 em um DFPlayer Mini.

ESTADO ATUAL DO JOGADOR:
"${estadoAtual}"

COMANDOS ESPECIAIS DE SISTEMA (PRIORIDADE MÁXIMA):
1. REPETIR O ÚLTIMO ÁUDIO: Se o jogador disser "repetir", "repete", "repetir último áudio", "não ouvi", "fala de novo" ou "pode repetir", defina "acao_sistema": "REPETIR_ULTIMO", "faixas": [] e mantenha o "novo_estado" igual ao atual.
2. REPETIR A APRESENTAÇÃO: Se o jogador pedir especificamente "repetir apresentação", "repetir introdução" ou "repetir o primeiro áudio", defina "acao_sistema": "REPETIR_APRESENTACAO", "faixas": [].
3. SALVAR JOGO: Se o jogador disser "salvar jogo", "salvar progresso" ou "guardar jogo", defina "acao_sistema": "SALVAR_JOGO", "faixas": [] e mantenha o "novo_estado" igual ao atual.
4. CARREGAR / CONTINUAR JOGO SALVO: Se o jogador disser "continuar jogo", "carregar jogo" ou "abrir jogo salvo", defina "acao_sistema": "CARREGAR_JOGO", "faixas": [].
5. REINICIAR DO ZERO: Se o jogador disser "reiniciar" ou "começar do zero", defina "acao_sistema": "NENHUMA", "faixas": [1, 2] e "novo_estado": "ETAPA:SELECAO | ESTILO:NENHUM | ULTIMO_AUDIO:2".

MAPA DE FAIXAS MP3 DA AVENTURA:
- 1: Apresentação da história | 2: Escolha do equipamento (Guardião do Escudo=11, Explorador do Arco=12, Estrategista da Espada=13) | 3: Início da marcha (ao falar "escolha finalizada")
- ATO 2 (Vale): 11 (Guardião: salvar moinho->21, muretas da ponte->22, nadar de armadura pesada->61 MORTE), 12 (Explorador: trilha da cachoeira->21, flecha nos barris->22, correr aberto contra lanceiros->62 MORTE), 13 (Estrategista: lenhadores no moinho->21, estandarte na ponte->22, acampamento nas rochas->23)
- ATO 3 (Subida): 21 (Moinho salvo: aqueduto subterrâneo->31, escalar torre com moradores->32, ponte de cordas podres->63 MORTE), 22 (Ponte tomada: senha no portão->31, carroça de suprimentos->32, beber vinho envenenado->64 MORTE), 23 (Acampamento: estrada pavimentada com mapa->31, soltar cavalos->32, nevasca no desfiladeiro->63 MORTE)
- ATO 4 (Fortaleza): 31 (Salão das Armaduras: trancar Sala de Guerra->34, escada da Torre do Relógio->33, pisar nos fios da armadilha->65 MORTE), 32 (Pátio Interno: Casa das Engrenagens->42, Torre Real->33, atacar 50 soldados sozinho->62 MORTE), 33 (Príncipe salvo: passagem da tapeçaria->42, defender topo da escada->41), 34 (Arsenal com aliados: cercar salão e resgatar príncipe->41, todos juntos na Torre Leste->42)
- ATO 5 (Confronto Final): 41 (Duelo com o Duque: desarmar o Duque->51 VITÓRIA, contra-ataque na armadura->53 VITÓRIA, largar armas parado->66 MORTE), 42 (Muralha ao Amanhecer: duelo de espadas->51 VITÓRIA, cortar corda do portão->52 VITÓRIA, virar de costas para o Duque->66 MORTE)
- 54: Áudio de dúvida (se a pessoa falou algo que não faz sentido com a cena).

REGRAS DA SELEÇÃO INICIAL ("ETAPA:SELECAO"):
- Se o jogador escolheu o estilo (Guardião=11, Explorador=12, Estrategista=13) mas ainda NÃO disse "escolha finalizada", retorne "faixas": [] e salve o estilo em "novo_estado".
- Quando falar "escolha finalizada", retorne "faixas": [3, 11] (ou [3, 12] ou [3, 13] conforme o estilo escolhido).

Retorne APENAS um JSON válido:
{
  "ignorado": false,
  "acao_sistema": "NENHUMA",
  "transcricao": "O que o jogador disse",
  "faixas": [3, 11],
  "novo_estado": "ETAPA:VALE | ESTILO:GUARDIAO | ULTIMO_AUDIO:11"
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
              { text: promptRPG },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    const data = await resGemini.json();
    const textoJson = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return res.status(200).send(textoJson);
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
