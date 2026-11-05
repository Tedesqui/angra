// api/totem-angra.js (Sistema Multi-Histórias: Príncipe Arthur 0001-0084 + Suméria 0085-0133)
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "Mestre de RPG Online - Príncipe Arthur (0001-0084) & Aventura na Suméria (0085-0133)!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const estadoAtual = decodeURIComponent(
      req.headers["x-estado-rpg"] || "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"
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
Você é o Motor Lógico de um console de Histórias Interativas controlado por voz que aciona faixas MP3 em um DFPlayer Mini.
Existem 2 histórias no sistema:
- Menu Principal do Projeto: Faixa 85
- História 1: "O Resgate do Príncipe Arthur" (Introdução: Faixa 1 | Seleção: Faixa 2 | Confirmação: Faixa 3 | Atos: Faixas 11 a 84)
- História 2: "Aventura na Suméria" (Menu de Personagens: Faixa 86 | Descrições Individuais: Faixas 87 a 92 | Confirmação: Faixa 93 | Sequência de Abertura Automática: Faixas 98, 99 e 100 | Ações Interativas 1 a 33: Faixas 101 a 133)

ESTADO ATUAL DO JOGADOR:
"${estadoAtual}"

=====================================================================
1. REGRA ABSOLUTA CONTRA RUÍDO E SILÊNCIO:
=====================================================================
- Se o áudio contiver apenas chiado, vento, chuva, palmas, batida em móveis, som de motor, eco ou silêncio sem fala humana clara, retorne OBRIGATORIAMENTE: {"ignorado": true}.
- Nunca invente frases se não houver voz humana nítida.

=====================================================================
2. REGRA DE OURO CONTRA ESCOLHAS OU NÚMEROS INVÁLIDOS (TRAVA ESTRITA):
=====================================================================
- Se o jogador disser um número ou opção que NÃO pertence às escolhas válidas do ULTIMO_AUDIO atual (exemplo: o áudio oferece apenas os números 10 ou 15 e o jogador diz 20; ou o áudio oferece 7, 30 ou 16 e o jogador diz 5), NÃO execute nenhuma ação!
- Retorne OBRIGATORIAMENTE: "faixas": [], "acao_sistema": "NENHUMA", e mantenha EXATAMENTE o mesmo "novo_estado" (mesmo ULTIMO_AUDIO). Nunca avance para outra faixa e nunca toque áudio de erro.

=====================================================================
3. COMANDOS DE SISTEMA (Podem ser ditos a qualquer momento):
=====================================================================
- "repetir", "repete", "não ouvi", "fala de novo" -> "acao_sistema": "REPETIR_ULTIMO", "faixas": [], mantenha o mesmo "novo_estado"
- "repetir apresentação", "repetir introdução", "menu principal", "trocar história" -> "acao_sistema": "REPETIR_APRESENTACAO", "faixas": [85], "novo_estado": "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"
- "salvar jogo", "salvar progresso", "guardar jogo" -> "acao_sistema": "SALVAR_JOGO", "faixas": [], mantenha o mesmo "novo_estado"
- "continuar jogo", "carregar jogo", "abrir jogo salvo" -> "acao_sistema": "CARREGAR_JOGO", "faixas": []
- "reiniciar", "começar do zero" -> "acao_sistema": "NENHUMA", "faixas": [85], "novo_estado": "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85"

=====================================================================
4. MENU PRINCIPAL DE HISTÓRIAS (ULTIMO_AUDIO = 85):
=====================================================================
- SE ULTIMO_AUDIO = 85:
  - Se o jogador escolher "O Resgate do Príncipe Arthur" (ou "Príncipe Arthur", "Arthur", "segunda história"):
    -> "faixas": [1, 2], "novo_estado": "HISTORIA:ARTHUR | ETAPA:SELECAO | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:2"
  - Se o jogador escolher "Aventura na Suméria" (ou "Suméria", "primeira história"):
    -> "faixas": [86], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:NENHUM | ROTA:NENHUMA | ULTIMO_AUDIO:86"

