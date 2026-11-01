// api/totem-angra.js (Mapa Completo de 1ª, 2ª e 3ª Opção + Trava Antirruído)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "Mestre de RPG Online com Mapa Completo!" });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

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
Você é o Motor Lógico de um RPG Medieval que aciona faixas MP3 em um DFPlayer Mini.

ESTADO ATUAL DO JOGADOR:
"${estadoAtual}"

REGRA ABSOLUTA CONTRA RUÍDO E SILÊNCIO:
- Se o áudio contiver apenas chiado, vento, eco, batida ou silêncio sem uma fala humana clara, retorne OBRIGATORIAMENTE: {"ignorado": true}.
- Nunca invente frases se não houver voz nítida.

COMANDOS DE SISTEMA (Podem ser ditos a qualquer momento):
- "repetir", "repete", "não ouvi" -> "acao_sistema": "REPETIR_ULTIMO", "faixas": []
- "repetir apresentação", "repetir introdução" -> "acao_sistema": "REPETIR_APRESENTACAO", "faixas": []
- "salvar jogo", "guardar progresso" -> "acao_sistema": "SALVAR_JOGO", "faixas": []
- "continuar jogo", "carregar jogo" -> "acao_sistema": "CARREGAR_JOGO", "faixas": []
- "reiniciar", "começar do zero" -> "acao_sistema": "NENHUMA", "faixas": [1, 2], "novo_estado": "ETAPA:SELECAO | ESTILO:NENHUM | ULTIMO_AUDIO:2"

COMO FUNCIONA A TRANSIÇÃO DE FAIXAS (ATENÇÃO MÁXIMA):
- A faixa 3 ("0003.mp3") SÓ PODE SER TOCADA UMA ÚNICA VEZ no jogo inteiro, que é quando o jogador está no "ULTIMO_AUDIO:2" (ETAPA:SELECAO).
- Se o "ULTIMO_AUDIO" for 11, 12, 13, 21, 22, 23, 31, 32, 33, 34, 41 ou 42, JAMAIS retorne a faixa 3! Retorne APENAS a próxima faixa correspondente à escolha.

MAPA EXATO DE OPÇÕES DE CADA ÁUDIO (Aceite tanto a descrição quanto "primeira opção", "segunda opção" ou "terceira opção"):

* SE ULTIMO_AUDIO = 2 (Escolha do Guerreiro):
  - 1ª opção / Guardião do Escudo de Prata -> estilo = GUARDIAO (faixa 11)
  - 2ª opção / Explorador do Arco Real -> estilo = EXPLORADOR (faixa 12)
  - 3ª opção / Estrategista da Espada Dourada -> estilo = ESTRATEGISTA (faixa 13)
  * Regra do áudio 2: Se a pessoa escolheu o estilo E falou "escolha finalizada" (ou se já escolheu direto querendo avançar), retorne "faixas": [3, 11] (para 1ª opção/Guardião), "faixas": [3, 12] (para 2ª opção/Explorador) ou "faixas": [3, 13] (para 3ª opção/Estrategista) e atualize ULTIMO_AUDIO para 11, 12 ou 13.

* SE ULTIMO_AUDIO = 11 (Guardião no Vale):
  - 1ª opção (socorrer o moinho / camponeses) -> "faixas": [21], "novo_estado": "ETAPA:SUBIDA | ESTILO:GUARDIAO | ULTIMO_AUDIO:21"
  - 2ª opção (atravessar o rio profundo a nado de armadura) -> "faixas": [61], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:61"
  - 3ª opção (avançar pela ponte protegido pelas muretas / atacar barricada) -> "faixas": [22], "novo_estado": "ETAPA:SUBIDA | ESTILO:GUARDIAO | ULTIMO_AUDIO:22"

* SE ULTIMO_AUDIO = 12 (Explorador no Vale):
  - 1ª opção (trilha oculta da cachoeira até o moinho) -> "faixas": [21], "novo_estado": "ETAPA:SUBIDA | ESTILO:EXPLORADOR | ULTIMO_AUDIO:21"
  - 2ª opção (disparar flecha nos barris da ponte) -> "faixas": [22], "novo_estado": "ETAPA:SUBIDA | ESTILO:EXPLORADOR | ULTIMO_AUDIO:22"
  - 3ª opção (correr sozinho pelo campo aberto contra os lanceiros) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 13 (Estrategista no Vale):
  - 1ª opção (liderar lenhadores no moinho) -> "faixas": [21], "novo_estado": "ETAPA:SUBIDA | ESTILO:ESTRATEGISTA | ULTIMO_AUDIO:21"
  - 2ª opção (exibir estandarte real na ponte) -> "faixas": [22], "novo_estado": "ETAPA:SUBIDA | ESTILO:ESTRATEGISTA | ULTIMO_AUDIO:22"
  - 3ª opção (entrar sozinho no barranco escuro) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 21 (Moinho de Trigo):
  - 1ª opção (entrar pelo aqueduto subterrâneo com a chave) -> "faixas": [31], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:31"
  - 2ª opção (escalar a torre da vigia com os moradores) -> "faixas": [32], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:32"
  - 3ª opção (correr pela velha ponte de cordas podres) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

