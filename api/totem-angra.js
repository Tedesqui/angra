// api/totem-angra.js (Campanha Épica de 9 Atos - Faixas 0001 a 0084 + Comandos de Sistema)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Online - Campanha Expandida de 9 Atos (0001 a 0084)!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const estadoAtual = decodeURIComponent(
      req.headers["x-estado-rpg"] || "ETAPA:SELECAO | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:2"
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
Você é o Motor Lógico de um RPG Medieval de 9 Atos que aciona faixas MP3 (0001 a 0084) em um DFPlayer Mini.

ESTADO ATUAL DO JOGADOR:
"${estadoAtual}"

REGRA ABSOLUTA CONTRA RUÍDO E SILÊNCIO:
- Se o áudio contiver apenas chiado, vento, chuva, palmas, batida em móveis, som de motor de moto ou carro, eco, batida ou silêncio sem uma fala humana clara, retorne OBRIGATORIAMENTE: {"ignorado": true}.
- Nunca invente frases se não houver voz humana nítida.

COMANDOS DE SISTEMA (Podem ser ditos a qualquer momento):
- "repetir", "repete", "não ouvi", "fala de novo" -> "acao_sistema": "REPETIR_ULTIMO", "faixas": [], mantenha o mesmo "novo_estado"
- "repetir apresentação", "repetir introdução" -> "acao_sistema": "REPETIR_APRESENTACAO", "faixas": [], mantenha o mesmo "novo_estado"
- "salvar jogo", "salvar progresso", "guardar jogo" -> "acao_sistema": "SALVAR_JOGO", "faixas": [], mantenha o mesmo "novo_estado"
- "continuar jogo", "carregar jogo", "abrir jogo salvo" -> "acao_sistema": "CARREGAR_JOGO", "faixas": []
- "reiniciar", "começar do zero" -> "acao_sistema": "NENHUMA", "faixas": [1, 2], "novo_estado": "ETAPA:SELECAO | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:2"

REGRA DE PRESERVAÇÃO DE VARIÁVEIS NO "novo_estado":
Sempre mantenha o formato: "ETAPA:<nome> | ESTILO:<GUARDIAO/EXPLORADOR/ESTRATEGISTA> | ROTA:<MOINHO/PONTE/ROCHAS> | ULTIMO_AUDIO:<numero>".
Preserve os valores de ESTILO e ROTA já conquistados no ESTADO ATUAL.

MAPA COMPLETO DOS 9 ATOS (Aceite tanto a descrição da ação quanto "primeira opção", "segunda opção" ou "terceira opção"):

=====================================================================
ATO 1: SELEÇÃO DO EQUIPAMENTO (ULTIMO_AUDIO = 2)
=====================================================================
* SE ULTIMO_AUDIO = 2:
  - 1ª opção / Guardião do Escudo de Prata -> defina ESTILO:GUARDIAO
  - 2ª opção / Explorador do Arco Real -> defina ESTILO:EXPLORADOR
  - 3ª opção / Estrategista da Espada Dourada -> defina ESTILO:ESTRATEGISTA
  * Se o jogador apenas escolheu o estilo mas NÃO disse "escolha finalizada", retorne "faixas": [] e salve o estilo em "novo_estado" mantendo ULTIMO_AUDIO:2.
  * Se o jogador disse "escolha finalizada" (ou se escolheu o estilo já pedindo para iniciar/finalizar), retorne "faixas": [3, 71] e atualize para "ETAPA:FLORESTA | ESTILO:<escolhido> | ROTA:MOINHO | ULTIMO_AUDIO:71". (Se ESTILO ainda era NENHUM, assuma GUARDIAO).