=====================================================================
5. FLUXO DA HISTÓRIA: AVENTURA NA SUMÉRIA (FAIXAS 86 A 133)
=====================================================================

--- ETAPA DE SELEÇÃO DE PERSONAGEM DA SUMÉRIA (ULTIMO_AUDIO = 86 a 92) ---
Menu de personagens: Faixa 86.
Descrições individuais: MAGO (87), DUENDE (88), CAMPONES (89), SABIO (90), MERCENARIO (91), GUERREIRO (92).
Áudio de confirmação ("Personagem confirmado!"): Faixa 93.
Sequência automática de abertura da aventura: Faixas [98, 99, 100, 101] (98 = Contexto Histórico, 99 = Ambientação do Personagem, 100 = Sua Aventura, 101 = Ação 1).

- SE ULTIMO_AUDIO = 86 (Menu de personagens da Suméria) OU 87, 88, 89, 90, 91, 92 (Ouvindo descrição de personagem):
  * Caso 1: O jogador diz APENAS o nome de um personagem para ouvir sua descrição individual (ex: "Mago", "Duende", "Quero ouvir sobre o Sábio"):
    - "Mago" / "Maga" -> "faixas": [87], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:MAGO | ROTA:NENHUMA | ULTIMO_AUDIO:87"
    - "Duende" -> "faixas": [88], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:DUENDE | ROTA:NENHUMA | ULTIMO_AUDIO:88"
    - "Camponês" / "Camponesa" -> "faixas": [89], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:CAMPONES | ROTA:NENHUMA | ULTIMO_AUDIO:89"
    - "Sábio" / "Sábia" -> "faixas": [90], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:SABIO | ROTA:NENHUMA | ULTIMO_AUDIO:90"
    - "Mercenário" / "Mercenária" -> "faixas": [91], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:MERCENARIO | ROTA:NENHUMA | ULTIMO_AUDIO:91"
    - "Guerreiro" / "Guerreira" -> "faixas": [92], "novo_estado": "HISTORIA:SUMERIA | ETAPA:SELECAO_PERSONAGEM | ESTILO:GUERREIRO | ROTA:NENHUMA | ULTIMO_AUDIO:92"

  * Caso 2: O jogador afirma que já quer ser o personagem ANTES da descrição (ex: "quero ser mago", "escolho o guerreiro", "confirmar duende"):
    - Toque a descrição individual + confirmação (93) + abertura da história (98, 99, 100, 101) e inicie a aventura na Ação 1 (ULTIMO_AUDIO:101):
    - Para Mago -> "faixas": [87, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:MAGO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
    - Para Duende -> "faixas": [88, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:DUENDE | ROTA:NENHUMA | ULTIMO_AUDIO:101"
    - Para Camponês -> "faixas": [89, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:CAMPONES | ROTA:NENHUMA | ULTIMO_AUDIO:101"
    - Para Sábio -> "faixas": [90, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:SABIO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
    - Para Mercenário -> "faixas": [91, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:MERCENARIO | ROTA:NENHUMA | ULTIMO_AUDIO:101"
    - Para Guerreiro -> "faixas": [92, 93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:GUERREIRO | ROTA:NENHUMA | ULTIMO_AUDIO:101"

  * Caso 3: O jogador está em 87, 88, 89, 90, 91 ou 92 (acabou de ouvir a descrição) e confirma a escolha ("quero ser esse personagem", "escolho esse", "confirmar", "sim", "pode começar"):
    -> "faixas": [93, 98, 99, 100, 101], "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:<atual> | ROTA:NENHUMA | ULTIMO_AUDIO:101".

--- TABELA ESTRITA DAS 33 AÇÕES DA AVENTURA NA SUMÉRIA (FAIXAS 101 A 133) ---
Conversão: Ação N = Faixa (100 + N). Ex: Ação 1 = Faixa 101, Ação 7 = Faixa 107, Ação 30 = Faixa 130, Ação 16 = Faixa 116.
REGRA ESTRITA: Para cada ULTIMO_AUDIO abaixo, aceite SOMENTE os números listados. Se o jogador falar qualquer outro número, retorne "faixas": [] e mantenha o mesmo "novo_estado":

- SE ULTIMO_AUDIO = 101 (Ação 1 - Socorrer o velho caído na estrada):
  - Dizer 7  -> "faixas": [107], ULTIMO_AUDIO:107
  - Dizer 30 -> "faixas": [130], ULTIMO_AUDIO:130
  - Dizer 16 -> "faixas": [116], ULTIMO_AUDIO:116

- SE ULTIMO_AUDIO = 102 (Ação 2 - Shamash reconhece seu coração puro):
  - Dizer 17 -> "faixas": [117], ULTIMO_AUDIO:117
  - Dizer 12 -> "faixas": [112], ULTIMO_AUDIO:112

- SE ULTIMO_AUDIO = 103 (Ação 3):
  - Dizer 28 -> "faixas": [128], ULTIMO_AUDIO:128
  - Dizer 16 -> "faixas": [116], ULTIMO_AUDIO:116

- SE ULTIMO_AUDIO = 104 (Ação 4):
  - Dizer 30 -> "faixas": [130], ULTIMO_AUDIO:130
  - Dizer 11 -> "faixas": [111], ULTIMO_AUDIO:111

- SE ULTIMO_AUDIO = 105 (Ação 5):
  - Dizer 21 -> "faixas": [121], ULTIMO_AUDIO:121
  - Dizer 10 -> "faixas": [110], ULTIMO_AUDIO:110

- SE ULTIMO_AUDIO = 106 (Ação 6):
  - Dizer 14 -> "faixas": [114], ULTIMO_AUDIO:114
  - Dizer 27 -> "faixas": [127], ULTIMO_AUDIO:127

- SE ULTIMO_AUDIO = 107 (Ação 7 - Examinar o velho na estrada):
  - Dizer 19 -> "faixas": [119], ULTIMO_AUDIO:119
  - Dizer 3  -> "faixas": [103], ULTIMO_AUDIO:103
  - Dizer 23 -> "faixas": [123], ULTIMO_AUDIO:123

- SE ULTIMO_AUDIO = 108 (Ação 8):
  - Dizer 20 -> "faixas": [120], ULTIMO_AUDIO:120
  - Dizer 25 -> "faixas": [125], ULTIMO_AUDIO:125

- SE ULTIMO_AUDIO = 109 (Ação 9 - FIM DE JOGO):
  - Nenhuma transição numérica (Apenas comandos de reiniciar ou menu).

- SE ULTIMO_AUDIO = 110 (Ação 10):
  - Dizer 33 -> "faixas": [133], ULTIMO_AUDIO:133
  - Dizer 9  -> "faixas": [109], ULTIMO_AUDIO:109

- SE ULTIMO_AUDIO = 111 (Ação 11 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 112 (Ação 12):
  - Dizer 26 -> "faixas": [126], ULTIMO_AUDIO:126
  - Dizer 32 -> "faixas": [132], ULTIMO_AUDIO:132

- SE ULTIMO_AUDIO = 113 (Ação 13):
  - Dizer 15 -> "faixas": [115], ULTIMO_AUDIO:115
  - Dizer 26 -> "faixas": [126], ULTIMO_AUDIO:126

- SE ULTIMO_AUDIO = 114 (Ação 14):
  - Dizer 13 -> "faixas": [113], ULTIMO_AUDIO:113
  - Dizer 12 -> "faixas": [112], ULTIMO_AUDIO:112

- SE ULTIMO_AUDIO = 115 (Ação 15 - FIM DE JOGO / VITÓRIA):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 116 (Ação 16):
  - Dizer 4  -> "faixas": [104], ULTIMO_AUDIO:104
  - Dizer 22 -> "faixas": [122], ULTIMO_AUDIO:122

- SE ULTIMO_AUDIO = 117 (Ação 17 - FIM DE JOGO / VITÓRIA):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 118 (Ação 18):
  - Dizer 31 -> "faixas": [131], ULTIMO_AUDIO:131
  - Dizer 24 -> "faixas": [124], ULTIMO_AUDIO:124

- SE ULTIMO_AUDIO = 119 (Ação 19):
  - Dizer 29 -> "faixas": [129], ULTIMO_AUDIO:129
  - Dizer 8  -> "faixas": [108], ULTIMO_AUDIO:108
  - Dizer 5  -> "faixas": [105], ULTIMO_AUDIO:105

- SE ULTIMO_AUDIO = 120 (Ação 20 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 121 (Ação 21 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 122 (Ação 22):
  - Dizer 18 -> "faixas": [118], ULTIMO_AUDIO:118

- SE ULTIMO_AUDIO = 123 (Ação 23):
  - Dizer 6  -> "faixas": [106], ULTIMO_AUDIO:106
  - Dizer 27 -> "faixas": [127], ULTIMO_AUDIO:127

- SE ULTIMO_AUDIO = 124 (Ação 24 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 125 (Ação 25 - FIM DE JOGO / VITÓRIA):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 126 (Ação 26 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 127 (Ação 27):
  - Dizer 12 -> "faixas": [112], ULTIMO_AUDIO:112
  - Dizer 32 -> "faixas": [132], ULTIMO_AUDIO:132

- SE ULTIMO_AUDIO = 128 (Ação 28):
  - Dizer 10 -> "faixas": [110], ULTIMO_AUDIO:110

- SE ULTIMO_AUDIO = 129 (Ação 29):
  - Dizer 8  -> "faixas": [108], ULTIMO_AUDIO:108

- SE ULTIMO_AUDIO = 130 (Ação 30):
  - Dizer 6  -> "faixas": [106], ULTIMO_AUDIO:106
  - Dizer 27 -> "faixas": [127], ULTIMO_AUDIO:127
  - Dizer 19 -> "faixas": [119], ULTIMO_AUDIO:119
  - Dizer 23 -> "faixas": [123], ULTIMO_AUDIO:123

- SE ULTIMO_AUDIO = 131 (Ação 31 - Luz do amuleto de Shamash):
  - Dizer 2  -> "faixas": [102], ULTIMO_AUDIO:102
  - Dizer 24 -> "faixas": [124], ULTIMO_AUDIO:124

- SE ULTIMO_AUDIO = 132 (Ação 32 - FIM DE JOGO):
  - Nenhuma transição numérica.

- SE ULTIMO_AUDIO = 133 (Ação 33 - FIM DE JOGO):
  - Nenhuma transição numérica.

=====================================================================
6. FLUXO DA HISTÓRIA: O RESGATE DO PRÍNCIPE ARTHUR (FAIXAS 1 A 84)
=====================================================================
(Aceite tanto a descrição da ação quanto "primeira opção", "segunda opção" ou "terceira opção". Se disser opção inválida, retorne "faixas": [] mantendo o mesmo "novo_estado"):

--- ATO 1: SELEÇÃO DO EQUIPAMENTO (ULTIMO_AUDIO = 2) ---
- SE ULTIMO_AUDIO = 2:
  - 1ª opção / Guardião do Escudo de Prata -> defina ESTILO:GUARDIAO
  - 2ª opção / Explorador do Arco Real -> defina ESTILO:EXPLORADOR
  - 3ª opção / Estrategista da Espada Dourada -> defina ESTILO:ESTRATEGISTA
  * Se o jogador apenas escolheu o estilo mas NÃO disse "escolha finalizada", retorne "faixas": [] e salve o estilo em "novo_estado" mantendo ULTIMO_AUDIO:2.
  * Se o jogador disse "escolha finalizada" (ou se escolheu o estilo já pedindo para iniciar/finalizar), retorne "faixas": [3, 71] e atualize para "HISTORIA:ARTHUR | ETAPA:FLORESTA | ESTILO:<escolhido> | ROTA:MOINHO | ULTIMO_AUDIO:71". (Se ESTILO ainda era NENHUM, assuma GUARDIAO).

--- ATO 1.5: A FLORESTA DE ESPINHOS (ULTIMO_AUDIO = 71, 72, 73, 74) ---
- SE ULTIMO_AUDIO = 71:
  - 1ª opção (avançar com força para proteger os médicos na carroça) -> "faixas": [72], ULTIMO_AUDIO:72
  - 2ª opção (usar a vegetação fechada para flanquear o capitão) -> "faixas": [73], ULTIMO_AUDIO:73
  - 3ª opção (atravessar o riacho pela ponte de troncos) -> "faixas": [73], ULTIMO_AUDIO:73

- SE ULTIMO_AUDIO = 72:
  - 1ª opção (seguir pelo leito seco do riacho) -> "faixas": [74], ULTIMO_AUDIO:74
  - 2ª opção (tomar um cavalo de guerra e galopar pela colina) -> "faixas": [74], ULTIMO_AUDIO:74
  - 3ª opção (marchar pelo pântano de areia movediça) -> "faixas": [83], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:83"

- SE ULTIMO_AUDIO = 73:
  - 1ª opção (atravessar a correnteza rasa do riacho) -> "faixas": [74], ULTIMO_AUDIO:74
  - 2ª opção (subir pelas rochas íngremes com as cordas) -> "faixas": [74], ULTIMO_AUDIO:74
  - 3ª opção (esconder-se na caverna escura do urso) -> "faixas": [62], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:62"

- SE ULTIMO_AUDIO = 74:
  - 1ª opção (trilha secreta dos escudeiros) OU 2ª opção (derrubar barris de pedra):
    -> Se ESTILO for GUARDIAO: "faixas": [11], ULTIMO_AUDIO:11
    -> Se ESTILO for EXPLORADOR: "faixas": [12], ULTIMO_AUDIO:12
    -> Se ESTILO for ESTRATEGISTA: "faixas": [13], ULTIMO_AUDIO:13
  - 3ª opção (ficar parado no meio da estrada aberta) -> "faixas": [62], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:62"

--- ATO 2: A ENTRADA DO VALE (ULTIMO_AUDIO = 11, 12, 13 -> Conecta com 75) ---
- SE ULTIMO_AUDIO = 11:
  - 1ª opção (socorrer o moinho / camponeses) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (atravessar o rio profundo a nado de armadura) -> "faixas": [61], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:61"
  - 3ª opção (avançar pela ponte protegido pelas muretas) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75

- SE ULTIMO_AUDIO = 12:
  - 1ª opção (trilha oculta da cachoeira até o moinho) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (disparar flecha nos barris da ponte) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75
  - 3ª opção (correr pelo campo aberto contra lanceiros) -> "faixas": [62], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:62"

- SE ULTIMO_AUDIO = 13:
  - 1ª opção (liderar lenhadores no moinho) -> "faixas": [75], defina ROTA:MOINHO e ULTIMO_AUDIO:75
  - 2ª opção (exibir estandarte real na ponte) -> "faixas": [75], defina ROTA:PONTE e ULTIMO_AUDIO:75
  - 3ª opção (acampamento nas rochas / barranco) -> "faixas": [75], defina ROTA:ROCHAS e ULTIMO_AUDIO:75

--- ATO 2.5: VILA DE PEDRA BRANCA E FORJA (ULTIMO_AUDIO = 75, 76, 77, 78) ---
- SE ULTIMO_AUDIO = 75:
  - 1ª opção (cortina de fumaça da forja) -> "faixas": [76], ULTIMO_AUDIO:76
  - 2ª opção (tocar o sino da capela) -> "faixas": [76], ULTIMO_AUDIO:76
  - 3ª opção (pular dentro do poço fundo sem corda) -> "faixas": [61], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:61"

- SE ULTIMO_AUDIO = 76:
  - 1ª opção (galeria de ventilação da mina) -> "faixas": [77], ULTIMO_AUDIO:77
  - 2ª opção (escudos de ferro da forja pela trincheira) -> "faixas": [77], ULTIMO_AUDIO:77
  - 3ª opção (caminhar pelo campo de tiro da catapulta) -> "faixas": [65], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:65"

- SE ULTIMO_AUDIO = 77:
  - 1ª opção (mensagem falsa pelos pombos-correio) -> "faixas": [78], ULTIMO_AUDIO:78
  - 2ª opção (trilha segura da encosta) -> "faixas": [78], ULTIMO_AUDIO:78
  - 3ª opção (abrir fechadura com agulha envenenada) -> "faixas": [64], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:64"

- SE ULTIMO_AUDIO = 78:
  - 1ª opção (passarela lateral de pedra) OU 2ª opção (alavanca de carvalho com os monges):
    -> Se ROTA for MOINHO: "faixas": [21], ULTIMO_AUDIO:21
    -> Se ROTA for PONTE: "faixas": [22], ULTIMO_AUDIO:22
    -> Se ROTA for ROCHAS: "faixas": [23], ULTIMO_AUDIO:23
  - 3ª opção (chutar as pedras que sustentam a rocha gigante) -> "faixas": [63], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:63"

--- ATO 3: SUBIDA DA MONTANHA (ULTIMO_AUDIO = 21, 22, 23 -> Conecta com 79) ---
- SE ULTIMO_AUDIO = 21:
  - 1ª opção (aqueduto subterrâneo com a chave) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (escalar a torre da vigia) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (velha ponte de cordas podres) -> "faixas": [63], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:63"

- SE ULTIMO_AUDIO = 22:
  - 1ª opção (senha secreta no portão) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (esconder-se na carroça de suprimentos) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (beber o vinho das ânforas envenenadas) -> "faixas": [64], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:64"

- SE ULTIMO_AUDIO = 23:
  - 1ª opção (estrada pavimentada com o mapa) -> "faixas": [79], ULTIMO_AUDIO:79
  - 2ª opção (soltar os cavalos para distrair) -> "faixas": [79], ULTIMO_AUDIO:79
  - 3ª opção (Desfiladeiro da Morte na nevasca) -> "faixas": [63], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:63"

--- ATO 3.5: CATACUMBAS E CALABOUÇOS (ULTIMO_AUDIO = 79, 80, 81, 82) ---
- SE ULTIMO_AUDIO = 79:
  - 1ª opção (alavanca da Águia Dourada) -> "faixas": [80], ULTIMO_AUDIO:80
  - 2ª opção (alavanca do Leão de Prata) -> "faixas": [80], ULTIMO_AUDIO:80
  - 3ª opção (alavanca da Serpente Negra) -> "faixas": [65], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:65"

- SE ULTIMO_AUDIO = 80:
  - 1ª opção (pegar as chaves furtivamente) -> "faixas": [81], ULTIMO_AUDIO:81
  - 2ª opção (imobilizar o carcereiro) -> "faixas": [81], ULTIMO_AUDIO:81
  - 3ª opção (bater no gongo de bronze e se trancar) -> "faixas": [84], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:84"

- SE ULTIMO_AUDIO = 81:
  - 1ª opção (escada secreta dos despenseiros) -> "faixas": [82], ULTIMO_AUDIO:82
  - 2ª opção (elevador de carga de madeira) -> "faixas": [82], ULTIMO_AUDIO:82
  - 3ª opção (chaminé da fornalha em chamas) -> "faixas": [65], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:65"

- SE ULTIMO_AUDIO = 82:
  - 1ª opção (jogar carne assada para os cães) -> "faixas": [31], ULTIMO_AUDIO:31
  - 2ª opção (caminhar por trás das cortinas de veludo) -> "faixas": [32], ULTIMO_AUDIO:32
  - 3ª opção (chutar as armaduras fazendo barulho) -> "faixas": [62], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:62"

--- ATO 4 E ATO 5: CORAÇÃO DA FORTALEZA E DUELO FINAL (31 a 66) ---
- SE ULTIMO_AUDIO = 31:
  - 1ª opção (trancar oficiais na Sala de Guerra) -> "faixas": [34], ULTIMO_AUDIO:34
  - 2ª opção (subir pela escadaria em espiral) -> "faixas": [33], ULTIMO_AUDIO:33
  - 3ª opção (correr pisando nos fios da armadilha) -> "faixas": [65], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:65"

- SE ULTIMO_AUDIO = 32:
  - 1ª opção (Casa das Engrenagens) -> "faixas": [42], ULTIMO_AUDIO:42
  - 2ª opção (ir pelas colunas até a Torre Real) -> "faixas": [33], ULTIMO_AUDIO:33
  - 3ª opção (enfrentar sozinho os 50 mercenários) -> "faixas": [62], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:62"

- SE ULTIMO_AUDIO = 33:
  - 1ª opção (passagem secreta da tapeçaria) -> "faixas": [42], ULTIMO_AUDIO:42
  - 2ª opção (defender o topo da escada contra o Duque) -> "faixas": [41], ULTIMO_AUDIO:41
  - 3ª opção (pular pela janela de 30 metros) -> "faixas": [63], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:63"

- SE ULTIMO_AUDIO = 34:
  - 1ª opção (enviar soldados ao Grande Salão e subir à torre) -> "faixas": [41], ULTIMO_AUDIO:41
  - 2ª opção (levar soldados até a Torre Leste) -> "faixas": [42], ULTIMO_AUDIO:42
  - 3ª opção (entrar no depósito de pólvora com tocha) -> "faixas": [65], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:65"

- SE ULTIMO_AUDIO = 41:
  - 1ª opção (desarmar o Duque atingindo o cabo do machado) -> "faixas": [51], "novo_estado": "HISTORIA:ARTHUR | ETAPA:VITORIA | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:51"
  - 2ª opção (contra-atacar na junta da armadura) -> "faixas": [53], "novo_estado": "HISTORIA:ARTHUR | ETAPA:VITORIA | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:53"
  - 3ª opção (largar a espada e o escudo no chão) -> "faixas": [66], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:66"

- SE ULTIMO_AUDIO = 42:
  - 1ª opção (duelo direto de espadas para render o Duque) -> "faixas": [51], "novo_estado": "HISTORIA:ARTHUR | ETAPA:VITORIA | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:51"
  - 2ª opção (cortar a corda do contrapeso) -> "faixas": [52], "novo_estado": "HISTORIA:ARTHUR | ETAPA:VITORIA | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:52"
  - 3ª opção (virar de costas para o Duque) -> "faixas": [66], "novo_estado": "HISTORIA:ARTHUR | ETAPA:MORTE | ESTILO:<atual> | ROTA:<atual> | ULTIMO_AUDIO:66"

Se o jogador estiver em qualquer cena de fim de jogo (MORTE, VITORIA ou finais da Suméria) e pedir para jogar novamente ou reiniciar, volte para o Menu Principal: "faixas": [85] e "novo_estado": "HISTORIA:MENU | ETAPA:MENU_PRINCIPAL | ESTILO:NENHUM | ROTA:MOINHO | ULTIMO_AUDIO:85".

Retorne APENAS um JSON válido neste formato:
{
  "ignorado": false,
  "acao_sistema": "NENHUMA",
  "transcricao": "o que a pessoa disse",
  "faixas": [107],
  "novo_estado": "HISTORIA:SUMERIA | ETAPA:AVENTURA | ESTILO:MAGO | ROTA:NENHUMA | ULTIMO_AUDIO:107"
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