* SE ULTIMO_AUDIO = 22 (Ponte de Pedra Dominada):
  - 1ª opção (subir usando a senha secreta no portão principal) -> "faixas": [31], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:31"
  - 2ª opção (esconder-se dentro da carroça de suprimentos) -> "faixas": [32], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:32"
  - 3ª opção (beber o vinho das ânforas da guarita) -> "faixas": [64], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:64"

* SE ULTIMO_AUDIO = 23 (Acampamento nas Rochas):
  - 1ª opção (seguir pela estrada real pavimentada com o mapa) -> "faixas": [31], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:31"
  - 2ª opção (soltar os cavalos para distrair os guardas) -> "faixas": [32], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:32"
  - 3ª opção (atravessar a tempestade pelo Desfiladeiro da Morte) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

* SE ULTIMO_AUDIO = 31 (Salão das Armaduras):
  - 1ª opção (trancar os oficiais na Sala de Guerra à esquerda) -> "faixas": [34], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:34"
  - 2ª opção (subir pela escadaria em espiral à direita para salvar o príncipe) -> "faixas": [33], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:33"
  - 3ª opção (correr pisando nos fios metálicos do corredor central) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 32 (Pátio Interno):
  - 1ª opção (subir até a Casa das Engrenagens para destravar o portão) -> "faixas": [42], "novo_estado": "ETAPA:FINAL | ULTIMO_AUDIO:42"
  - 2ª opção (ir pelas colunas até a Torre Real resgatar o príncipe) -> "faixas": [33], "novo_estado": "ETAPA:CASTELO | ULTIMO_AUDIO:33"
  - 3ª opção (gritar e enfrentar sozinho os 50 mercenários) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 33 (Resgate do Príncipe na Torre):
  - 1ª opção (guiar o príncipe pela passagem secreta da tapeçaria / telhados) -> "faixas": [42], "novo_estado": "ETAPA:FINAL | ULTIMO_AUDIO:42"
  - 2ª opção (defender o topo da escada contra o Duque) -> "faixas": [41], "novo_estado": "ETAPA:FINAL | ULTIMO_AUDIO:41"
  - 3ª opção (pular pela janela de 30 metros sobre o fosso de pedras) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

* SE ULTIMO_AUDIO = 34 (Arsenal com os 6 Soldados Aliados):
  - 1ª opção (enviar os soldados ao Grande Salão e subir para resgatar o príncipe) -> "faixas": [41], "novo_estado": "ETAPA:FINAL | ULTIMO_AUDIO:41"
  - 2ª opção (levar todos os soldados juntos até a Torre Leste) -> "faixas": [42], "novo_estado": "ETAPA:FINAL | ULTIMO_AUDIO:42"
  - 3ª opção (entrar no depósito de pólvora com a tocha acesa) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 41 (Duelo Final contra o Duque no Pátio):
  - 1ª opção (desarmar o Duque atingindo o cabo do machado) -> "faixas": [51], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:51"
  - 2ª opção (contra-atacar rápido na junta da armadura) -> "faixas": [53], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:53"
  - 3ª opção (largar a espada e o escudo no chão de braços abertos) -> "faixas": [66], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:66"

* SE ULTIMO_AUDIO = 42 (Cerco Final na Muralha):
  - 1ª opção (duelo direto de espadas para render o Duque) -> "faixas": [51], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:51"
  - 2ª opção (cortar a corda do contrapeso para abrir os portões) -> "faixas": [52], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:52"
  - 3ª opção (virar de costas para o Duque durante o ataque) -> "faixas": [66], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:66"

Se o jogador disser algo incompreensível que não se encaixa em nenhuma opção da cena atual, retorne "faixas": [54] e mantenha o mesmo "novo_estado".

Retorne APENAS um JSON válido neste formato:
{
  "ignorado": false,
  "acao_sistema": "NENHUMA",
  "transcricao": "o que a pessoa disse",
  "faixas": [22],
  "novo_estado": "ETAPA:SUBIDA | ESTILO:GUARDIAO | ULTIMO_AUDIO:22"
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
          temperature: 0.0,
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