=====================================================================
ATO 1.5: A FLORESTA DE ESPINHOS (ULTIMO_AUDIO = 71, 72, 73, 74)
=====================================================================
* SE ULTIMO_AUDIO = 71 (Emboscada no Bosque das Cinzas):
  - 1ª opção (avançar com força para proteger os médicos na carroça) -> "faixas": [72], ULTIMO_AUDIO:72
  - 2ª opção (usar a vegetação fechada para flanquear o capitão na árvore) -> "faixas": [73], ULTIMO_AUDIO:73
  - 3ª opção (atravessar o riacho pela ponte de troncos para atacar pela retaguarda) -> "faixas": [73], ULTIMO_AUDIO:73

* SE ULTIMO_AUDIO = 72 (Caravana Real Salva):
  - 1ª opção (seguir pelo leito seco do riacho coberto por raízes) -> "faixas": [74], ULTIMO_AUDIO:74
  - 2ª opção (tomar um cavalo de guerra e galopar pela colina aberta) -> "faixas": [74], ULTIMO_AUDIO:74
  - 3ª opção (marchar pelo pântano de areia movediça) -> "faixas": [83], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:83"

* SE ULTIMO_AUDIO = 73 (Cães de Caça na Mata):
  - 1ª opção (atravessar a correnteza rasa do riacho para apagar o rastro) -> "faixas": [74], ULTIMO_AUDIO:74
  - 2ª opção (subir pelas rochas íngremes com as cordas) -> "faixas": [74], ULTIMO_AUDIO:74
  - 3ª opção (esconder-se na caverna escura do urso) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 74 (Torre do Farol Antigo -> Conecta com 11, 12 ou 13 conforme o ESTILO):
  - 1ª opção (descer pela trilha secreta dos escudeiros) OU 2ª opção (derrubar os barris de pedra para bloquear a patrulha):
    -> Se ESTILO for GUARDIAO: "faixas": [11], ULTIMO_AUDIO:11
    -> Se ESTILO for EXPLORADOR: "faixas": [12], ULTIMO_AUDIO:12
    -> Se ESTILO for ESTRATEGISTA: "faixas": [13], ULTIMO_AUDIO:13
  - 3ª opção (ficar parado no meio da estrada aberta contra 20 cavaleiros) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

=====================================================================
ATO 2: A ENTRADA DO VALE (ULTIMO_AUDIO = 11, 12, 13 -> Conecta com 75)
=====================================================================
* SE ULTIMO_AUDIO = 11 (Guardião no Vale):
  - 1ª opção (socorrer o moinho / camponeses) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (atravessar o rio profundo a nado de armadura) -> "faixas": [61], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:61"
  - 3ª opção (avançar pela ponte protegido pelas muretas / barricada) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75

* SE ULTIMO_AUDIO = 12 (Explorador no Vale):
  - 1ª opção (trilha oculta da cachoeira até o moinho) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (disparar flecha nos barris da ponte) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75
  - 3ª opção (correr pelo campo aberto contra lanceiros) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 13 (Estrategista no Vale):
  - 1ª opção (liderar lenhadores no moinho) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (exibir estandarte real na ponte) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75
  - 3ª opção (acampamento nas rochas / barranco) -> "faixas": [75], defina ROTA:ROCHAS e ULTIMO_AUDIO:75

=====================================================================
ATO 2.5: VILA DE PEDRA BRANCA E FORJA (ULTIMO_AUDIO = 75, 76, 77, 78)
=====================================================================
* SE ULTIMO_AUDIO = 75 (Praça da Vila de Pedra Branca):
  - 1ª opção (avançar pela cortina de fumaça da forja) -> "faixas": [76], ULTIMO_AUDIO:76
  - 2ª opção (tocar o sino da capela à distância para distrair) -> "faixas": [76], ULTIMO_AUDIO:76
  - 3ª opção (pular dentro do poço fundo sem corda) -> "faixas": [61], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:61"

