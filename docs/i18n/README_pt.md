<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ajude crianças não-verbais a se comunicarem.**

Aplicativo de Comunicação Aumentativa e Alternativa para crianças com deficiências motoras e necessidades complexas de comunicação. Toque em imagens, construa frases, ouça-as serem faladas em voz alta — em 23 idiomas. Funciona em qualquer tablet, laptop, iPhone, iPad e Apple Watch.

Parte da [plataforma Synalux](https://synalux.ai).

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · **Português** · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Experimente Grátis"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Planos"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacidade"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Termos"></a>
</p>

![Tela principal do Prism AAC — barra de ferramentas, banner de agenda, barra de digitação, blocos de previsão e teclado qwerty](../../docs/screenshots/app-hero.png)

### Aplicativos Nativos

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC no iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC no iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC no Apple Watch Ultra" width="120" />
</p>

| Plataforma | Status | IA no Dispositivo | Notas |
|----------|--------|-------------|-------|
| **Web** (PWA) | Produção | Baixa automaticamente o melhor modelo local | Qualquer navegador, instalável |
| **iPad Pro 16GB** | Produção | IA no dispositivo (14B) | Rápido, privado, selecionado automaticamente pela RAM |
| **iPhone / iPad 8GB** | Produção | IA no dispositivo (8B → 1.7B fallback) | Reduz automaticamente para caber no dispositivo |
| **iPhone / iPad <8GB** | Produção | IA no dispositivo (1.7B) | Sempre cabe, 1.1 GB |
| **Apple Watch** | Produção | Dicionário de frases offline (1.261 × 20 idiomas) | Autônomo — pictogramas, TTS, emergência |
| **Extensão do Chrome** | Produção | — | Assistente de leitura em qualquer campo de texto |
| **WiFi para Mac** | Produção | 14B/32B via Ollama | Ajustes → IA Local → insira o IP do Mac |

---

## Vídeo de Prévia da App Store

Vídeo de 30 segundos apresentando todos os principais recursos com narração TTS da Inworld:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Cena | Recurso | Captura de Tela |
|---|---|---|
| **Início** — tocar frases | Painel de pictogramas com 22 categorias, botão Falar | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorias** | Frases rápidas para Ajuda, Comida, Lugares, Sentimentos | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat com IA** | Componha mensagens, pratique conversas | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerta de Emergência** | Chamada de cuidador/enfermeiro com um toque | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Agenda** | Rotinas diárias visuais — manhã, escola, almoço, hora de dormir | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jogos** | Estoura Bolhas, Caça Cores, Combine, Sim/Não, Complete | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matemática e Escola** | Matemática adaptativa com Dica, Verificar, Resolver + teclado numérico | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Rastreamento de Cabeça e Olhos** | Cursor de permanência baseado em câmera, controle de olhar, calibração | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Idiomas** | Inglês, Espanhol, Francês, Russo, Japonês, Coreano, Chinês, Árabe e mais | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Visão Geral

| Módulo | O que faz | Prévia |
|---|---|---|
| 📂 **Categorias** | Blocos de imagem estilo PECS para não-leitores | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Digitar e falar** | Teclado + previsão de palavras + voz neural | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat com IA** | Assistente no dispositivo + na nuvem ajustado para usuários de CAA | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat CAA** | Mensagens recebidas de cuidadores + contatos | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matemática + matérias** | Tela em grade de células com tutor ciente do domínio | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Agenda** | Rotinas visuais "primeiro-depois" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jogos** | 12 jogos terapêuticos de CAA | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Loja** | Pacotes de voz, pacotes de vocabulário, pacotes de jogos | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Reprodutor de Conforto** | Reprodutor de mídia para pacientes hospitalares | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Modo Leito** | Chat com IA em tela cheia para uso com telefone em suporte / deitado | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **Mãos Livres** | Reconhecimento de gestos de cabeça + mão | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Ajustes** | 23 idiomas, acomodações motoras, nível do plano | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## Alternativa Gratuita ao Read & Write

O PrismAAC oferece todos os recursos de assistente de leitura pelos quais a maioria dos usuários de CAA compra o Read & Write — gratuitamente, no navegador, sem necessidade de conta para o nível web. Consulte [Digitar e falar](#%EF%B8%8F-type--speak) para fala no final da frase + destaque de palavras, [Leitor de PDF](#-pdf-reader) e [Leitor de Captura de Tela (OCR)](#-screenshot-reader-ocr) para documentos, e a [extensão do Chrome](#-chrome-extension--same-reading-assistant-features-in-any-text-field) para cobertura entre aplicativos no Gmail / Docs / Word Online / em qualquer outro lugar.

## Como o PrismAAC se compara

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Caminho de fala **no dispositivo + seguro para HIPAA** | ✅ | ❌ | ❌ | ❌ | parcial | parcial | ❌ | ❌ | parcial |
| **Classificação de frases por usuário** (adapta-se a cada criança) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Correções do cuidador **tornam-se dados de treinamento automaticamente** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tutor de IA ciente do domínio** (matemática + 10 outras matérias) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tela de matemática em grade de células** (sem LaTeX, sem quadro branco) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Histórico ciente de localidade + região** (mais de 280 regiões) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modo de gestos de cabeça + mão **mãos livres** | ✅ | parcial | parcial | ❌ | ✅ | parcial | parcial | ✅ | ✅ |
| **Chat com IA mãos livres** (loop de voz + palavra de ativação + sobreposição de leito) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jogos de CAA** terapêuticos integrados | ✅ (12) | ❌ | ❌ | ❌ | ❌ | parcial | parcial | ❌ | ❌ |
| **Código aberto** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Nível gratuito** para acesso de segurança de vida | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Loja** de pacotes de voz | ✅ | ❌ | parcial | ❌ | parcial | ❌ | ❌ | parcial | parcial |
| **Multi-idioma** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notas do cuidador** que acompanham casa / escola / clínica | ✅ | ❌ | ❌ | ❌ | parcial | parcial | parcial | ❌ | parcial |
| Modo autônomo do **Apple Watch** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assistente de leitura da **extensão do Chrome** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> A comparação reflete informações de produtos disponíveis publicamente a partir de 2026-05. O PrismAAC está em desenvolvimento ativo; os concorrentes podem adicionar recursos ao longo do tempo. Pull Requests são bem-vindos para manter esta informação honesta — consulte `CONTRIBUTING.md`.
>
> Grid 3 e Tobii Dynavox possuem fortes integrações de hardware de rastreamento ocular + varredura por chave não refletidas acima (dependentes de hardware, configurações de clínicas especializadas).

---

## iOS e Apple Watch

### iPhone / iPad

Aplicativo Swift nativo que encapsula a interface web em WKWebView + IA no dispositivo via llama.cpp Metal. Seleciona automaticamente o melhor modelo pela RAM do dispositivo:

| Dispositivo | RAM | Modelo | Download |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | 8.4 GB do CDN da HF |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (fallback OOM) | 4.7 GB / 1.1 GB |
| iPhone 12-14, iPads mais antigos | <8 GB | 1.7B Q4_K_M | 1.1 GB |

Segurança em três camadas: filtro de crise síncrono → IA no dispositivo → fallback na nuvem. O controle ciente da memória degrada-se graciosamente: IA completa → IA na nuvem → apenas núcleo → modo de emergência.

- Inset de área segura para Dynamic Island / notch
- Ponte WCSession para despacho de emergência do Apple Watch
- Tokens de autenticação suportados por Keychain
- Fallback OOM: se o modelo maior não couber, carrega automaticamente o próximo menor

**Ajustes → 🤖 Modelos de IA Local** — baixe e gerencie modelos Prism:
- Detecta Ollama automaticamente em `localhost:11434`
- Conexões WiFi: iPad/iPhone → Mac Ollama (14B/32B com precisão total)
- Download por modelo com barra de progresso em tempo real
- Modelos: `:1b7` (1.1 GB) · `:8b` (4.7 GB) · `:14b` (8.4 GB) · `:32b` (16 GB)

### Apple Watch (autônomo)

Funciona sem iPhone — autônomo com dicionário de frases offline.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Tradução offline:** 1.261 frases × 20 idiomas empacotados (411 KB JSON) — consulta instantânea, 100% precisa, sem rede
- Grade de pictogramas de 2 colunas com imagens ARASAAC
- Chat com IA com ditado + entrada de teclado (nuvem quando online, dicionário de frases quando offline)
- Sistema de emergência: contagem regressiva → WCSession → fallback celular → TTS
- Tradução com saída TTS (dicionário offline primeiro, fallback na nuvem)
- Caixa de entrada: receba e responda a mensagens de cuidadores
- Fixação de certificado (SPKI SHA-256) no despacho de emergência
- NFKC + sanitização de injeção de 23 tokens em todos os caminhos de IA

---

## Módulos

### 📂 Categorias
Blocos de imagem estilo PECS. Toque em uma categoria, toque em um bloco, ouça a palavra, veja-a aparecer na barra de mensagens. Funciona para não-leitores, pré-leitores e comunicadores emergentes. Os conjuntos de blocos e a ordem se personalizam ao longo do tempo via ativação de propagação — os blocos que seu filho mais toca sobem; os não utilizados por meses desaparecem.

**Layout envolvente** — as categorias aparecem em uma coluna esquerda rolável ao lado do teclado, para que o usuário de CAA possa tocar nos blocos de imagem E digitar simultaneamente sem trocar de modo. A barra de previsão permanece visível; ambas as entradas estão sempre acessíveis.

![Categorias no modo envolvente — cartões de categoria roláveis à esquerda, teclado completo à direita](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- 22 categorias padrão: pessoas, comida, sentimentos, corpo, roupas, animais, lugares, etc.
- O cuidador pode adicionar / remover / reordenar blocos por criança
- Cada bloco possui uma `textKey` para i18n — mudar o idioma do aplicativo re-rotula cada bloco com um toque
- Os pictogramas dos blocos vêm do ARASAAC + um conjunto curado; a clonagem de voz permite que você combine a voz do bloco com a dos irmãos ou pais da criança (nível pago)
- Aprendizagem de n-gramas por usuário: uma criança que toca "Eu quero comer" três vezes vê "comer" subir depois de "quero" na próxima sessão
- Memória holográfica HRR: previsões contextuais sem busca em ~0.2ms via Rust WASM — +27% de precisão Top-1 em frases CAA essenciais

**Caminho de renderização:** `components/CategoryPanel.tsx` → `useCategoryStore` → blocos desenhados de `constants/phrases.ts` (sistema) + substituições por usuário do Supabase (pagas). Toques nos blocos invocam `messageStore.appendText(phrase)` e são roteados através de `aacSpeak()` para TTS.
</details>

---

### ⌨️ Digitar e falar
Teclado na tela com **previsão de palavras**, **autocompletar por IA** e um botão **Falar** de um toque que lê a barra de mensagens em voz alta com uma voz neural natural. A digitação ensina o motor de previsão: as palavras que seu filho mais digita aparecem mais cedo na próxima sessão.

![Teclado do Prism AAC com "olá" digitado, blocos de previsão e botão Falar](../../docs/screenshots/keyboard-typing.png)

**Recursos de assistente de leitura (paridade com Read & Write)** — para usuários com necessidades de leitura / memória / cognitivas:

- **Falar por palavra** — cada palavra é ecoada via TTS no momento em que você toca na barra de espaço, para que você ouça o que digitou sem esperar pela frase completa.
- **Falar a frase em `.?!`** — terminar uma frase com um ponto final, ponto de interrogação ou ponto de exclamação lê a frase inteira de volta para que você não perca o controle do que escreveu (a lacuna que desqualifica o NVDA para usuários videntes com deficiências cognitivas). Ative via Ajustes → `speakOnSentenceEnd` (ativado por padrão).
- **Destaque palavra por palavra durante a fala** — cada palavra falada acende com um fundo amarelo enquanto o TTS a lê. Usuários videntes com deficiências de leitura podem acompanhar visualmente; o destaque acompanha o áudio sem a necessidade de um dispositivo de hardware especial.

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- 5 slots de previsão acima do qwerty, atualizados a cada tecla digitada
- Conclusão por IA ("hw" → "how", "togoso" → "to go so") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms em média, 4.3× mais barato que 2.5 Flash)
- Barreira entre idiomas: RO `eu` não vazará para a barra EN mesmo quando ambos os corpora estiverem carregados (comparação de frequência entre corpora)
- "Falar" lê com adaptação automática de tom (declarativo / interrogativo / exclamativo inferido da pontuação)
- Nível de voz 1: Inworld TTS-2 (natural/neural, todos os 23 idiomas do aplicativo); nível 2: OS Web Speech (offline, nativo do dispositivo); nível 3: WASM espeak-ng (último recurso)
- O destaque de palavras é estimado por duração (~60 ms/caractere @ taxa=0.5, escala com o controle deslizante de taxa) — funciona em todos os níveis de TTS sem alterações de backend; a sincronização precisa via Azure `wordBoundary` é um recurso Pro futuro.
- Corpus de n-gramas SQLite de 1.5MB por idioma; unigramas + bigramas + trigramas; carregado sob demanda na troca de idioma
- **Memória contextual HRR** — recuperação holográfica sem busca (229KB Rust WASM) que aprende com cada frase falada. Codifica bigramas + trigramas em um vetor holográfico; sonda em ~0.2ms a cada tecla digitada. Camada aditiva — impulsiona os 2 primeiros blocos de previsão com correspondências contextuais sem remover as previsões do corpus.

**Benchmark de previsão HRR** (54 testes unitários + suíte de precisão de 10 cenários):

| Cenário | Linha de Base Top-1 | HRR+ Top-1 | Ganho | Linha de Base MRR | HRR+ MRR | Ganho MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Frases CAA essenciais (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Frases CAA essenciais (5x diárias) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Vocabulário pessoal | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| Misto (todas as frases) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| Recuperação entre sessões | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| Prefixos ambíguos | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = palavra correta é o bloco #1. Top-5 = palavra correta em qualquer bloco. MRR = Mean Reciprocal Rank (quanto maior = palavra correta aparece mais cedo). HRR nunca reduz a precisão Top-5 em nenhum cenário — zero regressões. Maiores ganhos em vocabulário pessoal (+9.2% MRR) e frases CAA essenciais (+27.3% Top-1).

**Caminho de renderização:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recência × frequência × impulso de n-gramas) + sobreposição de IA opcional `services/textCorrectService.ts` + sonda de bigrama/trigrama HRR `services/hrrContext.ts`. Destaque: `services/aacSpeak.ts` emite eventos `tts-highlight-start` no `ttsHighlightBus`; `components/MessageBar.tsx` se inscreve e passa `activeWordIndex` para `ColoredText`.
</details>

---

### ✨ Chat com IA
Assistente no dispositivo + na nuvem ajustado para a voz do usuário de CAA. Respostas transmitidas, cada linha pode ser tocada para inserir na barra de mensagens para que a autoria permaneça com a criança. O nível gratuito funciona via Gemini 2.5 Flash; os níveis pagos são roteados para Claude Sonnet 4 com a frota prism-coder para consultas curtas.

**Modo IA Limpo** — a barra de previsão de palavras se oculta automaticamente quando o Chat com IA está aberto (as previsões são irrelevantes ao compor uma pergunta), mantendo o foco na resposta da IA e no botão de envio.

**Chat com IA Mãos Livres** — ative o botão 🔁 no cabeçalho do chat para entrar em um loop de voz contínuo: o microfone abre automaticamente após cada resposta da IA, para que a criança possa manter uma conversa completa sem tocar na tela. Uma barra de status abaixo do cabeçalho do chat confirma que o modo está ativado.

**Modo de Tradução** — quando o idioma do aplicativo e o idioma de saída diferem (por exemplo, entrada em Português, saída em Inglês), cada troca de IA é automaticamente roteada através do caminho de tradução com streaming habilitado, para que não haja penalidade de velocidade em comparação com o modo monolíngue.

![Painel de Chat com IA — barra de previsão oculta no modo IA, teclado completo acessível abaixo](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Painel inline ancorado acima do teclado — nunca um modal que oculta a barra de mensagens
- Entrada de voz via API Web Speech; botão do microfone mostra transcrição provisória em tempo real
- Toque em qualquer linha da IA para copiá-la para a barra de mensagens (preserva a autoria — Valencia et al., CHI 2023)
- **Loop mãos livres** — botão 🔁 no cabeçalho; reinicia automaticamente o microfone 1 s após cada resposta da IA terminar; `aria-pressed` + fundo verde confirmam o estado; barra de status abaixo do cabeçalho enquanto ativo
- **Palavra de ativação "Hey Prism"** — disponível dentro da sobreposição do Modo Leito; sessão contínua de `SpeechRecognition` detecta a frase e aciona o microfone; não disponível quando a ponte nativa do iOS possui a sessão de áudio
- Tempo limite rígido de 15s no lado do cliente + botão Tentar Novamente (para que o painel não fique preso em "Pensando…" se a rede cair)
- 401 / rede / tempo limite / outros → mapeamento de erro amigável; nunca mostra "Sessão expirada" bruto
- Fallback Ollama local (`prism-coder:1b7`) quando offline; conteúdo misto bloqueado da origem do navegador `synalux.ai` na prática, então o erro amigável é acionado

**Caminho de renderização:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (ou `translateAI()` no modo de tradução) → stream SSE de Synalux `/api/v1/chat` com `credentials: 'include'`. CORS permite `synalux.ai` + origens de desenvolvimento localhost.
</details>

---

### 🛏 Modo Leito

> **Recurso de acessibilidade crítico.** O Modo Leito existe porque alguns usuários não têm uma maneira confiável de falar, digitar ou tocar em uma tela. O design deve funcionar primeiro para o caso mais difícil: um paciente deitado em uma cama de UTI, com os braços ao lado do corpo, ventilado, incapaz de produzir qualquer som — comunicando-se apenas através do olhar ou de um único interruptor de hardware segurado entre dois dedos.

Sobreposição de comunicação com IA em tela cheia otimizada para usuários que não conseguem alcançar a tela ou falar de forma confiável. Cada alvo de toque é superdimensionado. A voz é um caminho de entrada entre vários — não o único. A interface é operável inteiramente através de tecnologia assistiva: varredura por chave, olhar, Controle por Voz do iOS, rastreamento de cabeça ou um teclado na tela navegado com um único interruptor.

Inspirado pelo feedback direto da comunidade CAA (r/AssistiveTechnology, maio de 2025) de usuários se comunicando de leitos hospitalares, recuperação pós-cirúrgica e ambientes de cuidados paliativos.

**Funciona em Mac / Windows?** Sim. O Modo Leito é um recurso de aplicativo web progressivo — ele funciona em qualquer navegador em qualquer dispositivo. Não é exclusivo do iOS.

---

#### Para quem é isso?

O Modo Leito é projetado para usuários em um amplo espectro de habilidades motoras e de fala. Os Cartões de Frases Rápidas (descritos abaixo) são especificamente projetados para usuários no extremo mais grave — aqueles que não conseguem falar de forma alguma e têm movimento das mãos muito limitado ou nenhum.

| Perfil do usuário | Método de entrada recomendado |
|---|---|
| Pode falar, braços restritos | Voz (🎙 botão do microfone) + loop Mãos Livres |
| Alguma vocalização, fala não confiável | Palavra de ativação "Hey Prism" + loop Mãos Livres |
| Sem fala, pode tocar na tela | Cartões de Frases Rápidas (um toque) |
| Sem fala, motor limitado — um interruptor | Varredura por Controle de Chave do iOS ou Acesso por Chave do Android sobre os Cartões de Frases Rápidas |
| Sem fala, sem movimento das mãos — dispositivo de rastreamento ocular | Hardware de rastreamento ocular (Tobii, EyeGaze Edge, etc.) se apresenta como um ponteiro de mouse — todos os cartões são navegáveis |
| Sem fala, pode mover a cabeça | Rastreamento de cabeça (por exemplo, Ponteiro de Cabeça do iOS, Controle de Câmera no iPhone 16) — os cartões são alvos de navegação em tamanho real |
| Traqueostomia / ventilado, sem vocalização | Cartões de Frases Rápidas via olhar ou interruptor + modo assistido por cuidador |

---

#### Suporte à plataforma

| Plataforma | Modo Leito | Cartões Rápidos | Loop Mãos Livres 🔁 | Palavra de Ativação 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (qualquer navegador) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Apenas Safari |
| Aplicativo nativo iOS (App Store) | ✅ | ✅ | ✅ | ❌ use Mãos Livres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispositivo de rastreamento ocular (qualquer — se apresenta como mouse) | ✅ | ✅ | ✅ | ✅ |
| Varredura por chave (Controle de Chave do iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Por que não há palavra de ativação no aplicativo nativo do iOS?** A ponte nativa assume a propriedade da sessão de áudio (`prismNativeBridge.startVoice`), o que entra em conflito com a API `SpeechRecognition` do navegador que o serviço de palavra de ativação usa. Use o **loop Mãos Livres** (🔁) em vez disso — ele reinicia o microfone automaticamente 1 segundo após cada resposta da IA, sem exigir nenhuma entrada contínua.

---

#### Como começar

1. Abra o painel **Chat com IA** — toque no ícone 🤖 na barra de ferramentas.
2. Toque em **🛏** no cabeçalho do painel — a sobreposição em tela cheia abre imediatamente.
3. Escolha seu método de entrada (veja as seções abaixo).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Sobreposição do Modo Leito aberta — UI preta em tela cheia. A faixa superior mostra os Cartões de Frases Rápidas. A área central mostra as respostas da IA. A parte inferior mostra um grande botão vermelho de microfone e a linha de controles." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Modo Leito com Mãos Livres ativo — botão 🔁 destacado em verde, texto de status 'Mãos Livres ATIVADO' visível" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Botão de alternância Mãos Livres no estado ativado — fundo verde, aria-pressed=true" width="260">
</p>

#### Como parar / sair

- **Toque / Tocar:** toque em **✕** no canto superior direito da sobreposição (alvo de 48 × 48 px).
- **Teclado / Interruptor:** pressione **Escape**.
- **Voz:** diga qualquer comando via Controle por Voz do iOS enquanto a sobreposição estiver aberta.

Seu histórico completo de chat e o estado da sessão de IA são preservados ao sair. A sobreposição fica acima do painel principal como uma camada de renderização separada — nada é perdido ao fechá-la.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Após fechar o Modo Leito — de volta ao painel principal de chat com IA com o histórico de conversas intacto" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barra de status do painel principal mostrando 'Hey Prism ativo' com indicador azul após retornar do Modo Leito" width="260">
</p>

---

### 🃏 Cartões de Frases Rápidas — para usuários não-verbais e com mobilidade reduzida

> **Este é o caminho crítico para usuários que não conseguem falar ou tocar na tela livremente.** Os Cartões de Frases Rápidas são botões de comunicação pré-programados que podem ser ativados por um único toque, permanência do olhar ou seleção por varredura de chave. Sem digitação. Sem voz. Não é necessária internet para usá-los.

Cada cartão mostra um grande ícone de emoji e uma frase curta. Tocar em um cartão carrega imediatamente essa frase na barra de mensagens. Se o **modo Mãos Livres** estiver ativado, a frase é enviada à IA automaticamente.

#### Cartões integrados

Quinze cartões são pré-carregados no primeiro uso, agrupados por urgência. Eles não podem ser excluídos. Funcionam offline.

**Urgente (prioridade máxima — comunique estes primeiro em uma emergência médica):**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| 🆘 | AJUDA — EMERGÊNCIA | Perigo imediato, chamada de código, qualquer situação que exija equipe agora |
| 😢 | Estou com dor | Dor de qualquer tipo — localização/gravidade pode seguir em texto livre |
| 🫁 | Não consigo respirar | Dificuldade respiratória, preocupação com as vias aéreas, ataque de pânico |
| 🔔 | Chame a enfermeira | Solicitação de equipe não emergencial |

**Necessidades físicas:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| 💧 | Água, por favor | Sede, boca seca, ingestão de medicamentos |
| 🔥 | Estou com muito calor | Febre, cobertor, regulação de temperatura |
| 🥶 | Estou com muito frio | Calafrios, cobertor, temperatura ambiente |
| ↔️ | Por favor, me reposicione | Alívio de pressão, conforto, posicionamento pós-cirúrgico |
| 💊 | Preciso da minha medicação | Dose programada, solicitação PRN, medicação para dor |

**Comunicação:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| ✅ | Sim | Confirmação — respondendo a perguntas sim/não do cuidador |
| ❌ | Não | Recusa — respondendo a perguntas sim/não do cuidador |
| ⏳ | Por favor, espere | Precisa de um momento — não prossiga ainda |

**Emocional:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| ❤️ | Eu te amo | Família, conexão emocional |
| 🙏 | Obrigado(a) | Gratidão |
| 😨 | Estou com medo | Ansiedade, medo, angústia — aciona resposta empática da IA |

#### Como usar os Cartões de Frases Rápidas

**Um toque / olhar / seleção por chave:**
Ativar um cartão coloca seu texto na barra de mensagens. A frase pode então ser:
- Enviada à IA para uma resposta contextual (por exemplo, tocar em "Estou com medo" → a IA responde com tranquilidade e faz perguntas de acompanhamento)
- Lida como está — os cuidadores na sala podem ver o cartão que foi tocado na tela

**Com o modo Mãos Livres ativado:**
A frase é enviada à IA automaticamente no momento em que o cartão é tocado. O microfone reinicia 1 segundo após a resposta da IA — criando um loop contínuo sem qualquer entrada adicional.

**Com a palavra de ativação "Hey Prism" ativa (web / desktop):**
A palavra de ativação + Cartão Rápido podem ser combinados: o usuário diz "Hey Prism" para abrir o microfone, a IA responde, e o usuário pode então tocar em um cartão para continuar a conversa em uma direção diferente sem falar novamente.

#### Como adicionar cartões personalizados

Cuidadores, BCBAs e membros da família podem adicionar cartões personalizados adaptados às necessidades de comunicação específicas do usuário — nomes de seus médicos, frases favoritas, descrições específicas de dor, expressões religiosas ou qualquer outra coisa.

**Passos:**

1. Dentro do Modo Leito, toque em **＋ Adicionar** no final da faixa de Frases Rápidas.
2. Digite a frase que deseja no cartão (até 80 caracteres).
3. Toque em **Adicionar Cartão** — a IA gera automaticamente um ícone de emoji que corresponde ao significado da frase (por exemplo, "Me dê mais cobertores" → 🛏, "Quero orar" → 🤲).
4. O ícone aparece com uma breve animação "✨ Gerando…", então o cartão é salvo.

Os cartões personalizados são salvos localmente no dispositivo (localStorage). Eles persistem entre sessões e reinícios do aplicativo. Nenhuma conta ou conexão com a internet é necessária para usar os cartões salvos — apenas a geração inicial do ícone requer uma chamada de rede.

**Exemplos de cartões personalizados a considerar adicionar:**

| Frase sugerida | Porquê |
|---|---|
| `[Nome do médico], por favor, venha` | Mais rápido que o genérico "chamar enfermeira" para um clínico específico |
| `Preciso falar com minha família` | Situações emocionais/legais que exigem o parente mais próximo |
| `Por favor, apague as luzes` | Sensibilidade sensorial, enxaqueca, sono |
| `Quero orar` | Cuidado espiritual — dignidade em ambientes de fim de vida |
| `Algo está errado` | Sinal vago de angústia — leva a IA a fazer perguntas esclarecedoras |
| `Preciso da sucção` | Pacientes com traqueostomia / ventilador |
| `Meu soro está doendo` | Infiltração, alerta de flebite |
| `Quero ir para casa` | Conversas paliativas/de alta |

#### Como excluir cartões personalizados

1. Toque em **✏️ Editar** no cabeçalho da faixa de Frases Rápidas.
2. Um distintivo vermelho **✕** aparece em cada cartão personalizado (os cartões integrados são protegidos e não podem ser removidos).
3. Toque em ✕ em qualquer cartão para removê-lo.
4. Toque em **Concluído** para sair do modo de edição.

#### Configuração de varredura por chave (iOS)

Para usuários que só podem ativar um único interruptor externo (soprar e sugar, interruptor de cabeça, interruptor de pé, interruptor de almofada):

1. Conecte o interruptor ao iPhone/iPad via Bluetooth ou porta lightning/USB-C.
2. Vá para **Ajustes → Acessibilidade → Controle por Chave → Chaves** e atribua o interruptor a "Selecionar Item".
3. Vá para **Controle por Chave → Estilo de Varredura** e escolha "Varredura Automática" — o dispositivo destacará automaticamente os itens um por um.
4. Abra o Prism AAC no Modo Leito. O Controle por Chave fará a varredura automática dos Cartões de Frases Rápidas. Ative seu interruptor quando o cartão desejado estiver destacado.
5. A frase é enviada imediatamente — nenhuma segunda ação é necessária.

> Todos os Cartões de Frases Rápidas possuem `data-scan-group="quick-cards"` para que a tecnologia assistiva possa fazer a varredura em grupo de toda a faixa antes de mover para outras regiões da interface.

#### Configuração de rastreamento ocular

O hardware de rastreamento ocular (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) se apresenta ao sistema operacional como um ponteiro de mouse padrão com clique por permanência. Nenhuma configuração especial é necessária no Prism AAC:

1. Configure o tempo de permanência no software do seu dispositivo de rastreamento ocular (recomendado: 800–1200 ms para usuários iniciantes).
2. Abra o Prism AAC no Modo Leito em qualquer navegador.
3. Permaneça o olhar em um Cartão de Frase Rápida para ativá-lo.

O tamanho mínimo do cartão (88 × 80 px) atende ao requisito de tamanho alvo WCAG 2.5.5 AAA de 44 × 44 px CSS, e excede o mínimo típico recomendado para interação por rastreamento ocular (60 × 60 px).

---

<details>
<summary><strong>Todos os recursos + detalhes de implementação técnica</strong></summary>

**Cinco subsistemas entregues como um recurso:**

1. **Cartões de Frases Rápidas** — `services/bedsideCards.ts` + UI da faixa em `components/BedsideOverlay.tsx`.

   - Armazenamento: chave `localStorage` `prism_bedside_cards_v1`. Validado por esquema em cada carregamento — entradas malformadas são silenciosamente descartadas.
   - Limite: máximo de 50 cartões personalizados (evita crescimento ilimitado de armazenamento).
   - Cartões integrados: 15 entradas com `id` prefixado `builtin-`; o guarda da UI de exclusão verifica este prefixo antes de mostrar o distintivo ✕, garantindo que os padrões nunca sejam removidos.
   - Geração de ícone por IA: `services/aiService.ts → inferCardIcon(text)`. Usa a mesma cadeia de roteamento local-Ollama → nuvem Synalux que o resto do aplicativo. Envia a frase como uma mensagem de usuário com um prompt de sistema bloqueado ("Responda com exatamente um emoji…"). Extrai o primeiro ponto de código Unicode da resposta. Sempre resolve — retorna a 💬 em caso de erro de rede ou resposta não-emoji.
   - Offline: os cartões funcionam totalmente offline; apenas adicionar um novo cartão requer rede (para geração de ícone — retorna a 💬 se offline).

2. **Loop de IA Mãos Livres (🔁)** — também acessível a partir do cabeçalho principal do chat com IA. Após cada resposta da IA, o microfone reinicia automaticamente (atraso de 1 s). Um padrão de referência `handsFreeRef` / `startListeningRef` garante que o efeito sempre chame o callback atual sem ser executado novamente em cada renderização.

   ![Barra de status Mãos Livres no painel principal de IA](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Sobreposição do Modo Leito** — UI escura em tela cheia `fixed inset-0 z-50 bg-black` renderizada como um `<Fragment>` irmão ao lado do painel principal de IA para que o estado do painel seja preservado entre os ciclos de abertura/fechamento. Acessibilidade: `role="dialog"`, `aria-modal="true"`, `aria-label="Modo Leito"`, WCAG 2.1 SC 2.1.2 armadilha de foco (Tab/Shift+Tab cicla dentro da sobreposição, `Escape` fecha). Cobertura da viewport verificada independentemente por E2E (tolerância ≤ 4 px).

   - **Botão grande do microfone** — 112 × 112 px (`w-28 h-28`), vermelho + pulsando enquanto ouve, borda branca em repouso. Verificado ≥ 96 px por Playwright `boundingBox()`.
   - **Faixa de Cartões Rápidos** — linha de rolagem horizontal, cada cartão `88 × 80 px`, `data-scan-group="quick-cards"` para agrupamento de varredura por chave, `role="list"` / `role="listitem"` para semântica de leitor de tela.
   - **Linha de controles** — Mãos Livres (verde quando ativado), palavra de ativação "Hey Prism" (azul quando ativado, oculto quando `!wakeWordSupported`), atalho de Controle por Voz do iOS.
   - **Sair** — botão ✕ (`w-12 h-12`) ou `Escape` → `onClose()` → `bedsideModeActive = false` em `AIChatPanel` → foco WCAG 2.4.3 retornado ao botão 🛏 que abriu o diálogo.

   ![Sobreposição do Modo Leito — fechada, de volta ao painel principal de IA](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **Palavra de ativação "Hey Prism"** — `services/wakeWordService.ts`. Executa uma sessão contínua de `SpeechRecognition` em segundo plano. Detecta qualquer transcrição contendo "hey prism", aciona o microfone uma vez e depois reinicia para o próximo ciclo. Guarda: não iniciado quando a ponte nativa do iOS possui o microfone (`prismNativeBridge?.startVoice` presente). O estado ativo da palavra de ativação é mostrado na barra de status do painel principal após fechar a sobreposição.

   ![Barra de status mostrando "Hey Prism" ativo](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Guia de Controle por Voz do iOS** — tocar em 📱 na linha de controles tenta `prismNativeBridge.openSettings('accessibility')` (link direto para Acessibilidade em builds nativos suportados). Na web / desktop, ele retorna a um cartão de instrução na sobreposição que explica `Ajustes → Acessibilidade → Controle por Voz → Ativado`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Cartão de instrução do Controle por Voz do iOS — guia passo a passo mostrado dentro da sobreposição do Modo Leito quando 📱 é tocado na web/desktop" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Cartão de instrução do Controle por Voz do iOS após o descarte — a sobreposição retorna ao layout normal do Modo Leito" width="260">
   </p>

**Cobertura de testes:**
- `services/bedsideCards.test.ts` — 22 testes unitários: conjunto de cartões padrão, ida e volta do localStorage, fallback de JSON malformado, filtragem de cartões inválidos, limite de 50 cartões, restrições de campo `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 testes E2E Playwright: visibilidade do botão, alternância `aria-pressed`, classes de estado verde/azul, texto da barra de status, atributos de acessibilidade da sobreposição, tamanho do `boundingBox` do microfone, cobertura da viewport, exibição/descarte do cartão de instrução.

**Arquivos chave:**
- `components/AIChatPanel.tsx` — estado do leito, estado do cartão (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, loop mãos livres, ciclo de vida da palavra de ativação, botões de cabeçalho
- `components/BedsideOverlay.tsx` — UI da sobreposição, faixa de Cartões Rápidos, diálogo de adicionar cartão, modo de edição, armadilha de foco, cartão de instrução de controle por voz
- `services/bedsideCards.ts` — tipo `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — inferência de emoji por IA
- `services/wakeWordService.ts` — detecção contínua de frase de ativação
</details>

---

### 📨 Enviar uma mensagem — seletor de provedor
Quando um contato tem vários provedores configurados (por exemplo, Mail e SMS), uma seção **"Enviar via"** aparece acima da área de composição. Um toque alterna o provedor antes de compor — sem necessidade de sair do painel.

![Seletor de provedor de contato — linha 'Enviar via' com Mail destacado em verde, SMS disponível](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat CAA
Mensagens recebidas de provedores conectados (Telegram, WhatsApp, Email, Slack, etc.) chegam a este painel. O distintivo de não lidas na barra de ferramentas mostra a contagem, o alarme + notificação entre abas é acionado quando uma nova mensagem chega, e tocar em uma linha de mensagem a copia para a barra para que a criança possa compor uma resposta com sua própria voz.

![Painel de Chat CAA mostrando mensagens de cuidadores recebidas com distintivo de não lidas](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Caixa de entrada pesquisada via portal Synalux `/api/v1/prism-aac/inbox/poll` (no-op em 404 se o portal não estiver configurado)
- Notificação `BroadcastChannel` entre abas em nova mensagem
- Abstração de provedor: adicionar Outlook / Slack / Discord = ~30 LOC cada (veja `synalux-private/scripts/fetch-messages.mjs`)
- O estado de leitura sincroniza de volta para que os cuidadores vejam quando a criança viu a mensagem deles
- Nível gratuito: 1 provedor conectado; nível pago: ilimitado
- TTS por mensagem para que a criança possa ouvir o texto recebido em sua voz preferida

**Caminho de renderização:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (pesquisa de 5s quando sidePanel === 'aac-chat', 60s caso contrário) → `useScheduleStore.setIncomingMessages()`. Cada mensagem também é anexada à faixa "Mensagens de cuidadores" da agenda.
</details>

---

### 🧮 Matérias escolares
Tela em grade de células que hospeda **19 teclados de matérias** que cobrem todo o programa do ensino médio: matemática + ciências + programação + artes + humanidades. Cada aba roteia o tutor de IA através de um modelo de prompt específico do domínio (33 modelos no total) para que o modelo não aplique raciocínio algébrico a um quadrado de Punnett ou confunda uma dinâmica musical com um literal de programação. **O histórico é ciente de localidade + região** até o nível de estado / província / Land / comunidade autônoma — mais de 280 regiões em 23 países.

![Tela em grade de células com 5 + 7 = 12 digitado em várias células](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Abas de matérias (19 no total)</strong></summary>

**Matemática (9 teclados)** — Principal, Mat. Avançada (π √ expoentes + 5 ferramentas de decoração: caixa de fração, casa de divisão longa, barra de raiz, linha de somatório, barra de fração), a–z, Mat. Diversa (teoria dos conjuntos + lógica), Tempo e Dist., Peso, Volume, Geom., Dinheiro.

**Ciências (4)** — Química (24 elementos + setas de reação + cargas + subscritos + marcadores de fase), Física (grego completo + 16 unidades SI + ∫/∂/∇/∑/∏ + constantes), Biologia (DNA/RNA + genética + 8 ranks de taxonomia + 12 organelas), Estatística (μ σ x̄ + 12 operações + distribuições).

**Programação (2)** — Python (24 operações + 26 palavras-chave) e Java (24 operações + 26 palavras-chave). O código insere um caractere por célula para que se organize naturalmente na grade monoespaçada.

**Artes + Humanidades (4)** — Música (3 claves + 6 notas + 5 pausas + 5 acidentes + 8 dinâmicas), Ciências da Terra (clima + placas + 10 planetas + AU/ly/pc/Mya/Gya), História (ciente de localidade + região), Artes da Linguagem (12 tags POS + 6 tipos de frases + pontuação + estilos de citação).

</details>

<details>
<summary><strong>Tutor de IA — 11 domínios × 3 modos = 33 prompts</strong></summary>

![Sobreposição do tutor de IA com dica simulada acima da tela](../../docs/screenshots/math-tutor-hint.png)

Três modos por matéria: 💡 **Dica** (sugestão suave para o próximo passo, nunca resolve), ✓ **Verificar** (valida a resposta da criança, celebra se correto), 🎓 **Resolver** (passo a passo completo, máximo 4 passos). A aba ativa informa ao tutor em qual matéria a criança está. Tempo limite rígido de 15 s + botão Tentar Novamente para que a sobreposição nunca trave.
</details>

<details>
<summary><strong>História — ciente de localidade + região</strong></summary>

![Teclado de História na localidade en (sem região) — níveis universal + nacional](../../docs/screenshots/math-keyboard-history-en.png)
![Teclado de História com região US-TX — Alamo, anexação do Texas, JFK aparecem](../../docs/screenshots/math-keyboard-history-us-tx.png)

Três níveis empilhados:
1. Eventos **Universais** ensinados em todos os currículos (476, 1914 Primeira Guerra Mundial, 1939 Segunda Guerra Mundial, 1969 lua)
2. Eventos **Nacionais** selecionados por `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 idiomas suportados
3. Eventos **Subnacionais** selecionados por `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **mais de 280 regiões em 23 países**, incluindo todos os 50 estados dos EUA + DC, 13 províncias / territórios canadenses, todas as 4 nações do Reino Unido, Irlanda (República + 4 províncias históricas), todos os 16 Länder alemães, todas as 17 comunidades autônomas espanholas, todas as 20 regiões italianas, além de AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

O prompt do tutor carrega a localidade + região para que uma data ambígua como 1836 em `US-TX` se resolva para o Álamo (não a formação do estado do Alabama); 1759 em `CA-QC` se ancore nas Planícies de Abraão; 1714 em `ES-CT` para a queda de Barcelona.

</details>

<details>
<summary><strong>Fluxos de trabalho de teste — 12 matérias × problemas de palavras do 8º ao 12º ano × 72 testes Playwright</strong></summary>

Folhas de problemas passo a passo exercitando cada teclado de matéria, além de um teste Playwright executável por problema que aciona o painel de matemática ao vivo e verifica se os glifos de cada etapa chegam à grade de células. Modelado diretamente em uma página de referência de álgebra do 9º ano.

- **Camada 1 — passo a passo genérico:** [`tests/workflows/`](tests/workflows/) — 12 markdowns (matemática-avançada, biologia, química, ciências-da-terra, geometria, história, artes-da-linguagem, matemática-diversa, física, programação-java, programação-python, estatística).
- **Camada 2 — sala de aula real nivelada por série:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 markdowns com problemas de palavras com variáveis nomeadas (álgebra-9º-ano, geometria-10º-ano, física-11º-ano, química-10º-ano, biologia-9º-ano, estatística-11º-ano, programação-python-9º-ano, programação-java-11º-ano, pré-cálculo-12º-ano, ciências-da-terra-9º-ano, artes-da-linguagem-8º-ano, história-mundial-10º-ano) + [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md) de lacuna de teclado por matéria.
- **Camada 3 — Playwright e2e:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 testes (`npx playwright test --project=desktop e2e/math-workflows`).

Índice completo, matérias com suporte insuficiente classificadas e o manual "como adicionar um novo fluxo de trabalho" → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Outros recursos de matemática (ferramenta de bloqueio, ampliação de dois toques, salvar / sincronizar)</strong></summary>

- **Ferramenta de bloqueio** — depois que a criança termina um problema, bloqueie a região. As células bloqueadas são renderizadas ligeiramente esmaecidas e rejeitam edições.
- **Ampliação de dois toques** — o primeiro toque arma a tecla (escala de 1.4× + halo verde), o segundo toque confirma. Desarma automaticamente em 2 s. Para usuários com imprecisão motora.
- **Salvar + sincronizar** — primeiro localmente para `localStorage`; sincronização de melhor esforço para o portal Synalux via botão `↻ Sincronizar`. Limite de 100 documentos / 200 KB de corpo; os mais antigos são despejados.
- **Tempo de permanência** — permanência configurável por tecla (0–1500ms) com anel de progresso verde.

![Sobreposição de documentos salvos mostrando uma entrada e um botão Sincronizar](../../docs/screenshots/math-docs-overlay.png)
![Uma tecla numérica armada no estado ampliado com halo verde](../../docs/screenshots/math-two-hit-armed.png)
![Ferramenta de bloqueio armada, solicitando ao usuário que toque em um canto da região](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Teclados de matérias — imagens adicionais</strong></summary>

![Teclado de Química com H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Teclado de Biologia com A T G](../../docs/screenshots/math-keyboard-biology.png)
![Teclado Java com `private String`](../../docs/screenshots/math-keyboard-java.png)
![Teclado de Música](../../docs/screenshots/math-keyboard-music.png)
![Teclado de Estatística](../../docs/screenshots/math-keyboard-statistics.png)
![Teclado de Ciências da Terra](../../docs/screenshots/math-keyboard-earth-science.png)
![Teclado de Artes da Linguagem](../../docs/screenshots/math-keyboard-language-arts.png)
![História em localidade romena](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Agenda
Agenda visual "primeiro-depois" para suporte a rotinas + transições. Cada etapa é um bloco de imagem + rótulo; finalizar um bloco aciona um carrilhão + uma marca de progresso visual. A loja de recompensas (nível pago) é desbloqueada ao final de uma rotina.

![Painel de Agenda com quadro "primeiro-depois" + lista de atividades](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Grade predefinida de 24 blocos para adições de atividades com um toque: acordar, escovar os dentes, café da manhã, escola, lanche, almoço, brincar, ler, arte, caminhar, jantar, banho, história para dormir, hora de dormir, medicação, fio dental, arrumar, lavar roupa, cuidar do animal de estimação, esportes, …
- Reordenar arrastando e soltando; edição inline com ícone de lápis; adições predefinidas carregam `textKey` para que a troca de idioma re-rotule
- Máquina de estados Primeiro-Depois: pulso do bloco armado, carrilhão ascendente de 3 notas ao expirar o temporizador, seguro para movimento (`prefers-reduced-motion` → anel estático), semântica `aria-pressed`
- Aquecimento de áudio: oscilador de 1Hz quase silencioso mantém o AudioContext "rodando" no iOS Safari para que o carrilhão do temporizador realmente toque após um longo silêncio (sem aquecimento, o carrilhão dispara em um contexto suspenso = sem som)
- Mensagens do cuidador são anexadas à agenda como uma faixa de "Mensagens" para que a criança veja o que está por vir + quem enviou a mensagem

**Caminho de renderização:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 atividades predefinidas + personalizadas) → `services/feedback.ts:playTimerRing()` → AudioContext compartilhado via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jogos
12 jogos de CAA baseados em evidências. Construídos para ensinar comunicação, **não para tempo de tela**. Cada jogo registra vocalizações + precisão para que o motor adaptativo possa sugerir o próximo jogo mais adequado.

![Painel de Jogos com 9 blocos de jogos](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Os 12 jogos + detalhes técnicos</strong></summary>

| Jogo | Habilidade alvo |
|---|---|
| Estoura Bolhas | Causa + efeito, comunicação intencional |
| Caça Cores | Vocabulário receptivo (nomes de cores) |
| Minha História | Sequenciamento narrativo |
| Combine | Correspondência + pensamento categórico |
| Sim/Não | Discriminação binária, pedir/recusar |
| Complete | Conclusão de frases (cloze) |
| Classificação de Categoria | Categorização semântica |
| Combine Emoções | Rotulagem de afeto, Teoria da Mente |
| O Que Vem Depois | Raciocínio sequencial |
| Igual / Diferente | Discriminação visual — combinar ou contrastar |
| Eu Ouço (Combine Sons) | Discriminação auditiva + vocabulário |
| Troca de Turnos | Prática de troca de turnos sociais |

- Nível gratuito: Estoura Bolhas, Caça Cores, Minha História (3 jogos)
- Nível pago: todos os 12
- Dados por jogo alimentam `services/adaptiveEngine.ts` — duração da vocalização / categoria / hora do dia / resultado → sugere o próximo jogo
- Todos os jogos desativam categorias de blocos CAA que não são relevantes para o vocabulário desse jogo, para que a criança não se distraia

**Caminho de renderização:** `components/GamesPanel.tsx` → componentes de jogos individuais em `components/games/`. Cada jogo registra via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Loja
Pacotes de voz (vozes Inworld, voz clonada personalizada de um irmão/pai), pacotes de vocabulário (espanhol essencial, fala com suporte de sinais), pacotes de jogos (jogos extras além dos 9). Os aplicativos são instalados na barra de ferramentas através do mesmo registro que os painéis integrados usam.

![Painel da Loja com aplicativos instaláveis](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Aplicativos vivem como entradas JSON (`lib/marketplace/manifests/local.ts`) + um `lib/marketplace/registry.ts` em tempo de execução com `getHandler(appId)` retornando o componente do painel
- Clonagem de voz (nível pago): gravação de 90s → voz treinada utilizável para qualquer TTS no aplicativo, incluindo blocos de categoria
- Aplicativos instalados são renderizados como botões da barra de ferramentas após os integrados; `useSettingsStore.installedApps` é a fonte da verdade
- Portão por nível: a loja lista tudo, mas os botões de instalação são desativados para itens acima do plano do usuário

**Caminho de renderização:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` para compra, então download de ativos (arquivos de voz, JSON de vocabulário) para IndexedDB.
</details>

---

### 📄 Leitor de PDF
Abra um PDF, veja um bloco por página, toque para ouvi-lo falado em sua voz. Folhas de trabalho escolares, cartas para casa, artigos — insira qualquer PDF e ouça em vez de tentar lê-lo. Não é necessário Adobe Reader; toda a biblioteca funciona no seu navegador.

![Painel do Leitor de PDF — estado vazio com prompt "+ Abrir PDF"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Um bloco por página; cada um mostra as 3 primeiras linhas + um botão `▶ Página N` que passa por `aacSpeak()` (mesma voz + tom + destaque de palavra que todo o resto)
- `▶ Ler tudo` concatena todas as páginas em uma única vocalização contínua
- Detecção de página vazia (PDFs de imagem escaneada) sugere a ferramenta OCR
- `pdfjs-dist` importado dinamicamente na primeira abertura — chunk separado de ~3 MB do CDN, versão fixada ao pacote npm
- O botão da barra de ferramentas (📄) é opcional via Ajustes → Barra de Ferramentas para que a barra de ferramentas padrão mínima permaneça limpa

**Caminho de renderização:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → `getTextContent` por página) → `services/aacSpeak.ts`.
</details>

---

### 👁 Leitor de Captura de Tela (OCR)
Cole ou carregue uma foto de uma folha de trabalho, captura de tela de uma página da web, imagem de uma página de livro didático — o texto reconhecido aparece ao lado da imagem e você pode tocar em **▶ Falar** para ouvi-lo, ou **↧ Enviar para a barra de mensagens** para editar antes de falar.

![Painel do Leitor de Captura de Tela (OCR) — estado vazio com prompt "+ Abrir imagem"](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Matriz OCR de 20 idiomas mapeada de localidades PrismAAC para códigos Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Arquivos traineddata por idioma armazenados em cache após o primeiro uso (~10 MB para inglês, mais para CJK) — a primeira execução mostra "Lendo a imagem… (a primeira execução baixa o modelo OCR — pode levar de 10 a 30 s)"
- Porcentagem de confiança mostrada para que o usuário de CAA possa saber se deve confiar no resultado ou refazer a captura
- Hook de limpeza `disposeOcr()` encerra cada worker gerado no descarregamento da página para liberar memória WASM
- O botão da barra de ferramentas (👁) é opcional via Ajustes → Barra de Ferramentas

**Caminho de renderização:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` ou `messageStore.setText`.
</details>

---

### 🎧 Reprodutor de Conforto

Reprodutor de mídia para pacientes hospitalares — coma, UTI, não-verbais ou qualquer pessoa que precise de conteúdo de conforto contínuo à beira do leito.

<details>
<summary>Detalhes do recurso</summary>

Familiares e amigos gravam mensagens de voz, carregam fotos e vídeos. A playlist é reproduzida continuamente para que o paciente sempre tenha vozes e rostos familiares por perto.

- **Gravar** mensagens de voz diretamente no aplicativo (API MediaRecorder)
- **Carregar** arquivos de áudio, fotos e clipes de vídeo (100 MB por arquivo, 500 MB total)
- **Loop automático** através de todos os itens continuamente — configure e afaste-se
- Modo **Tela cheia** para fotos e vídeo (exibição à beira do leito)
- Integração **TTS nativa** — frases tocadas falam via AVSpeechSynthesizer no iOS
- **Offline** — toda a mídia armazenada em IndexedDB, funciona sem internet
- **Acessível por teclado** — cada controle possui rótulos ARIA e navegação por teclado
- **Revisado com padrão militar** — 27 falhas de segurança corrigidas (vazamentos de URL de blob, tratamento de cota, validação de entrada, listas de permissão MIME, limpeza de desmontagem)
- O botão da barra de ferramentas (🎧) é opcional via Ajustes → Barra de Ferramentas

**Limites de armazenamento:** 50 itens no máximo, 100 MB por arquivo, 500 MB total. Tipos MIME restritos a áudio (webm/mp4/mpeg/ogg/wav), imagens (jpeg/png/gif/webp/heic) e vídeo (mp4/webm/quicktime).

**Caminho de renderização:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (blobs IndexedDB).
</details>

---

### 🧩 Extensão do Chrome — os mesmos recursos de assistente de leitura em qualquer campo de texto
O aplicativo web PrismAAC cobre o fluxo do assistente de leitura dentro de sua própria superfície. A extensão do Chrome (`chrome-extension/`) traz o **mesmo comportamento para QUALQUER campo de texto em QUALQUER site** — Gmail, Google Docs, Word Online, portais escolares, formulários bancários — fechando a única lacuna do Read & Write que não era alcançável apenas a partir de uma página web.

![Assistente de Leitura PrismAAC — fale enquanto digita, com destaque palavra por palavra, em qualquer campo de texto](../../docs/screenshots/extension-marquee.png)

A sobreposição flutuante se anexa acima de qualquer campo de texto focado. Toque em **▶ Falar** para reler, ou apenas continue digitando — terminar uma frase com `.?!` a lê de volta automaticamente com cada palavra acendendo em amarelo enquanto é falada:

![Sobreposição do PrismAAC acima de uma página de composição, no meio da frase com "escola" destacada em amarelo enquanto o TTS a fala](../../docs/screenshots/extension-overlay.png)

A tradução durante a fala mostra AMBAS a linha de origem (itálico pequeno) e a linha traduzida (tamanho completo, com destaque da palavra ativa enquanto é falada). Mais de 50 idiomas via endpoint público gratuito do Google (sem chave API):

![Sobreposição do PrismAAC traduzindo inglês para romeno — linha de origem "I had a really good day at school today" com a tradução "Am avut o zi foarte bună la școală astăzi" abaixo, "foarte" destacada](../../docs/screenshots/extension-translate.png)

Página de opções — sincronização de configurações no perfil do Chrome do usuário via `chrome.storage.sync`. Lista de desativação por site, seletor de voz, controles deslizantes de taxa / volume / tom, seletores de idioma, todos opcionais:

![Página de opções da extensão PrismAAC — gatilhos de fala, idioma alvo romeno, seletor de voz, controles deslizantes de taxa/volume/tom](../../docs/screenshots/extension-options.png)

**Instalar (modo de desenvolvedor por enquanto — listagem na Chrome Web Store pendente de revisão):**

```sh
cd chrome-extension
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick `chrome-extension/dist`.

**Recursos:**

- Falar a frase em `.?!`, falar cada palavra no espaço, todos alternáveis
- **Destaque palavra por palavra** alimentado pelo evento nativo `SpeechSynthesisUtterance.boundary` do navegador (sincronização VERDADEIRA por palavra, versus a heurística de ~60 ms/caractere do aplicativo web — a rota do portal retorna MP3 sem eventos de streaming, mas o Web Speech os expõe nativamente)
- **Traduzir enquanto fala** — escolha um idioma alvo (mais de 50 suportados via endpoint público gratuito do Google, sem chave API). A sobreposição mostra AMBAS a linha de origem (itálico pequeno) E a linha traduzida (com destaque da palavra ativa); uma voz do Web Speech correspondente ao idioma alvo é selecionada automaticamente
- Sobreposição flutuante Shadow-DOM ancorada acima do campo focado (▶ Falar, 📌 Fixar, × Fechar)
- `Cmd / Ctrl + Shift + S` para falar o campo focado sob demanda; `Esc` cancela
- Lista de desativação por site para formulários bancários / sensíveis
- Sincronização de configurações no perfil do Chrome do usuário via `chrome.storage.sync` — nenhuma conta PrismAAC é necessária

**Privacidade:** o modo sem tradução é totalmente offline (o Web Speech funciona nativamente). O modo de tradução faz uma chamada HTTPS por frase única para `translate.googleapis.com` (armazenada em cache após o primeiro acesso). Código-fonte disponível em [`chrome-extension/`](chrome-extension/) — TypeScript + bundle esbuild (conteúdo 18 KB, opções 7 KB, background 339 B).

---

### 👋 Gestos Mãos Livres
Entrada opcional baseada em câmera para usuários que não conseguem tocar de forma confiável. Clique por permanência da pose da cabeça + perfis de gestos da pose da mão. Executa localmente — nenhum vídeo sai do dispositivo.

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- **Modo básico**: rastreamento da pose da cabeça (FaceLandmarker, Mediapipe). O usuário olha para uma tecla, mantém o olhar por `headTrackingDwellMs` (padrão 1200 ms) → clique. Um anel de progresso visual preenche durante a permanência.
- **Modo avançado**: rastreamento da pose da mão. Perfis de gestos personalizados por usuário (palma aberta = enter, punho = backspace, pinça = espaço, etc.) configurados via `components/HandCalibration.tsx`.
- Pilha de segurança contra desvio: se a cabeça do usuário desviar mais de `headTrackingDriftThresholdPx` em `headTrackingDriftWindowMs` quadros consecutivos, o rastreamento é desativado automaticamente e mostra um prompt de recalibração (relatado pelo usuário em maio de 2026: o rastreamento seguiria silenciosamente o desvio por uma hora e perderia os alvos reais das teclas).
- **Saída de emergência Esc** — pressionar Esc em qualquer teclado desativa imediatamente o rastreamento e reexibe o qwerty sem perder a barra de mensagens.
- Singleton de stream de câmera (`services/cameraStream.ts`) para que o rastreador de cabeça + mão compartilhem um stream; a troca de modos é gratuita.
- A calibração por usuário persiste; o rastreador corporal se recupera automaticamente na retomada da sessão.

**Documentação detalhada:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (matemática de calibração, aprendizagem por percentil, ego-movimento, filtro One Euro, ~30 ajustáveis), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ Ajustes
23 idiomas, tema (claro / escuro / alto contraste), tamanho da grade (4–20 blocos), acomodações motoras (tempo de permanência na matemática, ampliação de dois toques, permanência do rastreamento de cabeça, sensibilidade a gestos, desativação automática de desvio), seletor de voz (pago), autocorreção de IA ativada/desativada, notificações, personalização da barra de ferramentas, seletor de região de histórico.

![Ajustes — seletor de idioma + alternância de tema](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Ajustes de matemática + acessibilidade</strong></summary>

![Ajustes — tempo de permanência na matemática + ampliação de dois toques](../../docs/screenshots/panel-settings-math.png)

- **Tempo de permanência na matemática** — controle deslizante de 0–1500 ms; 0 = clique instantâneo, 200–1500 ms ajuda usuários com imprecisão motora (um anel de progresso verde preenche durante a permanência para que possam vê-lo).
- **Ampliação de dois toques** — o primeiro toque em qualquer tecla de matemática a arma (escala de 1.4× + halo verde, sem confirmação), o segundo toque confirma. Desarma automaticamente em 2 s. Combina com o tempo de permanência.
- **Permanência do rastreamento de cabeça** — 200–5000 ms.
- **Sensibilidade** — 1–10.
- **Desativação automática de desvio** — alternar + limiar (px) + janela (ms).
- **Mostrar calibração da mão** — abre o editor de perfil de pose da mão.

</details>

<details>
<summary><strong>Modos de entrada — voz, gestos, autocorreção de IA</strong></summary>

![Ajustes — painel de modos de entrada](../../docs/screenshots/panel-settings-input-modes.png)

- **Entrada de voz** — API Web Speech, ciente do idioma (inglês britânico vs inglês americano etc.); nível gratuito
- **Autocorreção e Conclusão por IA** — cada pausa na digitação é roteada através da autocorreção na nuvem (Gemini 2.5 Flash-Lite). Desativado por padrão em cenários de baixa largura de banda.
- **Notificações** — alarme + notificação entre abas em mensagens de chat CAA recebidas.
- **Entrada da câmera** — interruptor mestre de rastreamento de cabeça + mão.
- **Alvo de rastreamento da câmera** — cabeça, mão ou detecção automática.

</details>

<details>
<summary><strong>Personalização da barra de ferramentas</strong></summary>

A barra de ferramentas é totalmente reordenável. A versão padrão 0.9.0 vem com um conjunto mínimo (microfone, chat CAA, alerta, categorias, ajustes) para que a tela permaneça organizada para novos usuários — todos os outros recursos integrados (matemática, chat com IA, agenda, jogos, loja, reprodutor de conforto, notas, histórico, som) podem ser reativados com um toque em Ajustes → Barra de Ferramentas. Aplicativos instalados da loja se encaixam automaticamente após os integrados.

</details>

---

## Experimente

| | |
|---|---|
| 🌐 **Aplicativo web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — experimente em qualquer navegador |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Código-fonte** | Este repositório. AGPL-3.0 — faça fork livremente, compartilhe modificações |

---

## Planos

| | Gratuito | Pago |
|---|---|---|
| Blocos de imagem + 22 categorias | ✅ | ✅ |
| Digitar para falar | ✅ | ✅ |
| Voz padrão (Inworld) | ✅ | ✅ |
| Teclado escolar de 19 matérias + tutor de IA | ✅ básico | ✅ + modelos premium |
| Agenda | ✅ | ✅ + loja de recompensas |
| Jogos | 3 (Estoura Bolhas, Caça Cores, Minha História) | Todos os 12 |
| Seletor de voz | — | ✅ todas as vozes Inworld |
| Clonagem de voz (sua própria voz) | — | ✅ |
| Sincronização de notas do cuidador | — | ✅ |
| Previsão de palavras (aprendizagem por usuário) | — | ✅ |
| Histórico de localidade + região | ✅ | ✅ |
| Entrada por gestos mãos livres | ✅ | ✅ |

[Ver preços Synalux →](https://synalux.ai/pricing)

---

## Segurança clínica

- **O acesso à CAA nunca é restrito como consequência.** Uma criança deve sempre ter sua voz.
- **Nenhuma PHI na nuvem sem consentimento.** As notas do cuidador são criptografadas antes do upload.
- **O áudio permanece local.** A entrada de voz transcreve no navegador via API Web Speech.
- **Projetado por BCBAs.** O rastreamento de operantes verbais corresponde à Lista de Tarefas BACB 5ª Edição.
- **Padrões informados sobre trauma.** Sem mecânicas de punição. A loja de recompensas é opcional.

Leia mais: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Infraestrutura e GDPR

### Arquitetura multi-região

| Componente | Região | Propósito |
|---|---|---|
| **Supabase EUA** | Leste dos EUA (Virgínia) | Banco de dados primário — autenticação, dados do usuário, notas do cuidador |
| **Supabase UE** | Centro da UE (Frankfurt) | Compatível com GDPR — dados de usuários da UE nunca saem da UE |
| **Vercel** | Global Edge | Aplicativo web, rotas de API, CDN |
| **Inworld TTS** | EUA | Texto para fala neural |
| **HuggingFace Hub** | EUA/UE | Pesos do modelo (1.7B, 8B, 14B, 32B) |
| **No dispositivo** | Dispositivo do usuário | Inferência llama.cpp (iPhone/iPad/Mac) |

### Conformidade com GDPR

Os dados dos usuários da UE são armazenados exclusivamente na região de Frankfurt (eu-central-1). O portal detecta a localização do usuário via cabeçalho `x-vercel-ip-country` da Vercel e roteia as operações do banco de dados para a instância Supabase apropriada:

- **Usuários da UE** → `supabase-eu` (Frankfurt) — dados pessoais, autenticação, preferências, notas do cuidador
- **Usuários não-UE** → `supabase-us` (Virgínia) — mesmas categorias de dados, jurisdição dos EUA
- **Inferência de IA** → no dispositivo (nenhum dado sai do dispositivo) ou API Synalux (nenhuma PII armazenada)
- **Áudio TTS** → gerado no servidor, transmitido para o cliente, não armazenado

**Garantias de residência de dados:**
- Dados pessoais da UE nunca transitam por servidores dos EUA
- Tokens de autenticação com escopo para a instância regional do Supabase
- Notas do cuidador criptografadas em repouso (Supabase AES-256)
- Gravações de voz (Reprodutor de Conforto) armazenadas no IndexedDB do navegador — nunca carregadas
- Modelo de IA no dispositivo executa localmente — zero telemetria na nuvem

**Direito ao apagamento:** A exclusão do usuário se propaga por autenticação, perfis, notas do cuidador e análises de uso no banco de dados regional. Instâncias auto-hospedadas podem ser apagadas com `supabase db reset`.

### Custos em escala

| Usuários | Supabase | Vercel | TTS | Modelos de IA | Total |
|---|---|---|---|---|---|
| 0–1K | $50/mês (2 regiões) | $0 (Hobby) | ~$5/mês | $0 (no dispositivo) | ~$55/mês |
| 1K–10K | $50/mês | $20/mês (Pro) | ~$50/mês | $0 | ~$120/mês |
| 10K–100K | $50/mês + complementos de computação | $20/mês | ~$200/mês | RunPod $125/mês | ~$395/mês |

---

## Modelos de IA e suporte a dispositivos

Funciona em todos os dispositivos Apple. Dependência zero da nuvem para comunicação CAA essencial.

O PrismAAC seleciona automaticamente o melhor modelo que seu hardware pode executar, retorna graciosamente em dispositivos com restrições e nunca requer uma conexão com a internet para comunicação básica.

| Dispositivo | RAM | Modelo | Precisão | CAA | Tamanho | Custo |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 14B Q4_K_M (v36) | **100%** | 100% | 8.4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 8B Q4_K_M (v36) → 1.7B (fallback OOM) | **100%** | 100% | 4.7 GB / 1.1 GB