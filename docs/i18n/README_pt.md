<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ajude crianças e adultos não verbais a falar.**

Aplicativo de Comunicação Alternativa e Aumentativa (CAA) para crianças com deficiência motora e necessidades complexas de comunicação. Toque em imagens, construa frases, ouça-as faladas em voz alta — em 25 idiomas (28 variantes regionais). Funciona em qualquer tablet, laptop, iPhone, iPad e Apple Watch.

Parte da [plataforma Synalux](https://synalux.ai).

**Experimente agora:**
- **Aplicativo Web (gratuito):** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — funciona em qualquer dispositivo com navegador
- **iOS (iPhone + iPad + Apple Watch):** [App Store](https://apps.apple.com/app/id6764692277)
- **Preços:** [synalux.ai/pricing](https://synalux.ai/pricing) — gratuito, mais um plano opcional Prism AAC Cloud (US$ 4,99/mês) para voz natural e cota de IA em nuvem

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · **Português** · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Experimente Grátis"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Preços"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacidade"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Termos"></a>
</p>

![Tela principal do Prism AAC no iPad — barra de ferramentas, barra de digitação, cinco blocos de predição e o teclado qwerty completo (aplicativo web em produção, 1.9.0)](../../docs/screenshots/app-hero.png)

### Aplicativos nativos

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC no iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC no iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC no Apple Watch Ultra" width="120" />
</p>

<sub>Molduras de iPhone e iPad capturadas da versão 1.9.0 (53) executando o aplicativo web de produção, 08/09/2026. Moldura do Watch da versão 1.4.0.</sub>

| Plataforma | Status | IA no dispositivo | Notas |
|----------|--------|-------------|-------|
| **Web** (PWA) | ✅ Produção | Baixa automaticamente o melhor modelo local | Qualquer navegador, instalável; plano Cloud via Stripe |
| **iPad Pro 16GB** | ✅ Produção | IA no dispositivo de 4B (100% de precisão) | O mais rápido, totalmente privado; plano Cloud via compras no app da Apple |
| **iPhone Pro 8GB** | ✅ Produção | 4B Q4_K_M no dispositivo (100% de precisão) | Selecionado automaticamente pela RAM |
| **Todos os iPhones** | ✅ Produção | 2B Q3_K_M no dispositivo (99,1% de precisão) | 2,3 GB — compatível com todos os iPhones |
| **Apple Watch** | ✅ Produção | Frases offline (1.261 × 20 idiomas) | Independente — pictogramas, TTS, emergência |
| **Extensão do Chrome** | ✅ Produção | — | Assistente de leitura em qualquer campo de texto |
| **WiFi para Mac** | ✅ Produção | 9B/27B via Ollama | Configurações → IA Local → insira o IP do Mac |

---

## Vídeo de demonstração na App Store

Vídeo de 30 segundos apresentando todos os principais recursos com narração Inworld TTS:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Cena | Recurso | Captura de tela |
|---|---|---|
| **Início** — toque nas frases | Prancha de pictogramas com 22 categorias, botão Falar | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorias** | Frases rápidas para Ajuda, Comida, Lugares, Sentimentos | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat de IA** | Componha mensagens, pratique conversas | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerta de Emergência** | Chamada de cuidador/enfermeiro com um toque | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Rotina** | Rotinas diárias visuais — manhã, escola, almoço, dormir | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jogos** | Estourar Bolhas, Caça às Cores, Combinar, Sim/Não, Complete a Frase | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matemática e Escola** | Matemática adaptativa com Dica, Verificar, Resolver + teclado numérico | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Rastreamento Cefálico e Ocular** | Cursor de fixação por câmera, controle por olhar, calibração | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Idiomas** | Inglês, Espanhol, Francês, Russo, Japonês, Coreano, Chinês, Árabe e mais | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Visão geral

| Módulo | O que faz | Demonstração |
|---|---|---|
| 📂 **Categorias** | Cartões de imagens no estilo PECS para não leitores | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Digitar e falar** | Teclado + predição de palavras + voz neural | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat de IA** | Assistente no dispositivo + nuvem adaptado para usuários de CAA | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat CAA** | Mensagens recebidas de cuidadores + contatos | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matemática + matérias** | Tela em grade com tutor especializado na disciplina | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Rotina** | Rotinas visuais do tipo "primeiro-depois" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jogos** | 12 jogos terapêuticos de CAA | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Marketplace** | Pacotes de voz, pacotes de vocabulário, pacotes de jogos | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Tocador de Conforto** | Reprodutor de mídia de leito para pacientes hospitalizados | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Modo Leito** | Chat de IA em tela cheia para uso com celular no suporte / deitado | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **Contexto Visual** | Câmera detecta objetos → sugere frases relevantes | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **Mãos livres** | Reconhecimento de gestos cefálicos + manuais | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Configurações** | 25 idiomas, adaptações motoras, seletor de voz + cache de fala | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **Fala e IA em Nuvem** | Cota opcional de US$ 4,99/mês para voces naturais + IA em nuvem | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## Acessibilidade

O Prism AAC passou por uma [auditoria de acessibilidade com 70 itens](ACCESSIBILITY.md) em junho de 2026, testada em iPhone em modo retrato, iPhone em modo paisagem, iPad em modo retrato e iPad em modo paisagem. Todos os problemas foram corrigidos e verificados com testes automatizados e2e.

### Métodos de entrada — use qualquer parte do corpo

| Método | Como funciona | Configuração |
|--------|-------------|-------|
| **Toque** | Toque padrão + blocos de pictogramas | Funciona nativamente |
| **Rastreamento cefálico** | A câmera segue o movimento da cabeça → clique por fixação (dwell) | Configurações → Modos de Entrada |
| **Olhar ocular** | Ponderação da posição dos olhos no rastreador cefálico | Configurações → Modos de Entrada |
| **Varredura por acionador** | Varredura automática/manual com acionador Bluetooth, teclado ou controle de jogo | Configurações → Modos de Entrada → Varredura por Acionador |
| **Reconhecimento de gestos** | Piscar, acenar com a cabeça, sorrir, abrir a boca → ações mapeadas | Configurações → Modos de Entrada → Gestos |
| **Entrada de voz** | Ditado com autocorreção por IA, mãos livres, palavra de ativação | Botão de microfone na barra de ferramentas |
| **Teclado simplificado** | 15 letras mais frequentes em grade 3×5 (automático para tamanho de grade 4) | Configurações → Tamanho da Grade → 4 |

Navegação na prancha de imagens: deslize para a esquerda/direita na grade de vocabulário ou na faixa inferior de categorias para navegar pelas páginas. No Mac, use a rolagem horizontal do trackpad ou clique e arraste; as setas laterais permanecem disponíveis. A mudança de página não escolhe uma palavra — toque ou clique em um cartão deliberadamente para selecioná-lo. A rolagem vertical e o movimento de pinça para zoom não mudam de página. Veja a [navegação por deslize e limites de teste](docs/SWIPE_NAVIGATION.md).

### Layout responsivo — iPhone e iPad, retrato e paisagem

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone em modo retrato" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone em modo paisagem" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad em modo retrato" width="240" />
</p>

### Modos visuais

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="Escuro + alto contraste no iPhone" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="Escuro + alto contraste no iPad em modo paisagem" width="340" />
</p>

- Temas **Claro / Escuro / Alto Contraste**
- Consultas de mídia do sistema para **`prefers-contrast: more`** e **`prefers-reduced-motion`**
- **Gesto de pinça para zoom** ativado (até 5×) — em conformidade com WCAG 1.4.4
- **16 palavras de emergência × 8 idiomas** no modo de recuperação contra falhas

Para ler o relatório completo de auditoria com os 70 resultados, consulte [ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## Segurança e Privacidade

O PrismAAC é usado por crianças, adultos não verbais e populações clínicas. Segurança não é um recurso — é uma restrição que molda cada caminho de inferência.

### Arquitetura de segurança em camadas

| Camada | O que | Onde roda | Latência |
|--------|-------|-----------|----------|
| **L1 — Portão de segurança determinístico** | Interceptação médica/de crise baseada em Regex | Cliente + servidor (cada caminho) | 0 ms |
| **L2 — Treinamento de segurança do modelo** | Alinhamento RLHF do Qwen3.5 | No dispositivo + nuvem | Embutido |
| **L3 — Portão de confiança** | Rejeita saída curta/garbled/template-leaked output | No dispositivo + servidor | 0 ms |
| **L4 — Verificador de fundamentação** | Verificação de NLI: alegações devem ter acarretação lógica pela evidência | Servidor (planos pagos) | ~200 ms |

### Detalhes do portão de segurança L1

O portão L1 executa verificações determinísticas de regex na **entrada e na saída** em todos os caminhos de inferência — incluindo o caminho local offline do Ollama que ignora o servidor inteiramente.

**O que ele captura:** expressões de crise em primeira pessoa (intenção de automutilação), instruções perigosas de dosagem médica.

**O que ele NÃO captura (por projeto):** termos clínicos genéricos ("dose of risperidone", "milligrams", "suicide prevention training"). Estes aparecem em notas médicas/BCBA legítimas e bloqueá-los prejudicaria os usuários clínicos que este produto atende. A segurança não depende do alinhamento do próprio modelo 2B no dispositivo (ele pontua ~59% no BFCL V4 geral). O L1 é o mecanismo primário de segurança determinística.

**Limitações conhecidas do L1:**
- **Cobertura de idioma irregular.** Frases de crise são correspondidas em inglês e em outros idiomas, e os conjuntos diferem por caminho. O portão de chat de IA da web (`services/crisisSafetyFilter.ts`) também corresponde a frases em espanhol, francês, português, Romanian, russo, ucraniano, árabe, alemão, japonês, coreano, chinês e búlgaro. A verificação offline no lado do cliente (`checkInputSafetyClient`) também corresponde a espanhol, francês, português, russo, árabe, alemão e ucraniano. O portão do iOS tem sua própria lista embutida (inglês, espanhol, francês, Romanian, russo, árabe e hebraico) e adiciona palavras-chave do servidor na inicialização quando consegue alcançá-lo. Padrões de dosagem médica são apenas em inglês em cada caminho do cliente. Um idioma suportado sem padrões em um determinado caminho é protegido apenas pelo próprio treinamento de segurança do modelo (L2).
- **Regex é um piso, não um teto.** Sofrimento parafraseado ("I don't want to be here anymore") não é correspondido. O L1 captura formulações definidas de alto sinal; o L2 (alinhamento do modelo) lida com a cauda longa.

**Cobertura por caminho:**

| Caminho | Entrada L1 | Saída L1 | Notas |
|---------|:----------:|:--------:|-------|
| Ollama local (offline, web) | ✅ lado do cliente | ✅ lado do cliente | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| No dispositivo iOS (llama.cpp) | ✅ nativo | ✅ nativo | `SafetyFilter.swift` (`ios-native/PrismAAC/Sources/Safety/`); a verificação de saída intercepta apenas conteúdo de jailbreak |
| Portal `/prism-aac/chat` | ✅ | streaming* | Entrada verificada antes da chamada do modelo |
| Portal `/prism-aac/infer` | ✅ | ✅ | Módulo compartilhado de padrões de segurança |
| Portal `/prism-aac/inference` | ✅ | ✅ | Módulo compartilhado de padrões de segurança |

*Respostas em nuvem por streaming dependem da segurança do modelo (L2) para a saída — o L1 não pode filtrar por regex um fluxo de tokens em andamento.

### Como é uma interceptação de crise

Se um usuário digitar sofrimento por meio da interface AAC, o L1 retorna imediatamente (antes que qualquer modelo rode):

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Privacidade

- A IA no dispositivo processa prompts localmente — no data leaves the device
- Serviços de voz na nuvem e IA na nuvem (quando usados) vão para o portal Synalux sobre TLS; o texto é processado na memória e não é armazenado
- Nenhum prompt do usuário é armazenado ou usado para treinamento
- Nenhuma conta é necessária; telemetria anônima de uso/erro (Datadog) nunca contém texto digitado ou falado
- Veja [PRIVACY.md](../../PRIVACY.md) para a política de privacidade completa

---

## Alternativa gratuita ao Read & Write

O PrismAAC inclui todos os recursos de assistência à leitura pelos quais a maioria dos usuários de CAA paga no Read & Write — de forma gratuita, no navegador, sem necessidade de conta para a versão web. Veja [Digitar e falar](#%EF%B8%8F-digitar-e-falar) para leitura ao final da frase + destaque de palavras, [Leitor de PDF](#-leitor-de-pdf) e [Leitor de Captura de Tela (OCR)](#-leitor-de-captura-de-tela-ocr) para documentos, e a [Extensão do Chrome](#-extens%C3%A3o-do-chrome--os-mesmos-recursos-de-assist%C3%AAncia-%C3%A0-leitura-em-qualquer-campo-de-texto) para suporte em qualquer aplicativo como Gmail / Docs / Word Online / e outros.

## Comparativo do PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Câmera → sugestão de frases** (identifica objetos, sugere palavras) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **IA no dispositivo** (roteamento 99–100%, suporte a HIPAA) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **Classificação de frases por usuário** (adapta-se a cada criança) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Correções dos cuidadores **viram dados de treinamento** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Tutor de IA** (matemática + 10 outras matérias) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Tela de matemática em grade** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Histórico regionalizado** (mais de 280 regiões) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Mãos livres** rastreamento cefálico + manual + gestos + varredura | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **Chat de IA mãos livres** (fala contínua + ativação por voz + modo leito) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Jogos de CAA** terapêuticos (12 integrados) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **Código aberto** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Plano gratuito** (acesso essencial para comunicação) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Marketplace** de pacotes de voz | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **Suporte a múltiplos idiomas** (25) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Anotações do cuidador** (casa / escola / clínica) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| Modo independente no **Apple Watch** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Assistente de leitura em **Extensão do Chrome** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = suporte completo &nbsp;&nbsp; 🟡 = parcial &nbsp;&nbsp; 🔴 = indisponível

> A comparação reflete as informações públicas dos produtos até maio de 2026. O PrismAAC está em desenvolvimento ativo; concorrentes podem adicionar recursos ao longo do tempo. Sugestões de alterações para manter os dados atualizados são bem-vindas — veja `CONTRIBUTING.md`.
>
> O Grid 3 e o Tobii Dynavox possuem integrações de hardware dedicadas para rastreamento ocular e varredura por acionador não detalhadas acima (dependem de hardware e configurações clínicas especializadas).

---

## iOS e Apple Watch

### iPhone / iPad

Aplicativo Swift nativo que envolve a interface web em WKWebView + uma arquitetura de **IA Dupla no Dispositivo** via llama.cpp Metal.

Para garantir acesso imediato e offline à IA em qualquer aparelho, o aplicativo executa automaticamente dois modelos diferentes simultaneamente com base na memória disponível no dispositivo:

| Dispositivo | RAM | IA de Conversação | Precisão de Roteamento | Autocompletar |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3,4 GB) | **100%** | 360M (integrado) |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3,4 GB) | **100%** | 360M (integrado) |
| Todos os outros iPhones / iPads | < 8 GB | 2B Q3_K_M (2,3 GB) | **99,1%** | 360M (integrado) |

> Precisão: benchmark BFCL, 115 casos de roteamento de ferramentas × 3 execuções aleatórias, temperatura=0, junho de 2026.

#### IA no dispositivo — funciona offline desde o primeiro acesso

Todos os dispositivos trazem um modelo de IA embutido no aplicativo. Sem downloads, sem necessidade de WiFi ou criação de conta — abra o aplicativo e comece a se comunicar.

| Dispositivo | Modelo incluído | Tamanho | O que faz |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2,3 GB | Roteamento de ferramentas, Mãos livres, Modo Leito, Palavra de ativação (99,1% de precisão) |
| **Apple Watch** | SmolLM2-360M | 207 MB | Expansão de símbolos, frases de emergência, texto preditivo (100% de precisão) |

Modelos maiores (9B, 27B) estão disponíveis em Configurações → IA Local para roteamento via WiFi para o Mac (100% de precisão BFCL).

<details>
<summary><strong>Detalhes técnicos</strong></summary>

- **Filtro de segurança determinístico L1:** intercepção por regex de termos médicos/crise tanto na entrada (antes da execução do modelo) quanto na saída (antes de exibir ao usuário). Os padrões focam especificamente na intenção de automutilação — termos clínicos/farmacológicos genéricos ("dose de", "milisgramas") NÃO são interceptados para evitar bloquear o uso clínico legítimo da CAA.
- **Segurança de saída no cliente:** resultados do Ollama local passam por `checkOutputSafetyClient` antes da exibição — usuários offline possuem a mesma proteção L1 que usuários em nuvem.
- **Controle de confiança:** respostas geradas no dispositivo abaixo dos limites de tamanho/qualidade são rejeitadas e enviadas para a nuvem (planos pagos) ou reduzidas adequadamente (plano gratuito).
- O controle adaptativo por memória reduz recursos gradualmente: IA completa → IA em nuvem → funções essenciais → modo de emergência
- Alternativa em caso de falta de memória (OOM): 4B Q4_K_M → 2B Q3_K_M → 360M
- Ajuste de área segura para Dynamic Island / entalhe da tela
- Integração via WCSession para envio de alertas de emergência no Apple Watch
- Tokens de autenticação salvos no Keychain

</details>

**Configurações → 🤖 Modelos de IA Local** — baixe e gerencie modelos no dispositivo:
- Detecta automaticamente o Ollama em `localhost:11434`
- WiFi para o Mac: iPad/iPhone → Mac Ollama (9B/27B com 100% de precisão BFCL)
- Download individual de modelos com barra de progresso em tempo real
- Modelos: `:2b` (2,3 GB) · `:4b` (3,4 GB) · `:9b` (5,8 GB) · `:27b` (16,8 GB)


### Apple Watch (independente)

Funciona sem o iPhone — modo autônomo com dicionário de frases offline.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Tradução offline:** 1.261 frases × 20 idiomas incluídos (JSON de 411 KB) — busca instantânea, 100% precisa, sem necessidade de rede
- Grade de pictogramas de 2 colunas com imagens ARASAAC
- Chat de IA com entrada por ditado + teclado (nuvem quando online, dicionário de frases quando offline)
- Sistema de emergência: contagem regressiva → WCSession → rede celular alternativa → TTS
- Tradução com saída de áudio TTS (dicionário offline primeiro, nuvem como alternativa)
- Caixa de entrada: receba e responda mensagens de cuidadores
- Pinos de certificado (SPKI SHA-256) no envio de alertas de emergência
- Sanitização NFKC + limite de 23 tokens contra injeção de comandos em todos os caminhos de IA

---

## 📊 Painel de Relatórios do Cuidador (v1.8)

O aplicativo registra dados comportamentais detalhados internamente — precisão de predição, tendências motoras, estabilidade da voz, estabilidade do rastreamento cefálico, padrões de comunicação, correções dos cuidadores. Anteriormente, **nenhum desses dados ficava visível para os cuidadores**. A única interface disponível era um bloco de anotações em texto.

Agora há uma **aba de Relatórios** no Painel do Cuidador com 7 componentes de monitoramento em tempo real, respaldados por um coletor de métricas em segundo plano que é executado a cada 5 minutos sem impactar a velocidade da predição.

### O que os cuidadores visualizam

| Componente | Informação exibida | Valor clínico |
|---|---|---|
| **Eficácia da Predição** | "72% de acerto ↑ vs 24h anteriores" | O conjunto de vocabulário está funcionando — ou precisa de ajustes |
| **Adoção de Vocabulário** | "45 ativos · 12 novos · 8 sem uso" | Quais frases foram adotadas e quais podem ser removidas |
| **Tópicos de Comunicação** | "Principais: escola (35%), comida (22%)" | Mudanças na distribuição de tópicos podem indicar regressão ou mudança de ambiente |
| **Tendência Motora** | "Fixação 850ms ↓ (melhorando)" | Controle motor melhorando → tempo de fixação menor; piorando → encaminhar para Terapia Ocupacional |
| **Confiabilidade do Rastreamento** | "2 desvios · 98% ativo" | Desvios frequentes → verificar postura, cansaço, calibração |
| **Confiabilidade da Voz** | "97% de sucesso · 1 alternativa" | Falha no Azure TTS? Chave de API expirada? Problema de conexão? |
| **Volume de Correções** | "47 correções no total" | Taxa de correção aumentando = o modelo precisa ser reajustado para esta criança |

### Layout do painel

| Painel do Cuidador | | ✕ |
|:---|:---|---:|

| + Nota | Registro | **Relatórios** |
|:---:|:---:|:---:|

> **Eficácia da Predição**
> `72% de acerto` &nbsp;&nbsp; ↑ vs 24h
> ![sparkline](https://img.shields.io/badge/tend%C3%AAncia-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **Adoção de Vocabulário**
> `45 ativos` · `12 novos` · `8 sem uso`
> `████████████████░░░░░░` adotados 69% / testados 18% / sem uso 13%

> **Tópicos de Comunicação**
> `escola` 35% · `comida` 22% · `brincar` 18%
> ![sparkline](https://img.shields.io/badge/escola-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/comida-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/brincar-18%25-2196F3?style=flat-square)

> **Tendência Motora**
> `Fixação 850ms` &nbsp;&nbsp; ↓ melhorando
> ![sparkline](https://img.shields.io/badge/tend%C3%AAncia-1200____1100____950_____850ms-FF9800?style=flat-square)

> **Confiabilidade do Rastreamento**
> `2 desvios hoje` · `98% ativo`
> ![sparkline](https://img.shields.io/badge/tempo_ativo-98%25-4CAF50?style=flat-square)

> **Confiabilidade da Voz**
> `97% de sucesso` · `1 alternativa`
> `██████████████████████████████░` Azure 94% / Web Speech 3% / falha 3%

> **Volume de Correções**
> `47 correções no total` &nbsp;&nbsp; +3 esta semana
> ![sparkline](https://img.shields.io/badge/tend%C3%AAncia-38_____41_____44_____47-795548?style=flat-square)

<sub>286 pontos de dados · últimos 7 dias · atualizado a cada 5 min</sub>

### Arquitetura

```
Toque na Barra de Predição --> recordPredictionHit() (importação dinâmica, ~0,01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (temporizador 5min)  |
        |                                            |
        |  subscribeTtsHealth() ------> ttsAccum     |
        |  subscribeTrackingEvents() -> trackAccum   |
        |  getAdaptiveSignals() ------> motor/tópicos|
        |  corpusHealth() ------------> correções    |
        |  phraseUsageStore ----------> vocabulário  |
        |                                            |
        |  flushBucket() -> metricsStore.buckets     |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  metricsStore (zustand + localStorage)     |
        |  7 dias móveis - intervalos 5min - 400KB   |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (carregamento lento) |
        |  7 cartões InsightCard + Sparkline em SVG  |
        |  Renderiza apenas ao tocar na aba          |
        +--------------------------------------------+
```

### Garantias de desempenho

| Ponto analisado | Garantia |
|---|---|
| **Caminho de digitação** | 0ms adicionados — acertos/erros usam importação dinâmica + incrementos de contador |
| **Memória** | ~400KB em localStorage + ~50KB de RAM para 7 dias |
| **Tamanho do pacote** | ~2KB de JS (sem bibliotecas de gráficos — apenas SVG simples) |
| **Offline** | 100% em localStorage — sem chamadas de rede |
| **iPad** | Cartões com rolagem vertical, gráficos sparkline de 120×32px |
| **Privacidade** | Sem informações de saúde do paciente (PHI) — apenas contagens operacionais, protegidas por PIN |

### Exemplo: interpretando a eficácia da predição

```
Eficácia da Predição
78% de acerto                   ↑ vs 24h anteriores
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **78% de acerto**: em 78% das vezes, a criança tocou em uma palavra da barra de predição em vez de digitar manualmente. Isso indica que o vocabulário configurado está alinhado com os padrões de comunicação da criança.
- **↑ vs 24h anteriores**: a taxa de acerto melhorou em relação ao dia anterior — o mecanismo adaptativo está aprendendo.
- **Sparkline**: exibe a tendência da taxa de acerto nas últimas 24 horas. Quedas podem estar correlacionadas a novos tópicos ou ambientes.

Se a taxa de acerto cair abaixo de 40%, o vocabulário provavelmente precisa ser atualizado — a criança está tentando se comunicar sobre assuntos não cobertos pelo mecanismo de predição.

### Exemplo: interpretando a tendência motora

```
Tendência Motora
Fixação 1200ms                 ↑ aumentando
╭──╮
│  ╰──╮╭──╮╭─
```

- **Fixação 1200ms**: a criança precisa manter o olhar ou cursor por 1,2 segundo sobre o item para confirmar a seleção. Intervalo típico: 800–2000ms.
- **↑ aumentando**: o tempo de fixação está aumentando (a criança precisa de mais tempo). Isso pode indicar cansaço, alteração de medicação ou alteração no controle motor.
- **Ação**: se a tendência persistir por 3 dias ou mais, recomende uma avaliação com o terapeuta ocupacional. O aplicativo ajusta automaticamente o tempo de fixação, mas uma análise clínica deve investigar a causa subjacente.

---

## Módulos

### 📂 Categorias

No modo Imagem, o Tamanho da Grade define a quantidade de cartões por página de vocabulário (4 equivale a 2 × 2; 6 equivale a 3 × 2). Deslize para a esquerda ou direita na prancha para navegar, ou use os ícones ao lado do título da categoria. A navegação não insere palavras nem emite som; toque em um cartão para selecioná-lo. A posição da página é anunciada para leitores de tela sem a necessidade de um rodapé visual de contagem.

Cartões de imagem no estilo PECS. Toque em uma categoria, toque em um cartão, ouça a palavra e veja-a ir para a barra de mensagem. Funciona para não leitores, leitores iniciantes e comunicadores em desenvolvimento. Os conjuntos de cartões e sua ordem se personalizam ao longo do tempo por ativação espalhada — os cartões mais utilizados ganham destaque; os que não são usados há meses diminuem de prioridade.

**Layout envolvente** — as categorias aparecem em uma coluna rolável à esquerda ao lado do teclado, permitindo tocar nos cartões de imagem E digitar simultaneamente sem mudar de modo. A barra de predição permanece visível; ambas as entradas estão sempre acessíveis.

![Categorias no modo envolvente — cartões de categoria com rolagem à esquerda, teclado completo à direita](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- 22 categorias padrão: pessoas, comida, sentimentos, corpo, roupas, animais, lugares, etc.
- O cuidador pode adicionar / remover / reordenar cartões para cada criança
- Cada cartão possui uma chave `textKey` para internacionalização — alterar o idioma do aplicativo reetiqueta todos os cartões com um toque
- Os pictogramas dos cartões vêm do ARASAAC + um conjunto selecionado; a clonagem de voz permite combinar a voz do cartão com a dos irmãos ou pais da criança (plano pago)
- Aprendizado de n-gramas por usuário: se a criança tocar em "Eu quero comer" três vezes, a palavra "comer" subirá de posição após "quero" na sessão seguinte
- Memória holográfica HRR: predições contextuais sem busca em ~0,2ms via Rust WASM — +27% de precisão Top-1 nas frases principais de CAA

**Caminho de renderização:** `components/CategoryPanel.tsx` → `useCategoryStore` → cartões obtidos de `constants/phrases.ts` (sistema) + alterações do usuário no Supabase (pago). Toques nos cartões executam `messageStore.appendText(phrase)` e passam por `aacSpeak()` para conversão de texto em fala (TTS).
</details>

---

### ⌨️ Digitar e falar
Teclado na tela com **predição de palavras**, **autocompletar por IA** e um botão **Falar** de um toque que lê a barra de mensagem em voz alta com uma voz neural natural. A digitação treina o mecanismo de predição: as palavras mais digitadas aparecem mais cedo nas sessões seguintes.

![Teclado Prism AAC com "olá" digitado, blocos de predição e botão Falar](../../docs/screenshots/keyboard-typing.png)

**Recursos de assistência à leitura (equivalência ao Read & Write)** — para usuários com necessidades de leitura / memória / cognição:

- **Falar por palavra** — cada palavra é reproduzida via TTS no momento em que a barra de espaço é tocada, permitindo ouvir o que foi digitado sem esperar a frase completa.
- **Falar a frase em `.?!`** — finalizar uma frase com ponto final, ponto de interrogação ou ponto de exclamação lê a frase inteira de volta, evitando que o usuário perca o contexto do que escreveu (a lacuna que desqualifica o NVDA para usuários com visão e deficiências cognitivas). Ative em Configurações → `speakOnSentenceEnd` (ativado por padrão).
- **Destaque palavra por palavra enquanto fala** — cada palavra falada é destacada com fundo amarelo à medida que o TTS faz a leitura. Usuários com visão e dificuldades de leitura podem acompanhar visualmente; o destaque acompanha o áudio sem necessidade de hardware adicional.

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- 5 posições de predição acima do teclado qwerty, atualizadas a cada tecla digitada
- Conclusão por IA ("ol" → "olá", "parir" → "para ir") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms em média, 4,3× mais econômico que o 2.5 Flash)
- Filtro entre idiomas: termos em romeno não vazam para a barra em inglês mesmo quando ambos os corpora estão carregados (comparação de frequência entre corpora)
- "Falar" utiliza adaptação automática de tom (declarativo / interrogativo / exclamativo inferido pela pontuação)
- Cadeia de reprodução de áudio: cache de fala persistente (reproduz sem nova requisição) → voz em nuvem pelo portal (Inworld TTS-2; Azure Neural para idiomas não suportados pelo Inworld; Gemini TTS como última opção na nuvem) → Web Speech do SO (offline) → espeak-ng via WASM (último recurso). Consulte [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) e [`docs/SPEECH_CACHE.md`](../../docs/SPEECH_CACHE.md)
- O destaque de palavras é estimado por duração (~60 ms/caractere a uma taxa=0,5, ajustando-se com o controle de velocidade) — funciona em todas as camadas de TTS sem mudanças no servidor; sincronização precisa via `wordBoundary` do Azure é um recurso Pro futuro.
- Corpus n-grama em SQLite de 1,5 MB por idioma; unigramas + bigramas + trigramas; carregado sob demanda ao trocar de idioma
- **Memória contextual HRR** — recuperação holográfica sem busca (229KB Rust WASM) que aprende com cada frase falada. Codifica bigramas + trigramas em um vetor holográfico; analisa em ~0,2ms a cada tecla. Camada aditiva — destaca as 2 primeiras posições de predição com correspondências contextuais sem remover as predições do corpus.

**Benchmark de predição HRR** (54 testes unitários + suíte de precisão com 10 cenários):

| Cenário | Base Top-1 | HRR+ Top-1 | Ganho | Base MRR | HRR+ MRR | Ganho MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Frases de CAA principais (1x) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Frases de CAA principais (5x/dia) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Vocabulário pessoal | 70,4% | 81,5% | **+15,8%** | 0,809 | 0,883 | +9,2% |
| Misto (todas as frases) | 47,2% | 56,9% | **+20.6%** | 0,669 | 0,707 | +5,7% |
| Lembrança entre sessões | 80,0% | 80,0% | +0,0% | 0,900 | 0,900 | +0,0% |
| Prefixos ambíguos | 66,7% | 66,7% | +0,0% | 0,738 | 0,738 | +0,0% |

Top-1 = palavra correta na posição #1. Top-5 = palavra correta em qualquer posição. MRR = Ranks Recíprocos Médios (quanto maior, mais cedo a palavra correta aparece). O HRR nunca reduz a precisão Top-5 em nenhum cenário — zero regressões. Maiores ganhos no vocabulário pessoal (+9,2% MRR) e frases principais de CAA (+27,3% Top-1).

**Caminho de renderização:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recorrência × frequência × ganho de n-grama) + camada opcional por IA `services/textCorrectService.ts` + análise de bigrama/trigrama HRR em `services/hrrContext.ts`. Destaque: `services/aacSpeak.ts` emite eventos `tts-highlight-start` no barramento `ttsHighlightBus`; `components/MessageBar.tsx` se inscreve e passa `activeWordIndex` para `ColoredText`.
</details>

---

### ✨ Chat de IA
Assistente no dispositivo + nuvem ajustado para a voz do usuário de CAA. Respostas em fluxo contínuo, onde cada linha pode ser inserida na barra de mensagem com um toque, garantindo a autoria da mensagem ao usuário. O plano gratuito é executado via Gemini 2.5 Flash; planos pagos direcionam para Claude Sonnet 4 com a frota prism-coder para consultas rápidas.

**Modo IA limpo** — a barra de predição de palavras é ocultada automaticamente quando o Chat de IA está aberto (predições não são relevantes ao compor uma pergunta), mantendo o foco na resposta da IA e no botão de envio.

**Chat de IA mãos livres** — ative o botão 🔁 no cabeçalho do chat para entrar em uma conversa contínua por voz: o microfone abre automaticamente após cada resposta da IA, permitindo manter um diálogo sem tocar na tela. Uma barra de status abaixo do cabeçalho confirma que o modo está ativo.

**Modo de tradução** — quando o idioma do aplicativo e o idioma de saída forem diferentes (ex.: entrada em português, saída em inglês), cada troca de mensagens é enviada automaticamente pelo caminho de tradução com transmissão em fluxo ativada, sem perda de velocidade em relação ao modo de um único idioma.

![Painel do Chat de IA — barra de predição oculta no modo IA, teclado completo acessível abaixo](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Painel embutido posicionado acima do teclado — sem janelas sobrepostas que ocultem a barra de mensagem
- Entrada de voz via Web Speech API; o botão do microfone mostra a transcrição em tempo real
- Toque em qualquer linha da IA para copiá-la para a barra de mensagem (preserva a autoria da mensagem — Valencia et al., CHI 2023)
- **Modo mãos livres contínuo** — botão 🔁 no cabeçalho; reativa o microfone 1 s após a conclusão de cada resposta da IA; `aria-pressed` + fundo verde confirmam o estado; barra de status visível abaixo do cabeçalho enquanto ativo
- **Palavra de ativação "Ei Prism"** — disponível na tela do Modo Leito; uma sessão contínua do `SpeechRecognition` detecta a frase e aciona o microfone; indisponível quando o canal nativo do iOS assume a sessão de áudio
- Tempo limite no cliente de 15s + botão Tentar Novamente (evitando que o painel fique travado em "Pensando...")
- Mapeamento para mensagens amigáveis em caso de erros 401 / rede / tempo limite; nunca exibe "Sessão expirada" sem tratamento
- Opção alternativa com Ollama local (`prism-coder:2b`) quando offline; origens do navegador `synalux.ai` possuem restrições de conteúdo misto, acionando a mensagem amigável de erro

**Caminho de renderização:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (ou `translateAI()` no modo de tradução) → fluxo SSE do Synalux `/api/v1/chat` com `credentials: 'include'`. CORS libera origens de desenvolvimento em `synalux.ai` + localhost.
</details>

---

### 🛏 Modo Leito

> **Recurso crítico de acessibilidade.** O Modo Leito foi criado para usuários que não possuem uma forma confiável de falar, digitar ou tocar na tela. A interface foi projetada para atender aos casos mais complexos: um paciente deitado em um leito de UTI, com braços ao lado do corpo, entubado, incapaz de produzir sons — comunicando-se exclusivamente pelo olhar ou por um único acionador posicionado entre dois dedos.

Interface de comunicação por IA em tela cheia otimizada para usuários que não conseguem alcançar a tela ou falar com clareza. Todos os alvos de toque são ampliados. A voz é apenas um dos caminhos de entrada — e não o único. A interface é totalmente operável por tecnologias assistivas: varredura por acionador, controle ocular, Controle por Voz do iOS, rastreamento cefálico ou teclado na tela navegado por um único acionador.

Desenvolvido com base no feedback direto da comunidade de CAA (r/AssistiveTechnology, maio de 2025) por usuários em leitos hospitalares, recuperação pós-cirúrgica e cuidados paliativos.

**Funciona no Mac / Windows?** Sim. O Modo Leito é um recurso de aplicativo web progressivo (PWA) — funciona em qualquer navegador de qualquer dispositivo. Não é exclusivo do iOS.

---

#### Para quem é indicado?

O Modo Leito foi projetado para usuários com diferentes níveis de mobilidade e fala. Os Cartões de Frases Rápidas (descritos abaixo) foram criados especificamente para situações de maior limitação — quando não há fala e os movimentos das mãos são restritos ou inexistentes.

| Perfil do usuário | Método de entrada recomendado |
|---|---|
| Consegue falar, movimentos de braços restritos | Voz (botão de microfone 🎙) + modo Mãos Livres |
| Produz sons, fala não compreensível por sistemas de reconhecimento | Palavra de ativação "Ei Prism" + modo Mãos Livres |
| Sem fala, consegue tocar na tela | Cartões de Frases Rápidas (toque único) |
| Sem fala, mobilidade reduzida — apenas um acionador | Varredura pelo Controle de Acionadores do iOS ou Android sobre os Cartões de Frases Rápidas |
| Sem fala, sem movimento nas mãos — dispositivo de controle ocular | Hardware de controle ocular (Tobii, EyeGaze Edge, etc.) que atua como ponteiro de mouse — todos os cartões são navegáveis |
| Sem fala, consegue mover a cabeça | Rastreamento cefálico (ex.: Cursor da Cabeça do iOS, Controle da Câmera no iPhone 16) — os cartões são alvos amplos de navegação |
| Traqueostomia / entubado, sem fonação | Cartões de Frases Rápidas via controle ocular ou acionador + modo assistido por cuidador |

---

#### Suporte por plataforma

| Plataforma | Modo Leito | Cartões Rápidos | Modo Mãos Livres 🔁 | Palavra de Ativação 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (qualquer navegador) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Apenas Safari |
| Aplicativo nativo iOS (App Store) | ✅ | ✅ | ✅ | ❌ use o Mãos Livres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispositivo de controle ocular (qualquer um — atua como mouse) | ✅ | ✅ | ✅ | ✅ |
| Varredura por acionador (Controle de Acionadores do iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Por que a palavra de ativação não funciona no app nativo iOS?** O canal nativo assume o controle da sessão de áudio (`prismNativeBridge.startVoice`), o que entra em conflito com a API `SpeechRecognition` do navegador utilizada pelo serviço de palavra de ativação. Use o **modo Mãos Livres** (🔁) como alternativa — ele reativa o microfone automaticamente 1 segundo após cada resposta da IA sem necessidade de novas ações.

---

#### Como iniciar

1. Abra o painel do **Chat de IA** — toque no ícone 🤖 na barra de ferramentas.
2. Toque em **🛏** no cabeçalho do painel — a tela cheia será exibida imediatamente.
3. Escolha o método de entrada desejado (veja as seções abaixo).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Tela do Modo Leito aberta — interface escura em tela cheia. A faixa superior exibe os Cartões de Frases Rápidas. A área central exibe as respostas da IA. A parte inferior traz o botão vermelho de microfone e a barra de controles." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Modo Leito com Mãos Livres ativo — botão 🔁 destacado em verde, texto 'Mãos Livres LIGADO' visível" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Botão do modo Mãos Livres ativado — fundo verde, aria-pressed=true" width="260">
</p>

#### Como encerrar / sair

- **Toque:** toque em **✕** no canto superior direito da tela (alvo de 48 × 48 px).
- **Teclado / acionador:** pressione **Escape**.
- **Voz:** diga um comando do Controle por Voz do iOS enquanto a tela estiver aberta.

Todo o histórico de conversa e o estado da sessão de IA são mantidos ao sair. A tela funciona como uma camada sobreposta ao painel principal — nada é perdido ao fechá-la.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Após fechar o Modo Leito — retorno ao painel principal do chat de IA com o histórico de conversa mantido" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barra de status do painel principal exibindo 'Ei Prism ativo' com indicador azul após retornar do Modo Leito" width="260">
</p>

---

### 🃏 Cartões de Frases Rápidas — para usuários não verbais e com mobilidade reduzida

> **Esta é a funcionalidade principal para usuários que não conseguem falar ou tocar na tela com facilidade.** Os Cartões de Frases Rápidas são botões de comunicação pré-configurados que podem ser ativados por toque único, fixação do olhar ou seleção por varredura. Sem digitação. Sem voz. Sem necessidade de internet para o uso.

Cada cartão exibe um ícone de emoji ampliado e uma frase curta. Tocar em um cartão carrega imediatamente a frase na barra de mensagem. Se o **modo Mãos Livres** estiver ativo, a frase é enviada para a IA automaticamente.

#### Cartões integrados

Quinze cartões vêm pré-carregados no primeiro uso, organizados por prioridade. Eles não podem ser excluídos e funcionam offline.

**Urgência (alta prioridade — comunicação primária em situações de emergência):**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| 🆘 | AJUDA — EMERGÊNCIA | Perigo imediato, chamada de emergência, necessidade de atendimento rápido |
| 😢 | Estou com dor | Dor de qualquer tipo — localização/intensidade podem ser detalhadas a seguir |
| 🫁 | Não consigo respirar | Dificuldade respiratória, desconforto nas vias aéreas |
| 🔔 | Chame a enfermagem | Solicitação de atendimento de rotina |

**Necessidades físicas:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| 💧 | Água, por favor | Sede, boca seca, auxílio para tomar medicação |
| 🔥 | Estou com muito calor | Febre, ajuste de cobertor, controle de temperatura |
| 🥶 | Estou com muito frio | Calafrios, pedido de cobertor, temperatura do ambiente |
| ↔️ | Mude minha posição | Alívio de pressão, conforto, reposicionamento pós-cirúrgico |
| 💊 | Preciso do meu remédio | Dose programada, medicação para dor |

**Comunicação:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| ✅ | Sim | Confirmação — responder perguntas diretas de sim/não |
| ❌ | Não | Recusa — responder perguntas diretas de sim/não |
| ⏳ | Espere, por favor | Solicitação de tempo — aguardar antes de prosseguir |

**Afetivo:**

| Ícone | Frase | Quando usar |
|:---:|---|---|
| ❤️ | Eu te amo | Expressão de afeto com familiares |
| 🙏 | Obrigado | Agradecimento |
| 😨 | Estou com medo | Ansiedade, receio, desconforto — aciona resposta acolhedora da IA |

#### Como usar os Cartões de Frases Rápidas

**Toque único / fixação do olhar / seleção por acionador:**
Ativar um cartão insere seu texto na barra de mensagem. A frase pode ser:
- Enviada à IA para uma resposta contextualizada (ex.: tocar em "Estou com medo" → a IA responde com mensagens de tranquilização e faz perguntas simples)
- Lida diretamente — cuidadores presentes no local podem visualizar o cartão selecionado na tela

**Com o modo Mãos Livres ativo:**
A frase é enviada à IA no momento em que o cartão é tocado. O microfone é reativado 1 segundo após a resposta da IA — estabelecendo um fluxo contínuo sem ações adicionais.

**Com a palavra de ativação "Ei Prism" ativa (web / desktop):**
É possível combinar a palavra de ativação com os Cartões Rápidos: o usuário diz "Ei Prism" para abrir o microfone, a IA responde e o usuário pode tocar em um cartão para dar sequência à conversa sem precisar falar novamente.

#### Como adicionar cartões personalizados

Cuidadores, profissionais de saúde e familiares podem adicionar cartões personalizados de acordo com as necessidades do usuário — nomes de médicos, frases frequentes, descrições específicas de dor, expressões religiosas ou qualquer outra necessidade.

**Passos:**

1. No Modo Leito, toque em **＋ Adicionar** ao final da faixa de Frases Rápidas.
2. Digite a frase desejada para o cartão (até 80 caracteres).
3. Toque em **Adicionar Cartão** — a IA gera automaticamente um ícone de emoji correspondente ao significado da frase (ex.: "Preciso de mais cobertas" → 🛏, "Quero fazer uma oração" → 🤲).
4. O ícone é exibido após uma breve animação de "✨ Gerando...", e o cartão é salvo.

Cartões personalizados são salvos localmente no dispositivo (localStorage). Eles permanecem salvos entre sessões e reinicializações do aplicativo. Não é necessária conta ou conexão com a internet para usar os cartões salvos — apenas a geração inicial do ícone exige acesso à rede.

**Exemplos de cartões personalizados:**

| Frase sugerida | Motivo |
|---|---|
| `[Nome do médico], venha por favor` | Acesso direto ao profissional específico em vez de uma chamada geral |
| `Preciso falar com minha família` | Necessidade de contato com acompanhantes ou responsáveis |
| `Apague as luzes, por favor` | Sensibilidade à luz, enxaqueca, descanso |
| `Quero fazer uma oração` | Suporte espiritual e conforto |
| `Tem algo errado` | Alerta de desconforto geral — orienta a IA a fazer perguntas de checagem |
| `Preciso da aspiração` | Pacientes com traqueostomia ou em ventilação mecânica |
| `Meu soro está doendo` | Alerta para verificação de acesso venoso |
| `Quero ir para casa` | Conversas sobre alta ou cuidados paliativos |

#### Como excluir cartões personalizados

1. Toque em **✏️ Editar** no cabeçalho da faixa de Frases Rápidas.
2. Um ícone vermelho **✕** aparecerá em cada cartão personalizado (cartões integrados são protegidos e não podem ser removidos).
3. Toque no ✕ do cartão que deseja remover.
4. Toque em **Concluído** para finalizar a edição.

#### Configuração para varredura por acionador (iOS)

Para usuários que utilizam um único acionador externo (sopro/aspiração, acionador de cabeça, pé ou almofada):

1. Conecte o acionador ao iPhone/iPad via Bluetooth ou porta Lightning/USB-C.
2. Vá em **Ajustes → Acessibilidade → Controle por Acionadores → Acionadores** e defina o acionador para "Selecionar Item".
3. Vá em **Controle por Acionadores → Estilo de Varredura** e escolha "Varredura Automática" — o sistema destacará os itens um a um.
4. Abra o Prism AAC no Modo Leito. O Controle por Acionadores fará a varredura pelos Cartões de Frases Rápidas. Pressione o acionador quando o cartão desejado estiver em destaque.
5. A frase será enviada imediatamente — sem etapas adicionais.

> Todos os Cartões de Frases Rápidas possuem o atributo `data-scan-group="quick-cards"` para que as tecnologias assistivas realizem a varredura em grupo na faixa antes de passar para outras áreas da interface.

#### Configuração para controle ocular

Dispositivos de controle ocular (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) são reconhecidos pelo sistema operacional como um cursor de mouse padrão com clique por fixação. Não são necessárias configurações especiais no Prism AAC:

1. Configure o tempo de fixação (dwell) no software do seu dispositivo de controle ocular (recomendado: 800–1200 ms para novos usuários).
2. Abra o Prism AAC no Modo Leito em qualquer navegador.
3. Fixe o olhar sobre um Cartão de Frase Rápida para ativá-lo.

O tamanho mínimo do cartão (88 × 80 px) atende ao requisito de tamanho de alvo WCAG 2.5.5 AAA de 44 × 44 px CSS, e supera o mínimo recomendado para interação por olhar (60 × 60 px).

---

<details>
<summary><strong>Todos os recursos + detalhes técnicos de implementação</strong></summary>

**Cinco subsistemas integrados em um único recurso:**

1. **Cartões de Frases Rápidas** — `services/bedsideCards.ts` + interface da faixa em `components/BedsideOverlay.tsx`.

   - Armazenamento: chave `prism_bedside_cards_v1` em `localStorage`. Esquema validado a cada carregamento — entradas incorretas são desconsideradas.
   - Limite: máximo de 50 cartões personalizados (evita crescimento descontrolado do armazenamento).
   - Cartões integrados: 15 entradas com `id` iniciado por `builtin-`; a verificação de exclusão checa este prefixo antes de exibir o ícone ✕, garantindo que os cartões padrão nunca sejam removidos.
   - Geração de ícone por IA: `services/aiService.ts → inferCardIcon(text)`. Utiliza a mesma rota Ollama local → nuvem Synalux do restante do aplicativo. Envia a frase como mensagem do usuário com uma instrução fixa de sistema ("Responda com exatamente um emoji..."). Extrai o primeiro código Unicode da resposta. Sempre entrega um resultado — utiliza 💬 em caso de erro de rede ou resposta sem emoji.
   - Uso offline: cartões funcionam completamente offline; apenas a inclusão de um novo cartão requer acesso à rede (para geração do ícone — utiliza 💬 caso esteja offline).

2. **Modo Mãos Livres por IA (🔁)** — também acessível pelo cabeçalho do chat de IA principal. Após cada resposta da IA, o microfone é reativado automaticamente (intervalo de 1 s). A estrutura com `handsFreeRef` / `startListeningRef` garante que a ação execute a função atualizada sem reiniciar a cada renderização.

   ![Barra de status do modo Mãos Livres no painel principal de IA](e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Tela do Modo Leito** — interface escura em tela cheia `fixed inset-0 z-50 bg-black` renderizada como um elemento irmão `<Fragment>` ao lado do painel de IA principal, preservando o estado do painel entre aberturas e fechamentos. Acessibilidade: `role="dialog"`, `aria-modal="true"`, `aria-label="Modo Leito"`, retenção de foco WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab alternam elementos dentro da tela, `Escape` fecha). Cobertura da área de exibição verificada por testes E2E (tolerância ≤ 4 px).

   - **Botão de microfone ampliado** — 112 × 112 px (`w-28 h-28`), vermelho e pulsante enquanto ouve, com borda branca em repouso. Verificado ≥ 96 px pelo `boundingBox()` do Playwright.
   - **Faixa de Cartões Rápidos** — linha com rolagem horizontal, cada cartão medindo `88 × 80 px`, atributo `data-scan-group="quick-cards"` para varredura por acionador, semântica `role="list"` / `role="listitem"` para leitores de tela.
   - **Barra de controles** — Mãos Livres (verde quando ativo), Palavra de Ativação "Ei Prism" (azul quando ativa, oculta quando `!wakeWordSupported`), atalho do Controle por Voz do iOS.
   - **Sair** — botão ✕ (`w-12 h-12`) ou `Escape` → `onClose()` → `bedsideModeActive = false` no `AIChatPanel` → foco retornado de acordo com WCAG 2.4.3 para o botão 🛏 que abriu a tela.

   ![Tela do Modo Leito — fechada, retorno ao painel principal de IA](e2e/_screenshots/bedside-overlay-closed.png)

4. **Palavra de ativação "Ei Prism"** — `services/wakeWordService.ts`. Executa uma sessão contínua do `SpeechRecognition` em segundo plano. Detecta transcrições que contenham "ei prism", aciona o microfone uma vez e se reconfigura para o ciclo seguinte. Proteção: não é iniciada quando a integração nativa do iOS controla o microfone (presença de `prismNativeBridge?.startVoice`). O estado ativo da palavra de ativação é exibido na barra de status do painel principal após fechar a tela.

   ![Barra de status exibindo "Ei Prism" ativo](e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Guia do Controle por Voz do iOS** — tocar no ícone 📱 na barra de controles tenta executar `prismNativeBridge.openSettings('accessibility')` (direciona para as configurações de Acessibilidade em versões nativas compatíveis). Na web ou desktop, exibe um cartão com instruções passo a passo mostrando o caminho `Ajustes → Acessibilidade → Controle por Voz → Ativado`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Cartão de instruções do Controle por Voz do iOS — guia passo a passo exibido no Modo Leito ao tocar no ícone 📱 na web/desktop" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Cartão de instruções do Controle por Voz do iOS após ser fechado — a tela retorna ao layout normal do Modo Leito" width="260">
   </p>

**Cobertura de testes:**
- `services/bedsideCards.test.ts` — 22 testes unitários: conjunto de cartões padrão, ciclo de leitura/escrita em localStorage, tratamento de JSON incorreto, remoção de cartões inválidos, limite de 50 cartões, restrições de campo em `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 testes E2E com Playwright: visibilidade de botões, alternância de `aria-pressed`, classes de estado verde/azul, texto da barra de status, atributos de acessibilidade da tela, tamanho do botão de microfone via `boundingBox`, cobertura da área de exibição, exibição e fechamento do cartão de instruções.

**Arquivos principais:**
- `components/AIChatPanel.tsx` — estado do modo leito, estado dos cartões (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, ciclo do modo mãos livres, ciclo da palavra de ativação, botões do cabeçalho
- `components/BedsideOverlay.tsx` — interface da tela, faixa de Cartões Rápidos, caixa de inclusão de cartão, modo de edição, retenção de foco, cartão de instruções do controle por voz
- `services/bedsideCards.ts` — tipo `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — definição de emoji por IA
- `services/wakeWordService.ts` — detecção contínua da frase de ativação
</details>

---

### 📨 Enviar mensagem — seletor de meio de envio
Quando um contato possui múltiplos meios configurados (ex.: E-mail e SMS), uma seção **"Enviar por"** é exibida acima da área de digitação. Um toque altera o meio de envio antes da escrita — sem necessidade de sair do painel.

![Seletor de meio de envio do contato — linha 'Enviar por' com E-mail destacado em verde, SMS disponível](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat CAA
Mensagens recebidas de canais conectados (Telegram, WhatsApp, E-mail, Slack, etc.) chegam a este painel. O contador de não lidas na barra de ferramentas exibe a quantidade, o alerta sonoro e as notificações entre abas são acionados quando uma nova mensagem chega, e tocar em uma linha da mensagem a copia para a barra para que a criança responda com sua própria voz.

![Painel do Chat CAA exibindo mensagens recebidas de cuidadores com contador de não lidas](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Caixa de entrada verificada periodicamente pelo portal Synalux `/api/v1/prism-aac/inbox/poll` (sem ação em caso de erro 404 se o portal não estiver configurado)
- Notificação entre abas via `BroadcastChannel` ao receber novas mensagens
- Abstração de canais: adicionar Outlook / Slack / Discord exige cerca de 30 linhas de código para cada um
- O status de leitura é sincronizado de volta para que os cuidadores saibam quando a criança leu a mensagem
- Plano gratuito: 1 canal conectado; plano pago: ilimitado
- Conversão de texto em fala (TTS) por mensagem para que a criança possa ouvir o texto recebido com sua voz preferida

**Caminho de renderização:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (verificação a cada 5s quando sidePanel === 'aac-chat', e a cada 60s nos demais casos) → `useScheduleStore.setIncomingMessages()`. Cada mensagem também é adicionada à rotina na seção "Mensagens dos cuidadores".
</details>

---

### 🧮 Matérias escolares
Tela em grade contendo **19 teclados temáticos** que cobrem o currículo do ensino fundamental e médio: matemática + ciências + programação + artes + ciências humanas. Cada aba direciona o tutor de IA através de um modelo de instrução específico da área (33 modelos no total) para evitar que a IA aplique regras de álgebra em um quadro de punnett ou confunda uma indicação musical com um valor de programação. **O histórico adapta-se à região e ao idioma**, abrangendo divisões estaduais / provinciais / regionais — cobrindo mais de 280 regiões em 23 países.

![Tela em grade com a equação 5 + 7 = 12 preenchida nas células](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Abas de matérias (19 no total)</strong></summary>

**Matemática (9 teclados)** — Principal, Mat. Avançada (π √ expoentes + 5 ferramentas de estruturação: fração, divisão longa, raiz, somatório, barra de fração), a–z, Mat. Geral (teoria dos conjuntos + lógica), Tempo e Distância, Peso, Volume, Geometria, Moedas.

**Ciências (4)** — Química (24 elementos + setas de reação + cargas + subscritos + indicadores de fase), Física (alfabeto grego completo + 16 unidades do SI + symbols de cálculo ∫/∂/∇/∑/∏ + constantes), Biologia (DNA/RNA + genética + 8 níveis taxonômicos + 12 organelas), Estatística (μ σ x̄ + 12 operadores + distribuições).

**Programação (2)** — Python (24 operadores + 26 palavras-chave) e Java (24 operadores + 26 palavras-chave). O código insere um caractere por célula para alinhamento correto na grade.

**Artes + Ciências Humanas (4)** — Música (3 claves + 6 notas + 5 pausas + 5 acidentes + 8 indicações de intensidade), Ciências da Terra (clima + placas tectônicas + 10 corpos celestes + unidades astronômicas e de tempo), História (com adaptação regional e de idioma), Língua Portuguesa/Linguagens (12 classes gramaticais + 6 tipos de frases + pontuação + estilos de citação).

</details>

<details>
<summary><strong>Tutor de IA — 11 áreas × 3 modos = 33 instruções de modelo</strong></summary>

![Janela do tutor de IA com dica explicativa posicionada sobre a tela](../../docs/screenshots/math-tutor-hint.png)

Três modos por matéria: 💡 **Dica** (orientação passo a passo, sem dar a resposta direta), ✓ **Verificar** (avalia a resposta da criança, confirmando se estiver correta), 🎓 **Resolver** (explicação detalhada do passo a passo, em no máximo 4 etapas). A aba ativa define o contexto do assunto para o tutor. Tempo limite de 15 s + botão Tentar Novamente para evitar travamentos.
</details>

<details>
<summary><strong>Histórico — adaptado ao idioma e à região</strong></summary>

![Teclado de História no idioma inglês (sem região definida) — níveis geral e nacional](../../docs/screenshots/math-keyboard-history-en.png)
![Teclado de História com região US-TX selecionada — eventos locais em destaque](../../docs/screenshots/math-keyboard-history-us-tx.png)

Três níveis integrados:
1. **Geral**: eventos históricos universais presentes nos currículos escolares (476, 1ª Guerra de 1914, 2ª Guerra de 1939, chegada à Lua em 1969)
2. **Nacional**: eventos selecionados pelo `idioma` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 idiomas suportados
3. **Regional**: eventos definidos por `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, BR-SP, ...) — **mais de 280 regiões em 23 países** incluindo todos os 50 estados dos EUA + DC, 13 províncias/territórios do Canadá, as 4 nações do Reino Unido, Irlanda, os 16 estados da Alemanha, as 17 comunidades autônomas da Espanha, as 20 regiões da Itália, estados do Brasil, além de AU, FR, MX, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

A instrução do tutor inclui a localização para que datas históricas sejam contextualizadas corretamente (ex.: o ano de 1822 no contexto do Brasil relaciona-se à Independência; em outras regiões, associa-se aos eventos locais correspondentes).

</details>

<details>
<summary><strong>Fluxos de teste — 12 matérias × problemas do ensino fundamental e médio × 72 testes Playwright</strong></summary>

Roteiros de problemas resolvidos passo a passo cobrindo cada teclado temático, acompanhados de testes automatizados com Playwright para validar a inserção dos símbolos na grade de células.

- **Camada 1 — passo a passo por matéria:** [`tests/workflows/`](../../tests/workflows/) — 12 arquivos explicativos (matemática avançada, biologia, química, ciências da terra, geometria, história, linguagens, matemática geral, física, programação java, programação python, estatística).
- **Camada 2 — exercícios práticos por nível escolar:** [`tests/workflows/grade-8-12/`](../../tests/workflows/grade-8-12/) — 12 roteiros de exercícios práticos (álgebra, geometria, física, química, biologia, estatística, programação python, programação java, pré-cálculo, ciências da terra, linguagens, história mundial) + relatório de mapeamento de teclados [`REPORT.md`](../../tests/workflows/grade-8-12/REPORT.md).
- **Camada 3 — testes E2E com Playwright:** [`e2e/math-workflows/`](../../e2e/math-workflows/) — 72 testes executáveis (`npx playwright test --project=desktop e2e/math-workflows`).

Índice completo e orientações para inclusão de novos roteiros de teste → **[`docs/WORKFLOWS.md`](../../docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Outros recursos de matemática (ferramenta de bloqueio, ampliação em dois toques, salvar / sincronizar)</strong></summary>

- **Ferramenta de bloqueio** — ao concluir um exercício, bloqueie a área desejada. Células bloqueadas aparecem suavemente escurecidas e não aceitam edições.
- **Ampliação em dois toques** — o primeiro toque destaca a tecla (ampliação de 1,4× + contorno verde), o segundo toque confirma a inserção. Cancelamento automático após 2 s. Recomendado para usuários com precisão motora reduzida.
- **Salvar e sincronizar** — armazenamento local em `localStorage`; sincronização opcional com o portal Synalux pelo botão `↻ Sincronizar`. Limite de 100 documentos / 200 KB de tamanho; documentos mais antigos são substituídos.
- **Tempo de fixação por toque** — tempo configurável por tecla (0–1500ms) com indicador visual circular de progresso.

![Janela de documentos salvos exibindo um item e o botão de Sincronizar](../../docs/screenshots/math-docs-overlay.png)
![Tecla numérica ampliada com contorno verde indicando pré-seleção](../../docs/screenshots/math-two-hit-armed.png)
![Ferramenta de bloqueio ativa orientando a seleção dos cantos da área](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Teclados por matéria — imagens adicionais</strong></summary>

![Teclado de Química com a fórmula H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Teclado de Biologia com as bases A T G](../../docs/screenshots/math-keyboard-biology.png)
![Teclado de Java com a estrutura `private String`](../../docs/screenshots/math-keyboard-java.png)
![Teclado de Música](../../docs/screenshots/math-keyboard-music.png)
![Teclado de Estatística](../../docs/screenshots/math-keyboard-statistics.png)
![Teclado de Ciências da Terra](../../docs/screenshots/math-keyboard-earth-science.png)
![Teclado de Linguagens](../../docs/screenshots/math-keyboard-language-arts.png)
![Teclado de História configurado para a Romênia](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Rotina
Painel visual de rotinas "primeiro-depois" para apoio na organização de tarefas e transições. Cada etapa traz uma imagem + texto; ao concluir um item, um sinal sonoro suave é emitido junto ao indicador visual de conclusão. Uma área de recompensas (plano pago) pode ser desbloqueada ao final da sequência.

![Painel de rotinas com prancha primeiro-depois e lista de atividades](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Grade de 24 atividades pré-configuradas para inclusão rápida com um toque: acordar, escovar os dentes, tomar café, ir para a escola, lanche, almoço, brincar, ler, artes, passear, jantar, banho, história para dormir, dormir, medicação, passar fio dental, organizar brinquedos, lavar roupa, cuidar do pet, esportes, ...
- Reordenação por arrastar e soltar; edição direta de textos pelo ícone de lápis; os itens padrão possuem chaves `textKey` para tradução automática ao alterar o idioma do aplicativo
- Mapeamento de estados do fluxo: destaque no item ativo, sinal sonoro suave ao finalizar contagens de tempo, adaptação para redução de movimento (`prefers-reduced-motion` → indicador estático), acessibilidade via `aria-pressed`
- Inicialização de áudio: sinal contínuo em frequência inaudível mantém o Contexto de Áudio ativo no Safari do iOS para garantir a reprodução do sinal sonoro após períodos de inatividade

**Caminho de renderização:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 atividades padrão + personalizadas) → `services/feedback.ts:playTimerRing()` → Contexto de Áudio compartilhado via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jogos
12 jogos educativos voltados para CAA. Desenvolvidos para estimular o aprendizado da comunicação, **evitando o uso focado apenas em entretenimento de tela**. Cada jogo registra as expressões utilizadas e a taxa de acerto para que o mecanismo adaptativo possa sugerir a atividade mais adequada a seguir.

![Painel de jogos com 9 opções visíveis](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Os 12 jogos + detalhes técnicos</strong></summary>

| Jogo | Habilidade trabalhada |
|---|---|
| Estourar Bolhas | Causa e efeito, comunicação intencional |
| Caça às Cores | Vocabulário receptivo (nomes das cores) |
| Minha História | Sequenciamento de narrativas |
| Combinar | Associação de elementos e categorização |
| Sim / Não | Discriminação binária, pedir e recusar |
| Complete a Frase | Conclusão de frases (contexto) |
| Organizar Categorias | Categorização semântica |
| Identificar Emoções | Reconhecimento de expressões e teoria da mente |
| O Que Vem A Seguir | Raciocínio sequencial |
| Igual / Diferente | Discriminação visual — comparação e contraste |
| Qual É O Som? | Discriminação auditiva e vocabulário |
| Minha Vez, Sua Vez | Treino de alternância de turnos sociais |

- Todos os 12 jogos são gratuitos; nenhuma opção depende de plano pago
- Os dados de uso de cada jogo alimentam o sistema `services/adaptiveEngine.ts` — tamanho da frase / categoria / horário / resultado → indica a próxima sugestão de jogo
- Os jogos ocultam temporariamente as categorias da prancha de CAA que não sejam relevantes ao contexto da atividade, mantendo a atenção no objetivo principal

**Caminho de renderização:** `components/GamesPanel.tsx` → componentes de jogos em `components/games/`. Cada jogo registra ações via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Marketplace
Pacotes de voz (vozes Inworld, voz personalizada de familiares ou cuidadores), pacotes de vocabulário (vocabulário básico, comunicação com suporte a gestos), pacotes de jogos (atividades adicionais além das 9 padrão). Os itens instalados aparecem na barra de ferramentas usando o mesmo sistema dos painéis do aplicativo.

![Painel do marketplace exibindo aplicativos disponíveis para instalação](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Os aplicativos são definidos em arquivos JSON (`lib/marketplace/manifests/local.ts`) com gerenciamento por `lib/marketplace/registry.ts` executando `getHandler(appId)` para abrir o componente correspondente
- Clonagem de voz (plano pago): gravação de 90 segundos → voz gerada disponível para todas as leituras de texto do aplicativo, incluindo os cartões das categorias
- Aplicativos instalados adicionam botões na barra de ferramentas após os itens padrão; o estado é mantido em `useSettingsStore.installedApps`
- Controle por plano: o marketplace exibe todos os pacotes disponíveis, mas desativa o botão de instalação para itens acima do nível do plano ativo

**Caminho de renderização:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → comunicação com o servidor em `synalux/api/v1/marketplace/...` para liberação do item, seguido do download (arquivos de áudio, dados de vocabulário em JSON) para o IndexedDB local.
</details>

---

### 📄 Leitor de PDF
Abra um documento em PDF, visualize um cartão por página e toque para ouvir a leitura com a voz configurada. Atividades escolares, comunicados, artigos — carregue o arquivo PDF e acompanhe por áudio sem necessidade de leitura direta na tela. Sem dependência do Adobe Reader; a conversão ocorre inteiramente no navegador.

![Painel do Leitor de PDF — tela inicial com o botão "+ Abrir PDF"]](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Um cartão para cada página; mostra as 3 primeiras linhas + o botão `▶ Página N` que envia o texto para o `aacSpeak()` (mesma voz, tom e destaque de palavras do restante do aplicativo)
- O botão `▶ Ler tudo` junta o conteúdo de todas as páginas em uma leitura contínua
- A identificação de páginas sem texto selecionável (PDFs gerados por imagem/escaneados) sugere o uso da ferramenta de OCR
- O módulo `pdfjs-dist` é carregado sob demanda no primeiro uso — baixado separadamente via CDN, com versão alinhada ao pacote do projeto
- O botão na barra de ferramentas (📄) pode ser ativado em Configurações → Barra de ferramentas para manter a interface inicial simples

**Caminho de renderização:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (módulo pdfjs `getDocument` → `getTextContent` por página) → `services/aacSpeak.ts`.
</details>

---

### 👁 Leitor de Captura de Tela (OCR)
Cole ou envie a foto de um exercício, imagem de página web ou foto de um livro — o texto reconhecido aparece ao lado da imagem. Toque em **▶ Falar** para ouvir o conteúdo ou em **↧ Enviar para barra** para ajustar o texto antes da leitura.

![Painel do Leitor de Captura de Tela (OCR) — tela inicial com o botão "+ Abrir imagem"]](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- Tabela de 20 idiomas para OCR associando as opções do PrismAAC aos códigos do Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Os dados de reconhecimento de cada idioma são salvos em cache após o primeiro download (~10 MB para inglês, valores superiores para caracteres orientais) — o uso inicial exibe a mensagem "Lendo a imagem... (o primeiro uso baixa o modelo de OCR — pode levar de 10 a 30 s)"
- A porcentagem de precisão é exibida para que o usuário avalie a qualidade do texto capturado
- O processo de limpeza em `disposeOcr()` encerra os serviços em segundo plano ao fechar a página para liberar memória WASM
- O botão na barra de ferramentas (👁) pode ser ativado em Configurações → Barra de ferramentas

**Caminho de renderização:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` ou `messageStore.setText`.
</details>

---

### 🎧 Tocador de Conforto

Reprodutor de mídia de leito para pacientes hospitalizados — pessoas em coma, UTI, não verbais ou qualquer pessoa que necessite de conteúdo reconfortante contínuo no leito.

<details>
<summary>Detalhes dos recursos</summary>

Familiares e amigos podem gravar mensagens de voz, enviar fotos e vídeos. A lista de reprodução é executada em ciclo contínuo, mantendo vozes e rostos familiares sempre próximos ao paciente.

- **Grave** mensagens de áudio diretamente no aplicativo (usando a API MediaRecorder)
- **Envie** arquivos de áudio, fotos e vídeos (até 100 MB por arquivo, limite total de 500 MB)
- **Repetição automática** de todos os itens de forma contínua
- Modo de **Tela Cheia** para exibição de fotos e vídeos (uso em suporte de leito)
- **Sintetizador nativo (TTS)** integrado — toques em frases utilizam o AVSpeechSynthesizer no iOS
- **Funcionamento offline** — todas as mídias são salvas no IndexedDB local, sem necessidade de internet
- **Acessível por teclado** — todos os botões possuem rótulos ARIA e navegação por teclado
- **Análise de segurança realizada** — 27 pontos de segurança ajustados (gestão de URLs temporárias, tratamento de limites de espaço, validação de arquivos, restrição de formatos, limpeza de memória)
- O botão na barra de ferramentas (🎧) pode ser ativado em Configurações → Barra de ferramentas

**Limites de armazenamento:** máximo de 50 itens, 100 MB por arquivo, 500 MB no total. Formatos permitidos: áudio (webm/mp4/mpeg/ogg/wav), imagem (jpeg/png/gif/webp/heic) e vídeo (mp4/webm/quicktime).

**Caminho de renderização:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persistência) → `services/comfortMediaStorage.ts` (armazenamento de arquivos no IndexedDB).
</details>

---

### 🧩 Extensão do Chrome — os mesmos recursos de assistência à leitura em qualquer campo de texto
O aplicativo web do PrismAAC atende aos recursos de assistência à leitura dentro da sua própria interface. A extensão para Chrome (`chrome-extension/`) leva **a mesma experiência para QUALQUER campo de texto em QUALQUER site** — Gmail, Google Docs, Word Online, portais escolares, formulários de bancos — cobrindo o uso fora das páginas do aplicativo.

![Assistente de leitura PrismAAC — leitura enquanto digita, com destaque palavra por palavra, em qualquer campo de texto](../../docs/screenshots/extension-marquee.png)

O painel suspenso é posicionado sobre o campo de texto selecionado. Toque em **▶ Falar** para ouvir novamente ou continue digitando — ao finalizar uma frase com `.?!`, o texto é lido automaticamente com destaque em amarelo a cada palavra falada:

![Painel do PrismAAC sobre uma caixa de texto, no meio da frase com a palavra "escola" destacada em amarelo durante a leitura](../../docs/screenshots/extension-overlay.png)

A tradução durante a leitura mostra TANTO a frase original (em formato menor) QUANTO a frase traduzida (em tamanho normal, com destaque na palavra falada). Suporte a mais de 50 idiomas utilizando a API pública do Google (sem necessidade de chave):

![Painel do PrismAAC traduzindo de inglês para romeno — frase original "I had a really good day at school today" com a tradução "Am avut o zi foarte bună la școală astăzi" abaixo, com a palavra "foarte" destacada](../../docs/screenshots/extension-translate.png)

Página de opções — as configurações são sincronizadas na conta do Chrome do usuário via `chrome.storage.sync`. Lista de sites desativados, seletor de voz, controles de velocidade / volume / tom, seletores de idioma, todos configuráveis:

![Página de opções da extensão PrismAAC — opções de leitura, idioma de destino romeno, seletor de voz, controles de velocidade/volume/tom](../../docs/screenshots/extension-options.png)

**Instalação (modo desenvolvedor):**

```sh
cd chrome-extension
npm install
npm run build
```

Acesse `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta `chrome-extension/dist`.

**Recursos:**

- Leitura da frase ao digitar `.?!`, leitura de cada palavra ao pressionar a barra de espaço, opções configuráveis
- **Destaque palavra por palavra** utilizando o evento nativo `SpeechSynthesisUtterance.boundary` do navegador (sincronização por palavra, em comparação com a estimativa do app web — conexões em nuvem enviam áudio MP3 sem eventos de posição, enquanto a API nativa do navegador informa a posição exata)
- **Tradução durante a leitura** — escolha o idioma de destino (mais de 50 idiomas suportados via API pública do Google, sem necessidade de chave). O painel exibe TANTO a frase original (em formato menor) QUANTO a frase traduzida (com destaque na palavra falada); uma voz correspondente ao idioma de destino é selecionada automaticamente
- Painel suspenso em Shadow-DOM sobre o campo ativo (▶ Falar, 📌 Fixar, × Fechar)
- Atalho `Cmd / Ctrl + Shift + S` para ler o campo ativo no momento; `Esc` interrompe a leitura
- Lista de sites desativados para formulários bancários ou campos privados
- Configurações sincronizadas na conta do Chrome via `chrome.storage.sync` — sem necessidade de conta no PrismAAC

**Privacidade:** o uso sem tradução funciona offline (a síntese de voz do navegador opera localmente). O modo de tradução realiza uma chamada HTTPS por frase única para `translate.googleapis.com` (com armazenamento em cache após a primeira consulta). Código-fonte disponível em [`chrome-extension/`](../../chrome-extension/) — desenvolvido em TypeScript com empacotamento via esbuild (script de conteúdo com 18 KB, página de opções com 7 KB, segundo plano com 339 B).

---

### 👋 Gestos mãos livres
Entrada opcional por câmera para usuários que não conseguem tocar na tela com facilidade. Seleção por tempo de fixação do olhar/cabeça + perfis de gestos manuais. Processamento local — nenhum vídeo sai do dispositivo.

<details>
<summary><strong>Recursos + detalhes técnicos</strong></summary>

- **Modo básico**: rastreamento de posição da cabeça (FaceLandmarker, Mediapipe). O usuário direciona o olhar para a opção e mantém a posição pelo tempo configurado em `headTrackingDwellMs` (padrão de 1200 ms) → confirma a seleção. Um círculo visual se preenche durante a contagem.
- **Modo avançado**: rastreamento de gestos manuais. Perfis de gestos personalizáveis por usuário (mão aberta = confirmar, mão fechada = apagar, gesto de pinça = espaço, etc.) configurados em `components/HandCalibration.tsx`.
- Proteção contra desvio de posição: se a posição da cabeça do usuário variar mais do que o limite de `headTrackingDriftThresholdPx` ao longo de quadros consecutivos definidos em `headTrackingDriftWindowMs`, o rastreamento é pausado automaticamente e exibe uma orientação para nova calibração (ajuste realizado em maio de 2026: evita que o rastreamento perca a referência ao longo do uso).
- **Atalho de saída pela tecla Esc** — pressionar Esc em qualquer teclado desativa o rastreamento imediatamente e exibe o teclado tradicional sem alterar o texto contido na barra de mensagem.
- Instância única de câmera (`services/cameraStream.ts`) compartilhando o mesmo fluxo de imagem entre o rastreador cefálico e o manual; a alteração entre modos ocorre sem interrupções.
- A calibração do usuário fica salva no dispositivo; o rastreador retoma automaticamente ao reabrir o aplicativo.

**Documentação detalhada:** [`docs/TRACKING_MATH.md`](../../docs/TRACKING_MATH.md) (cálculos de calibração, aprendizado percentual, filtro One Euro, mais de 30 parâmetros de ajuste), [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 Contexto Visual — sugestão de frases acionada por câmera

Aponte a câmera do aparelho para objetos do dia a dia e a barra de predição exibirá frases relacionadas ao contexto. Copo e garfo sobre a mesa → "Quero mais", "Água, por favor", "Terminei". Uma cama → "Estou com sono", "Boa noite". Um livro → "Me ajuda, por favor", "Não entendi". **Recurso exclusivo do PrismAAC.**

| Cenário | Objetos identificados | Frases sugeridas |
|---|---|---|
| 🍽️ Refeição | copo, garfo, colher, prato/tigela, garrafa | "Quero mais", "Água, por favor", "Terminei", "Gostoso", "Está quente" |
| 😴 Hora de dormir | cama, urso de pelúcia | "Estou com sono", "Boa noite", "Lê uma história", "Um abraço, por favor" |
| 📚 Estudos / Escola | livro, laptop, teclado | "Me ajuda, por favor", "Não entendi", "Pronto", "Mais tempo" |
| 🎮 Brincadeira | urso de pelúcia, bola | "Quero brincar", "Minha vez", "Legal!", "De novo!" |
| 🛁 Banho e higiene | vaso sanitário, pia | "Preciso ir ao banheiro", "Lavar as mãos", "Me ajuda" |
| 📺 Assistindo TV | TV, controle remoto, sofá | "Quero assistir", "Pode desligar", "Está muito alto" |

As frases estão disponíveis em mais de 12 idiomas (Português, Inglês, Espanhol, Francês, Romeno, Ucraniano, Russo, Alemão, Japonês, Coreano, Chinês, Árabe e outros). O idioma acompanha a configuração do aplicativo — ao alterar para espanhol, a câmera sugerirá "Quiero más" em vez de "Quero mais".

![Contexto Visual — cenário de refeição identificado](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>Como funciona (técnica)</strong></summary>

**Estrutura de processamento:** Câmera (compartilhada via `cameraStream.ts`) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4 MB int8, WASM) → Análise do Cenário (regras determinísticas, 11 tipos de cenários) → Inserção na Barra de Predição (`setAiCompletion` + `learnWord` ordenação por n-grama).

**Desempenho:**
- Executa a **2 quadros por segundo** (uma análise a cada 500 ms) — economiza bateria, adequado para objetos estáticos
- Uso de processador: **< 6%** em dispositivos móveis
- Tamanho do modelo: **4 MB** (EfficientDet-Lite0 quantizado em int8, executado na estrutura WASM do MediaPipe)
- Uso de memória RAM adicional: **~5 MB** (modelo + buffers + vocabulário de frases)
- Controle de temperatura: reduz a frequência para 1 quadro por segundo → pausa por 30s em caso de aquecimento do dispositivo

**Privacidade:**
- Processamento 100% no dispositivo — as imagens da câmera **nunca saem do aparelho**, sem chamadas de nuvem
- Os resultados de identificação são **temporários** — não são salvos em localStorage nem na nuvem
- A identificação de `pessoas` ocorre internamente, mas **nunca é exibida** ao usuário nem utilizada para sugerir frases
- Nenhuma prévia de câmera é exibida na tela durante a identificação de objetos

**Segurança:**
- O recurso vem **DESATIVADO por padrão** — o cuidador deve ativá-lo em Configurações → Modos de Entrada → Contexto Visual
- Frases sugeridas pela visão **nunca são lidas automaticamente** — a criança precisa tocar/fixar o olhar para falar
- Frases de emergência permanecem em uma estrutura separada e **nunca são substituídas** por sugestões visuais
- O cenário precisa se manter estável por **3 quadros consecutivos** (~1,5s) antes da exibição — evita oscilações na tela

**Modelo de identificação de objetos:** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 classes COCO, hospedado na rede CDN do Vercel junto com os modelos de rosto e corpo do MediaPipe. Mesma estrutura WASM do rastreamento cefálico.

**Análise do cenário:** Mecanismo de regras determinísticas (sem modelos adicionais de IA). As regras associam combinações de objetos aos cenários com peso por horário do dia: `copo + garfo + colher` ao meio-dia = `refeição` (confiança de 0,90). 11 tipos de cenários, cada um com conjuntos de objetos e horários configuráveis.

**Inserção de predições:** Duas funções no `predictionStore`:
1. `setAiCompletion(phrase)` — posiciona a frase principal no primeiro bloco da barra de predição
2. `learnWord(word, prev)` — destaca o vocabulário do cenário por meio de n-gramas com multiplicador de uso

As sugestões visuais diminuem após 30 segundos se os objetos saírem do campo da câmera. A digitação ativa oculta as sugestões visuais (a intenção direta do usuário tem prioridade).

**Arquivos principais:**
- `services/objectDetectionService.ts` — captura da câmera, ciclo do MediaPipe, controle de temperatura
- `services/sceneInference.ts` — regras dos 11 cenários, ajuste por horário do dia
- `services/visionPredictionBridge.ts` — integração entre o cenário identificado e a barra de predição
- `constants/visionPhrases.ts` — frases organizadas por cenário em mais de 12 idiomas
- `constants/objectVocabulary.ts` — 30 rótulos de objetos COCO → termos traduzidos
- `store/visionStore.ts` — armazenamento temporário em Zustand (não persistido)
- `hooks/useVisionContext.ts` — integração entre identificação, barra e configurações

**Testes:** 62 testes unitários cobrindo regras de cenários, vocabulário de objetos, cobertura de idiomas nas frases, ciclo de vida dos dados e integração completa do fluxo (objetos → cenário → frases → armazenamento).

**Validação no Safari:**
```
CENÁRIO=refeição   CONFIANÇA=0.90 FRASES=Quero mais|Água, por favor|Terminei     SÍMBOLO=🍽️
CENÁRIO=dormir     CONFIANÇA=0.70 FRASES=Estou com sono|Boa noite|Lê uma história SÍMBOLO=😴
CENÁRIO=estudos    CONFIANÇA=0.80 FRASES=Me ajuda, por favor|Não entendi|Pronto SÍMBOLO=📚
```
</details>

---

### ⚙️ Configurações
25 idiomas / 28 variantes regionais, temas (claro / escuro / alto contraste), tamanho da grade (4 a 20 cartões), adaptações motoras (tempo de fixação para toque em matemática, ampliação em dois toques, tempo de fixação para rastreamento cefálico, sensibilidade de gestos, desativação por desvio), seletor de voz (gratuito para todos os usuários), uso de cache de fala, ativação de autocorreção por IA, notificações, personalização da barra de ferramentas, seletor de região histórica, Conta Synalux com o plano Cloud.

![Configurações — seletor de idioma + opção de tema](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Configurações de matemática + acessibilidade</strong></summary>

![Configurações — tempo de fixação em matemática + ampliação em dois toques](../../docs/screenshots/panel-settings-math.png)

- **Tempo de fixação para matemática** — seletor de 0 a 1500 ms; 0 = toque imediato, 200 a 1500 ms auxilia usuários com imprecisão motora (um indicador circular verde se preenche durante o tempo de toque).
- **Ampliação em dois toques** — o primeiro toque em qualquer tecla de matemática destaca a opção (ampliação de 1,4× + contorno verde, sem confirmar), o segundo toque confirma. Cancelamento automático após 2 s. Funciona de forma integrada com o tempo de fixação.
- **Tempo de fixação para rastreamento cefálico** — 200 a 5000 ms.
- **Sensibilidade** — nível de 1 a 10.
- **Desativação por desvio** — opção de ativação + limite (px) + tempo (ms).
- **Exibir calibração de mãos** — abre o editor de perfis de gestos manuais.

</details>

<details>
<summary><strong>Modos de entrada — voz, gestos, autocorreção por IA</strong></summary>

![Configurações — painel de modos de entrada](../../docs/screenshots/panel-settings-input-modes.png)

- **Entrada de voz** — Web Speech API com suporte ao idioma selecionado; disponível no plano gratuito
- **Autocorreção e Conclusão por IA** — pausas na digitação utilizam a autocorreção na nuvem (Gemini 2.5 Flash-Lite). Desativado por padrão em conexões de menor velocidade.
- **Notificações** — aviso sonoro + notificação entre abas para novas mensagens no Chat CAA.
- **Entrada por câmera** — controle geral para rastreamento de cabeça e mãos.
- **Modo de rastreamento por câmera** — cabeça, mãos ou identificação automática.

</details>

<details>
<summary><strong>Personalização da barra de ferramentas</strong></summary>

A barra de ferramentas pode ser reordenada. A versão 0.9.0 vem por padrão com um conjunto essencial (microfone, chat CAA, alerta, categorias, configurações) para manter a tela limpa para novos usuários — todos os demais recursos (matemática, chat de IA, rotina, jogos, marketplace, tocador de conforto, anotações, histórico, som) podem ser reativados com um toque em Configurações → Barra de ferramentas. Aplicativos instalados pelo marketplace são posicionados automaticamente após os itens nativos.

</details>

---

## Experimente

| | |
|---|---|
| 🌐 **Aplicativo Web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — acesse em qualquer navegador |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Código-fonte** | Este repositório. Licença AGPL-3.0 — altere e compartilhe livremente |

---

## Planos

Dois planos disponíveis: **Gratuito** e **Prism AAC Cloud**. Sem período de testes, sem necessidade de cartão de crédito para o plano Gratuito, sem cobranças adicionais automáticas.

| | Gratuito | Prism AAC Cloud — US$ 4,99/mês |
|---|---|---|
| Pranchas de comunicação, teclado e frases salvas | ✅ | ✅ |
| Vozes do dispositivo e cache de fala | ✅ | ✅ |
| IA no dispositivo e comunicação de emergência | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| Vozes naturais de fala geradas na nuvem | não incluído (disponível na rota pública até o início da medição) | 50.000 caracteres / mês |
| Requisições de IA na nuvem (chat, autocorreção, predição, tutor) | — | 100 / mês |
| Renovação da cota | — | Dia 1º de cada mês, às 00:00 UTC |

- Adquirido pelo aplicativo iOS (compras no app da Apple, StoreKit 2) ou pela web (Stripe); ambos concedem acesso à mesma conta e a uma assinatura ativa por conta. O cancelamento em uma plataforma não afeta o histórico da conta.
- A reprodução do cache de áudio e as vozes do próprio dispositivo não consomem a cota do plano. Quando a cota mensal é atingida, os recursos de voz em nuvem e IA em nuvem aguardam a renovação — a comunicação básica na prancha nunca é bloqueada.
- Configurações → Conta Synalux → **Fala e IA em Nuvem** exibe os detalhes do plano, uso da cota e termos de renovação, com as opções Assinar com a Apple, Restaurar compras da Apple, Gerenciar assinatura e Atualizar plano.
- Detalhes de integração em acompanhamento: (1) ajustes de predição de palavras, canais do Chat CAA, contatos de cuidadores, envio de SMS e dados estendidos de emergência são associados ao plano do app ativado via web (Stripe); (2) geração de imagens por IA e instalações do marketplace estão vinculadas ao plano geral da plataforma Synalux. O seletor de voz e todos os 12 jogos permanecem gratuitos para todos os usuários.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="App iOS: Configurações → Conta Synalux → Fala e IA em Nuvem — cota, termos de renovação, Assinar com a Apple · $4,99/mês, Restaurar compras da Apple" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="App Web: a mesma seção com opção de Assinar · US$ 4,99/mês via Stripe" width="260" />
</p>

[Página de preços →](https://synalux.ai/pricing) · [Termos](TERMS.md) · [Privacidade](PRIVACY.md)

---

## Aspectos clínicos e de segurança

- **O acesso à comunicação CAA nunca é interrompido.** A pessoa atendida mantém sua forma de comunicação em qualquer situação.
- **Sem dados pessoais de saúde (PHI) na nuvem sem autorização.** Anotações de cuidadores são criptografadas antes do envio.
- **O áudio permanece no dispositivo.** A entrada de voz é processada no próprio navegador via Web Speech API.
- **Desenvolvido com fundamentação em Análise do Comportamento Aplicada (ABA).** O acompanhamento de operantes verbais segue a 5ª Edição do Task List do BACB.
- **Design focado no bem-estar.** Sem mecânicas de punição. O painel de recompensas é opcional.

Saiba mais: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Resultados dos Testes

**5.139 testes automatizados** validam cada recurso em ambiente web, iOS, visão computacional e roteamento de IA.

| Área testada | Testes | Resultado |
|---|---|---|
| Aplicativo web completo (componentes, dados, serviços) | 4.971 | ✅ aprovado |
| Visão computacional / câmera / identificação de objetos | 167 | ✅ aprovado |
| Rastreamento de mãos + precisão de postura | 54 | ✅ aprovado |
| Roteamento de IA no dispositivo (Ollama ativo) | 8 | ✅ aprovado |
| iOS nativo (XCUITest) | 19 | ✅ aprovado |
| Servidor Prism MCP | 2.679 | ✅ aprovado |

**Precisão da IA no dispositivo** — consistência na escolha de ações durante o uso:

| Dispositivo | Modelo | Tamanho | Precisão | Avaliação |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100%** (300/300) | Uso clínico de CAA (expansão de símbolos, emergência, predição) |
| **Todos os iPhones** | Qwen3.5-4B Q3_K_M | 2,3 GB | **99,1%** (114/115 × 3 execuções) | Roteamento de funções BFCL |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3,4 GB | **100%** (115/115 × 3 execuções) | Roteamento de funções BFCL |
| **iPad Pro / Mac** | Prism-Coder 9B | 8,4 GB | **100%** (115/115 × 3 execuções) | Roteamento de funções BFCL |

<details>
<summary><strong>O que significa "99,1% de precisão no roteamento" na prática?</strong></summary>

A IA no dispositivo decide a ação apropriada quando o usuário toca em uma opção — salvar uma anotação, carregar a sessão, buscar no histórico, etc. Testamos o sistema com 115 cenários de uso real executados em 3 rodadas aleatórias. O modelo de 2,3 GB acertou 114 de 115 tentativas em todas as rodadas. A única exceção ocorreu ao interpretar "escrever uma expressão regular" como busca de conhecimento em vez de resposta em texto simples — uma situação pontual sem impacto no uso cotidiano da CAA.

Como referência, o modelo 2B anterior obteve 90,4% de precisão (11 desvios). O novo modelo reduz em 10 vezes as inconsistências de roteamento mantendo o mesmo tamanho de download.

</details>

---

## Infraestrutura e LGPD / GDPR

### Arquitetura distribuída

| Componente | Região | Finalidade |
|---|---|---|
| **Supabase US** | EUA Leste (Virgínia) | Banco de dados principal — autenticação, dados de uso, anotações de cuidadores |
| **Supabase EU** | Europa Central (Frankfurt) | Adequado à LGPD/GDPR — dados de usuários da UE não saem do continente |
| **Vercel** | Rede Global (Edge) | Aplicativo web, rotas de API, distribuição de conteúdo (CDN) |
| **Inworld TTS** | EUA | Síntese de voz neural |
| **HuggingFace Hub** | EUA/Europa | Arquivos de modelos de IA (2B, 4B, 14B, 32B) |
| **No dispositivo** | Aparelo do usuário | Processamento via llama.cpp (iPhone/iPad/Mac) |

### Conformidade com privacidade (LGPD / GDPR)

Os dados de usuários sujeitos à regulamentação europeia são armazenados na região de Frankfurt (eu-central-1). O portal identifica a origem do acesso pelo cabeçalho `x-vercel-ip-country` do Vercel e direciona as operações para a instância correspondente do Supabase:

- **Usuários da UE** → `supabase-eu` (Frankfurt) — dados pessoais, autenticação, preferências, anotações de cuidadores
- **Demais usuários** → `supabase-us` (Virgínia) — mesmas categorias de dados, jurisdição dos EUA
- **Processamento de IA** → no próprio dispositivo (nenhum dado sai do aparelho) ou API Synalux (sem armazenamento de dados identificáveis)
- **Áudio de síntese de voz (TTS)** → gerado no servidor e transmitido ao dispositivo, sem retenção

**Garantias de residência de dados:**
- Dados pessoais de regiões com restrição não trafegam por servidores externos não autorizados
- Tokens de autenticação vinculados à instância regional do Supabase
- Anotações de cuidadores criptografadas em repouso (Supabase AES-256)
- Gravações de voz (Tocador de Conforto) armazenadas no IndexedDB do navegador — nunca enviadas para a nuvem
- O modelo de IA no dispositivo executa localmente — sem telemetria de dados pessoais

**Direito de exclusão:** A solicitação de exclusão remove registros de autenticação, perfis, anotações de cuidadores e métricas de uso no banco de dados regional. Instâncias locais podem ser limpas com o comando `supabase db reset`.

### Estimativa de custos por volume

| Usuários | Supabase | Vercel | Voz (TTS) | Modelos de IA | Total |
|---|---|---|---|---|---|
| 0–1K | $50/mês (2 regiões) | $0 (Hobby) | ~$5/mês | $0 (no dispositivo) | ~$55/mês |
| 1K–10K | $50/mês | $20/mês (Pro) | ~$50/mês | $0 | ~$120/mês |
| 10K–100K | $50/mês + recursos adicionais | $20/mês | ~$200/mês | RunPod $125/mês | ~$395/mês |

---

## Modelos de IA e suporte a dispositivos

Compatível com dispositivos Apple. Funciona sem dependência da nuvem para os recursos essenciais de comunicação CAA.

O PrismAAC seleciona automaticamente o modelo mais adequado para o seu aparelho, reduz recursos de forma otimizada em dispositivos mais antigos e não exige conexão com a internet para a comunicação básica.

| Dispositivo | RAM | Modelo | Precisão | Suporte CAA | Tamanho | Custo |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100%** | 100% | 8,4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (uso alternativo) | **100%** | 100% | 4,7 GB / 1,1 GB | $0 |
| **iPhone 12–14, iPads anteriores** | <8 GB | 2B Q3_K_M (v43) | **99,1%** | 100% | 2,3 GB | $0 |
| **Mac M1+ via WiFi** | 16+ GB | 9B/27B via Ollama (v36) | **100%** | 100% | 8,4 GB | $0 |

### Fluxo de alternância no aplicativo web

O aplicativo web tenta primeiro o processamento local e, caso não esteja disponível, recorre à nuvem — permitindo que usuários com Ollama instalado utilizem sem custos de API, mantendo o acesso completo para os demais.

<details>
<summary>Fluxograma do processo</summary>

```
  Usuário envia mensagem
        |
        v
  +-- OLLAMA LOCAL (detectado em localhost:11434) ------+
  |                                                      |
  |   14b (100%, ~1,1s) ─[falha]─> 8b (100%, ~0,8s) ─[falha]─> 2b (100%, ~1,6s)
  +------------------------------------------------------+
         |
    [todas as opções locais indisponíveis?]
         |
         v
  +-- ALTERNATIVA EM NUVEM (API Synalux) --+
  |  Claude Sonnet 4 (pago) / Gemini (grátis) |
  |  99% de precisão, ~3s                  |
  +----------------------------------------+

  Carregamento automático: ao detectar o Ollama no primeiro acesso → baixa o modelo adequado → uso local permanente.
```

</details>

### Fluxo de alternância no aplicativo nativo iOS

O aplicativo nativo verifica a memória RAM disponível ao iniciar, baixa o modelo correspondente via rede CDN do HuggingFace (download único) e executa a inferência via llama.cpp Metal. Sem necessidade de servidor, assinatura ou envio de dados para fora do aparelho.

<details>
<summary>Fluxograma do processo</summary>

```
  Inicialização do aplicativo
      |
      v
  Verificação de RAM (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8,4 GB) ──> 100%, ~1,1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4,7 GB) ──> 100%, ~0,8s
      |                                    |
      |                     Memória cheia? → 2B Q4_K_M (1,1 GB) → 100%, ~1,6s
      |
      +── <8 GB ──> 2B Q4_K_M (1,1 GB) ──> 100%, ~1,6s

  Todos os caminhos: llama.cpp Metal, sem custos adicionais, processamento local.
  Uso via WiFi: Configurações → IA Local → insira o IP do Mac para utilizar modelos 9B/27B.
```

</details>

### Modos de visualização do teclado (configuração salva)

Três modos alternáveis com um toque — o layout escolhido é salvo e mantido ao reabrir o aplicativo.

- **KB MÁXIMO** — o teclado ocupa todo o espaço abaixo da barra de predição
- **KB MÍNIMO** — categorias ocupam 75% / teclado ocupa 25%
- **OCULTAR KB** — categorias ocupam a tela inteira, teclado oculto

<details>
<summary>Diagrama dos layouts</summary>

```
  KB MÁXIMO              KB MÍNIMO              OCULTAR KB
  +--------------------+ +--------------------+ +--------------------+
  | Barra ferramentas  | | Barra ferramentas  | | Barra ferramentas  |
  | Barra predição     | | Barra predição     | | Mensagem inicial   |
  |                    | |                    | |                    |
  |  TECLADO           | | Categorias  (75%)  | | Categorias         |
  |  ocupa o espaço    | |                    | | (tela cheia)       |
  |  abaixo da predição| |--------------------| |                    |
  |                    | | Teclado     (25%)  | |                    |
  | [123][v][ espaço ] | |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- botão [v] -------->+-- botão lateral ---->+-- botão lateral -+
        |                                                                |
        +<---------------------------------------------------------------+
```

</details>

### Resumo de desempenho e custos

| Caminho | Modelo | Precisão | Latência | Custo |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1,1s | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (uso alternativo) | **100%** | ~0,8s | **$0** |
| Qualquer dispositivo | 2B Q4_K_M (v42) | **100%** | ~1,6s | **$0** |
| WiFi para Mac | 9B/27B via Ollama (v36) | **100%** | ~1,1s | **$0** |
| Nuvem (grátis) | Gemini 2.5 Flash | 99% | ~3s | Coberto pela Synalux |
| Nuvem (pago) | Claude Sonnet 4 | 99% | ~3s | Incluído no plano |

**Proposta de valor:** Cada criança obtém respostas no nível do Claude, seja em um iPhone SE ou em um iPad Pro. A arquitetura local prioriza o funcionamento sem dependência de nuvem, sem mensalidades obrigatórias de API, sem exposição de dados pessoais e com tempos de resposta abaixo de um segundo. A frota prism-coder alcança **99,1–100%** de precisão no benchmark de chamadas de função BFCL (média de 3 execuções, junho de 2026): modelos 27B/9B/4B com 100%, modelo 2B com 99,1%. O modelo 27B também atinge 100% na avaliação interna de código com 15 problemas.

---

## Execução local / Instalação própria

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

A Synalux disponibiliza a versão oficial hospedada (gratuita e paga). Modificações e distribuições independentes devem manter a licença AGPL-3.0.

### Modelos de IA locais (sem custos de nuvem)

**Opção A — Pelo próprio aplicativo (recomendado):** Configurações → 🤖 Modelos de IA Local → clique em Baixar ao lado do modelo desejado. Inclui barra de progresso. Funciona em iPad/iPhone conectados à mesma rede WiFi de um Mac com Ollama em execução.

**Opção B — Linha de comando:**

Instale o [Ollama](https://ollama.com) e execute:

```bash
ollama pull dcostenco/prism-coder:2b   # 1,1 GB — qualquer computador, iPhone 12+ — 100% precisão (v42)
ollama pull dcostenco/prism-coder:4b   # 4,7 GB — iPhone/iPad 8GB, Mac M1+ — 100% precisão (v36)
ollama pull dcostenco/prism-coder:9b   # 8,4 GB — Mac 16GB+, iPad Pro — 100% precisão (v36)
ollama pull dcostenco/prism-coder:27b  # 16 GB  — Mac M2 Ultra+ (MoE) — 100% precisão (v7)
```

Adicione ao arquivo `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone via WiFi:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # no Mac
# Em seguida no app: Configurações → IA Local → insira: http://<ip-do-mac>:11434
```

Roteamento automático: 2B → qualquer dispositivo · 4B → móvel/validação · 9B → uso padrão · 27B → alta precisão. Recorre à nuvem caso o Ollama não esteja acessível.

---

<details>
<summary><strong>📚 Arquitetura técnica (roteamento de modelos, voz, gestos, compilação)</strong></summary>

**Tecnologias**: Next.js, Zustand, Web Speech API (transcrição), Inworld TTS-2 + alternativa Azure Neural (fala), FaceLandmarker (gestos).

**Roteamento de modelos** (no servidor via portal Synalux):
- **No dispositivo** (toque de botão → frase): `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — sem uso de rede, sem custos, ~1,6s
- **Nuvem simples** (chat, plano gratuito): `prism-coder:9b` (Qwen3-14B ajustado) → alternativa Gemini 2.5 Flash
- **Nuvem complexa** (raciocínio, plano pro): `prism-coder:27b` (QwQ-32B ajustado) → alternativa Claude Sonnet 4
- **Autocorreção + predição de palavras**: Gemini 2.5 Flash-Lite — 752ms em média, suporte a múltiplos idiomas
- Caminhos de alta velocidade (toque em botão → áudio) evitam etapas intermediárias — não bloqueiam por latência de rede
- Precisão de roteamento ([Avaliação Prism com 102 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), instrução de sistema v36/v7, média de 3 execuções, maio de 2026):

  | Modelo | Precisão | Latência média | Funções incorretas |
  |---|---|---|---|
  | prism-coder:27b swe14 (local) | **100,0%** | 1,4s | 0 |
  | Roteamento combinado 14B→32B (local) | **100,0%** | ~1,1s | 0 |
  | prism-coder:4b v36 (local) | **100,0%** | 0,8s | 0 |
  | prism-coder:9b v36 (local) | **100,0%** | 1,1s | 0 |
  | Sonnet 4 (nuvem) | **99%** | 3,2s | 0 |
  | Opus 4.7 (nuvem) | **98,3%** | 3,0s | 0 |
  | prism-coder:2b v42 (local) | **100,0%** | 1,6s | 0 |

- Avaliação ampliada — eval_300 (300 casos, 17 ferramentas, 9 categorias, 3 execuções): prism-coder:27b = **300/300 (100%)**

**Cadeia de reprodução de voz (TTS)**:
- Nível 1: Inworld TTS-2 (disponível nos planos pagos; gratuito para idiomas selecionados)
- Nível 2: Vozes integradas do sistema via Web Speech API (offline)
- Nível 3: espeak-ng via WASM (último recurso)

**Reconhecimento de gestos**:
- Básico: rastreamento de cabeça + clique por fixação via FaceLandmarker
- Avançado: rastreamento de mãos via MediaPipe; perfis de gestos por usuário

**Estrutura da interface**: navegação baseada em painéis, gerenciamento de temas por variáveis de cor/borda/destaque.

**Documentos técnicos disponíveis neste repositório:**
- [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) — fluxo completo de síntese de voz
- [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md) — detalhes do módulo de gestos
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](../../docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — alternância automática de tom
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](../../docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — fluxo do sistema de emergência
- [`docs/SELF-LEARNING-SAFETY.md`](../../docs/SELF-LEARNING-SAFETY.md) — diretrizes de aprendizado contínuo
- [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md) — validação do rastreamento cefálico e manual
- [`PRECISION_TOUCH.md`](../../PRECISION_TOUCH.md) — acessibilidade e áreas de toque
- [`ACCESSIBILITY.md`](../../ACCESSIBILITY.md) · [`SECURITY.md`](../../SECURITY.md) · [`GOVERNANCE.md`](../../GOVERNANCE.md) · [`AGENTS.md`](../../AGENTS.md)
- [`RESEARCH.md`](../../RESEARCH.md) — base de evidências científicas
- [`CHANGELOG.md`](../../CHANGELOG.md) — histórico de versões

</details>

<details>
<summary><strong>🆕 Diferenciais do PrismAAC (conjunto de algoritmos)</strong></summary>

**Três características exclusivas presentes na plataforma:**

### 1. IA no dispositivo — suporte a diretrizes de segurança da informação (LGPD / HIPAA)

**Importância da IA local na CAA — velocidade, segurança e confiabilidade:**

| | Apenas IA em Nuvem | PrismAAC (foco local) |
|--|---|---|
| Toque no botão → áudio | 2 a 30s (latência de rede) | **~0,5s** (no dispositivo) |
| Funcionamento offline | ❌ Não | ✅ Sim |
| Envio de dados pessoais | ✅ Sempre | ❌ Nunca (no fluxo de voz) |
| Suporte a normas de privacidade | Exige acordos de privacidade com cada provedor | **O processamento local mantém os dados no aparelho — atende a requisitos de proteção de dados** |
| Conexão instável / rural | Indisponível | **Funcionamento normal** |
| Custo mensal por usuário | $2–15 em chamadas de API | **$0 (local)** |

**O modelo 2B executa inteiramente no seu dispositivo** — iPad M1+, Mac ou notebook. A seleção de um botão gera uma resposta em ~500ms sem chamadas de rede externas. Dados de fala, textos e padrões de comunicação não saem do aparelho no uso diário.

Anotações de cuidadores são criptografadas localmente antes de qualquer sincronização opcional. Diferente de plataformas de CAA exclusivamente em nuvem que exigem envio constante de dados para funcionar, o PrismAAC opera de forma independente no dispositivo.

**Para ambientes institucionais e clínicos (modelos 9B + 27B):** os modelos 9B e 27B podem ser executados em um Mac dedicado via Ollama na rede local da instituição. Os iPads se conectam pela rede WiFi interna — os dados não trafegam pela internet. Essa estrutura apoia a conformidade com normas de proteção de dados ao manter as informações no local; a conformidade final depende das políticas de segurança física, administrativa e técnica de cada instituição.

**Como configurar:**

```
iPad / iPhone (na mesma rede WiFi do Mac)
    ↓  conecta ao
Mac executando Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  disponibiliza
prism-coder:2b · :14b · :32b
    ↓  todo o processamento ocorre na
Rede local — nenhum dado é enviado para a internet
```

Configurações → 🤖 Modelos de IA Local → insira o IP do Mac → modelos disponíveis imediatamente. Sem custos de nuvem. Sem exposição de dados pessoais. Sem dependência de internet para a comunicação CAA.

### 2. Classificação de frases que se adapta a CADA criança
Listas estáticas de palavras são limitadas. O PrismAAC ordena as sugestões de frases usando o **mecanismo de ativação espalhada do Prism v14.0.0** — baseado no modelo de memória cognitiva ACT-R desenvolvido em pesquisas na Carnegie Mellon University. O sistema considera frequência, tempo do último uso e histórico do usuário, em vez de uma lista fixa de popularidade. Frases utilizadas no dia ganham prioridade; frases não utilizadas por longos períodos diminuem de destaque (taxa de decaimento `d=0.25`, meia-vida de ~1 ano).

### 3. Correções de cuidadores viram dados de treinamento — automaticamente
Quando um cuidador corrige uma sugestão que o modelo apresentou incorretamente (ex.: "não, a palavra é *comer*, e não *quero*"), o sistema [captura a correção](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) e registra o ajuste. Após cerca de 50 sessões, o sistema antecipa e evita equívocos semelhantes. Sem necessidade de rotulagem manual pelos cuidadores ou processos complexos de reconfiguração — as próprias correções orientam o aprendizado do sistema.

**Abrangência:** Precisão de roteamento na [Avaliação Prism com 115 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 ferramentas Prism, 12 categorias, média de 3 execuções, junho de 2026): modelo 27b = 100,0%, 9b = 100,0%, 4b = 100,0%, 2b = 99,1%. Nenhuma função incorreta gerada em todos os tamanhos de modelo e execuções. O modelo 2B executa no dispositivo para respostas rápidas; os modelos 9B/27B atendem a fluxos avançados via conexão WiFi com o Mac. Na avaliação geral do Berkeley BFCL V4 (mais de 2.000 casos de chamadas de função), o modelo 2B atinge ~59% — resultado alinhado a outros modelos da mesma categoria. A eficiência do PrismAAC resulta da combinação entre o modelo de linguagem e o conjunto de algoritmos de ativação espalhada da plataforma.

</details>

---

## Para desenvolvedores

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # mais de 4900 testes unitários
npm run e2e                  # testes Playwright em 11 perfis de dispositivos
```

### Monitoramento

| Painel | O que acompanha |
|-----------|---------------|
| [Prism AAC — User Analytics](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | Sessões, erros, predições de palavras, toques em frases, eventos de leitura, idiomas, países, dispositivos, planos de assinatura, telemetria de rastreamento cefálico |

Integração com Datadog RUM: consulte `lib/datadog.ts` + `components/DatadogInit.tsx`. 7 testes de desempenho E2E disponíveis em `e2e/datadog-integration.spec.ts`.

---

## Licença

[AGPL-3.0](LICENSE) — código aberto, aprovado pela OSI, elegível para bolsas e auxílios.

Você tem a liberdade de fazer alterações e executar instâncias próprias. A licença estabelece que modificações realizadas sejam compartilhadas sob a mesma licença AGPL-3.0 — mantendo os avanços em CAA acessíveis e abertos para todas as famílias.

© 2024–2026 Synalux LLC