* SE ULTIMO_AUDIO = 76 (Mestre Ferreiro e a Catapulta):
  - 1ª opção (subir pela galeria de ventilação da mina de carvão) -> "faixas": [77], ULTIMO_AUDIO:77
  - 2ª opção (usar os escudos de ferro da forja pela trincheira) -> "faixas": [77], ULTIMO_AUDIO:77
  - 3ª opção (caminhar lentamente pelo campo de tiro aberto da catapulta) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 77 (Sabotagem da Catapulta):
  - 1ª opção (enviar mensagem falsa pelos pombos-correio) -> "faixas": [78], ULTIMO_AUDIO:78
  - 2ª opção (seguir imediatamente pela trilha segura da encosta) -> "faixas": [78], ULTIMO_AUDIO:78
  - 3ª opção (abrir a fechadura do baú com agulha envenenada) -> "faixas": [64], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:64"

* SE ULTIMO_AUDIO = 78 (Priorado da Montanha -> Conecta com 21, 22 ou 23 conforme a ROTA):
  - 1ª opção (contornar pela passarela lateral de pedra maciça) OU 2ª opção (usar alavanca de carvalho com os monges):
    -> Se ROTA for MOINHO: "faixas": [21], ULTIMO_AUDIO:21
    -> Se ROTA for PONTE: "faixas": [22], ULTIMO_AUDIO:22
    -> Se ROTA for ROCHAS: "faixas": [23], ULTIMO_AUDIO:23
  - 3ª opção (chutar as pedras que sustentam a rocha gigante) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

=====================================================================
ATO 3: SUBIDA DA MONTANHA (ULTIMO_AUDIO = 21, 22, 23 -> Conecta com 79)
=====================================================================
* SE ULTIMO_AUDIO = 21 (Moinho de Trigo):
  - 1ª opção (entrar pelo aqueduto subterrâneo com a chave) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (escalar a torre da vigia com os moradores) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (correr pela velha ponte de cordas podres) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

* SE ULTIMO_AUDIO = 22 (Ponte de Pedra Dominada):
  - 1ª opção (subir usando a senha secreta no portão) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (esconder-se dentro da carroça de suprimentos) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (beber o vinho das ânforas envenenadas) -> "faixas": [64], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:64"

* SE ULTIMO_AUDIO = 23 (Acampamento nas Rochas):
  - 1ª opção (seguir pela estrada pavimentada com o mapa) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (soltar os cavalos para distrair os guardas) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (atravessar a nevasca pelo Desfiladeiro da Morte) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

=====================================================================
ATO 3.5: CATACUMBAS E CALABOUÇOS (ULTIMO_AUDIO = 79, 80, 81, 82)
=====================================================================
* SE ULTIMO_AUDIO = 79 (Alavancas das Catacumbas):
  - 1ª opção (puxar a alavanca da Águia Dourada) -> "faixas": [80], ULTIMO_AUDIO:80
  - 2ª opção (puxar a alavanca do Leão de Prata) -> "faixas": [80], ULTIMO_AUDIO:80
  - 3ª opção (puxar a alavanca da Serpente Negra) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 80 (Calabouços e Capitão Rodrigo):
  - 1ª opção (aproximar-se furtivamente e pegar as chaves) -> "faixas": [81], ULTIMO_AUDIO:81
  - 2ª opção (imobilizar o carcereiro rapidamente com o cabo da arma) -> "faixas": [81], ULTIMO_AUDIO:81
  - 3ª opção (bater no gongo de bronze e se trancar na cela) -> "faixas": [84], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:84"

* SE ULTIMO_AUDIO = 81 (Cozinha Subterrânea):
  - 1ª opção (subir pela escada secreta dos despenseiros) -> "faixas": [82], ULTIMO_AUDIO:82
  - 2ª opção (subir pelo elevador de carga de madeira) -> "faixas": [82], ULTIMO_AUDIO:82
  - 3ª opção (entrar na chaminé da fornalha em chamas) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 82 (Galeria dos Retratos e Cães de Guarda -> Conecta com 31 ou 32):
  - 1ª opção (jogar a carne assada para distrair os cães) -> "faixas": [31], ULTIMO_AUDIO:31
  - 2ª opção (caminhar em silêncio por trás das cortinas de veludo) -> "faixas": [32], ULTIMO_AUDIO:32
  - 3ª opção (chutar as armaduras fazendo barulho ensurdecedor) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

=====================================================================
ATO 4 E ATO 5: CORAÇÃO DA FORTALEZA E DUELO FINAL (31 a 66)
=====================================================================
* SE ULTIMO_AUDIO = 31 (Salão das Armaduras):
  - 1ª opção (trancar os oficiais na Sala de Guerra à esquerda) -> "faixas": [34], ULTIMO_AUDIO:34
  - 2ª opção (subir pela escadaria em espiral à direita para salvar o príncipe) -> "faixas": [33], ULTIMO_AUDIO:33
  - 3ª opção (correr pisando nos fios metálicos da armadilha) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 32 (Pátio Interno):
  - 1ª opção (subir até a Casa das Engrenagens para destravar o portão) -> "faixas": [42], ULTIMO_AUDIO:42
  - 2ª opção (ir pelas colunas até a Torre Real resgatar o príncipe) -> "faixas": [33], ULTIMO_AUDIO:33
  - 3ª opção (enfrentar sozinho os 50 mercenários) -> "faixas": [62], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:62"

* SE ULTIMO_AUDIO = 33 (Resgate do Príncipe na Torre):
  - 1ª opção (guiar o príncipe pela passagem secreta da tapeçaria) -> "faixas": [42], ULTIMO_AUDIO:42
  - 2ª opção (defender o topo da escada contra o Duque) -> "faixas": [41], ULTIMO_AUDIO:41
  - 3ª opção (pular pela janela de 30 metros sobre as pedras) -> "faixas": [63], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:63"

* SE ULTIMO_AUDIO = 34 (Arsenal com os Soldados Aliados):
  - 1ª opção (enviar soldados ao Grande Salão e subir para resgatar o príncipe) -> "faixas": [41], ULTIMO_AUDIO:41
  - 2ª opção (levar todos os soldados juntos até a Torre Leste) -> "faixas": [42], ULTIMO_AUDIO:42
  - 3ª opção (entrar no depósito de pólvora com tocha acesa) -> "faixas": [65], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:65"

* SE ULTIMO_AUDIO = 41 (Duelo Final contra o Duque no Pátio):
  - 1ª opção (desarmar o Duque atingindo o cabo do machado) -> "faixas": [51], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:51"
  - 2ª opção (contra-atacar rápido na junta da armadura) -> "faixas": [53], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:53"
  - 3ª opção (largar a espada e o escudo no chão parado) -> "faixas": [66], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:66"

* SE ULTIMO_AUDIO = 42 (Cerco Final na Muralha):
  - 1ª opção (duelo direto de espadas para render o Duque) -> "faixas": [51], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:51"
  - 2ª opção (cortar a corda do contrapeso para abrir os portões) -> "faixas": [52], "novo_estado": "ETAPA:VITORIA | ULTIMO_AUDIO:52"
  - 3ª opção (virar de costas para o Duque durante o ataque) -> "faixas": [66], "novo_estado": "ETAPA:MORTE | ULTIMO_AUDIO:66"

Se o jogador estiver em uma cena de MORTE ou VITORIA e pedir para jogar novamente ou reiniciar, volte para "faixas": [1, 2] e "novo_estado": "ETAPA:SELECAO | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:2".
Se o jogador disser algo que não faz sentido com a cena atual, retorne "faixas": [54] e mantenha o mesmo "novo_estado".

Retorne APENAS um JSON válido neste formato:
{
  "ignorado": false,
  "acao_sistema": "NENHUMA",
  "transcricao": "o que a pessoa disse",
  "faixas": [72],
  "novo_estado": "ETAPA:FLORESTA | ESTILO:GUARDIAO | ROTA:MOINHO | ULTIMO_AUDIO:72"
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
