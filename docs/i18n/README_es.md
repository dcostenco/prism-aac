<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ayuda a los niños no verbales a comunicarse.**

Aplicación de Comunicación Aumentativa y Alternativa (AAC) para niños con discapacidades motoras y necesidades complejas de comunicación. Toca imágenes, construye frases, escúchalas en voz alta — en 23 idiomas. Funciona en cualquier tableta, portátil, iPhone, iPad y Apple Watch.

Parte de la [plataforma Synalux](https://synalux.ai).

🌐 [English](../../README.md) · **Español** · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Probar Gratis"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Precios"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacidad"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Términos"></a>
</p>

![Prism AAC main screen — toolbar, schedule banner, type-here bar, prediction tiles, and qwerty keyboard](../../docs/screenshots/app-hero.png)

### Aplicaciones nativas

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC en iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC en iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC en Apple Watch Ultra" width="120" />
</p>

| Plataforma | Estado | IA en el dispositivo | Notas |
|----------|--------|-------------|-------|
| **Web** (PWA) | Producción | Descarga automáticamente el mejor modelo local | Cualquier navegador, instalable |
| **iPad Pro 16GB** | Producción | IA en el dispositivo (14B) | Rápido, privado, seleccionado automáticamente por la RAM |
| **iPhone / iPad 8GB** | Producción | IA en el dispositivo (8B → 1.7B de respaldo) | Reduce automáticamente el tamaño para adaptarse al dispositivo |
| **iPhone / iPad <8GB** | Producción | IA en el dispositivo (1.7B) | Siempre se ajusta, 1.1 GB |
| **Apple Watch** | Producción | Diccionario de frases sin conexión (1,261 × 20 idiomas) | Independiente — pictogramas, TTS, emergencia |
| **Extensión de Chrome** | Producción | — | Asistente de lectura en cualquier campo de texto |
| **WiFi a Mac** | Producción | 14B/32B vía Ollama | Ajustes → IA Local → introducir IP de Mac |

---

## Video de vista previa en la App Store

Video de 30 segundos que muestra todas las características principales con narración TTS de Inworld:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Escena | Característica | Captura de pantalla |
|---|---|---|
| **Inicio** — tocar frases | Tablero de pictogramas con 22 categorías, botón Hablar | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorías** | Frases rápidas para Ayuda, Comida, Lugares, Sentimientos | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat con IA** | Componer mensajes, practicar conversaciones | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerta de emergencia** | Llamada a cuidador/enfermera con un solo toque | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Horario** | Rutinas diarias visuales — mañana, escuela, almuerzo, hora de dormir | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Juegos** | Bubble Pop, Color Hunt, Match It, Sí/No, Finish It | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matemáticas y Escuela** | Matemáticas adaptativas con Pista, Verificar, Resolver + teclado numérico | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Seguimiento de cabeza y ojos** | Cursor de permanencia basado en cámara, control de la mirada, calibración | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Idiomas** | Inglés, Español, Francés, Ruso, Japonés, Coreano, Chino, Árabe y más | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Un vistazo rápido

| Módulo | Qué hace | Vista previa |
|---|---|---|
| 📂 **Categorías** | Fichas de imágenes estilo PECS para no lectores | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Escribir y hablar** | Teclado + predicción de palabras + voz neuronal | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat con IA** | Asistente en el dispositivo + en la nube, ajustado para usuarios de AAC | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat AAC** | Mensajes entrantes de cuidadores + contactos | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matemáticas + asignaturas** | Lienzo de cuadrícula de celdas con tutor consciente del dominio | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Horario** | Rutinas visuales "primero-luego" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Juegos** | 12 juegos terapéuticos de AAC | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Tienda** | Paquetes de voz, paquetes de vocabulario, paquetes de juegos | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Reproductor de confort** | Reproductor multimedia de cabecera para pacientes hospitalizados | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Modo de cabecera** | Chat con IA a pantalla completa para uso con el teléfono en soporte / acostado | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **Manos libres** | Reconocimiento de gestos de cabeza + manos | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Ajustes** | 23 idiomas, adaptaciones motoras, nivel de plan | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## Alternativa gratuita a Read & Write

Prism AAC incluye todas las funciones de asistente de lectura por las que la mayoría de los usuarios de AAC compran Read & Write, de forma gratuita, en el navegador y sin necesidad de cuenta para el nivel web. Consulta [Escribir y hablar](#%EF%B8%8F-type--speak) para la función de hablar al final de la frase + resaltado de palabras, [Lector de PDF](#-pdf-reader) y [Lector de capturas de pantalla (OCR)](#-screenshot-reader-ocr) para documentos, y la [extensión de Chrome](#-chrome-extension--same-reading-assistant-features-in-any-text-field) para cobertura entre aplicaciones en Gmail / Docs / Word Online / cualquier otro lugar.

## Cómo se compara Prism AAC

| | Prism AAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Ruta de voz **en el dispositivo + segura para HIPAA** | ✅ | ❌ | ❌ | ❌ | parcial | parcial | ❌ | ❌ | parcial |
| **Clasificación de frases por usuario** (se adapta a cada niño) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Las correcciones del cuidador **se convierten automáticamente en datos de entrenamiento** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tutor de IA consciente del dominio** (matemáticas + otras 10 asignaturas) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lienzo de matemáticas con cuadrícula de celdas** (sin LaTeX, sin pizarra) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Historial consciente de la configuración regional + región** (más de 280 regiones) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modo de gestos de cabeza + manos **manos libres** | ✅ | parcial | parcial | ❌ | ✅ | parcial | parcial | ✅ | ✅ |
| **Chat con IA manos libres** (bucle de voz + palabra de activación + superposición de cabecera) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Juegos terapéuticos de AAC** incorporados | ✅ (12) | ❌ | ❌ | ❌ | ❌ | parcial | parcial | ❌ | ❌ |
| **Código abierto** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Nivel gratuito** para acceso de seguridad vital | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Tienda** de paquetes de voz | ✅ | ❌ | parcial | ❌ | parcial | ❌ | ❌ | parcial | parcial |
| **Multilingüe** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notas del cuidador** que viajan a casa / escuela / clínica | ✅ | ❌ | ❌ | ❌ | parcial | parcial | parcial | ❌ | parcial |
| Modo independiente de **Apple Watch** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Asistente de lectura de **extensión de Chrome** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> La comparación refleja la información de productos disponible públicamente a partir de mayo de 2026. Prism AAC está en desarrollo activo; los competidores pueden añadir funciones con el tiempo. Las PR son bienvenidas para mantener esto honesto — ver `CONTRIBUTING.md`.
>
> Grid 3 y Tobii Dynavox tienen fuertes integraciones de hardware de seguimiento ocular + escaneo por interruptor no reflejadas arriba (dependientes del hardware, configuraciones de clínicas especializadas).

---

## iOS y Apple Watch

### iPhone / iPad

Aplicación nativa Swift que envuelve la interfaz de usuario web en WKWebView + IA en el dispositivo a través de llama.cpp Metal. Selecciona automáticamente el mejor modelo según la RAM del dispositivo:

| Dispositivo | RAM | Modelo | Descarga |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | 8.4 GB desde HF CDN |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (respaldo por OOM) | 4.7 GB / 1.1 GB |
| iPhone 12-14, iPads más antiguos | <8 GB | 1.7B Q4_K_M | 1.1 GB |

Seguridad de tres capas: filtro de crisis síncrono → IA en el dispositivo → respaldo en la nube. La gestión de memoria degrada elegantemente: IA completa → IA en la nube → solo núcleo → modo de emergencia.

- Margen de área segura para Dynamic Island / notch
- Puente WCSession para el envío de emergencias del Apple Watch
- Tokens de autenticación respaldados por Keychain
- Respaldo por OOM: si el modelo más grande no cabe, carga automáticamente el siguiente más pequeño

**Ajustes → 🤖 Modelos de IA Local** — descarga y gestiona los modelos de Prism:
- Detecta Ollama automáticamente en `localhost:11434`
- Conexiones WiFi: iPad/iPhone → Mac Ollama (14B/32B con máxima precisión)
- Descarga por modelo con barra de progreso en vivo
- Modelos: `:1b7` (1.1 GB) · `:8b` (4.7 GB) · `:14b` (8.4 GB) · `:32b` (16 GB)

### Apple Watch (independiente)

Funciona sin iPhone — independiente con diccionario de frases sin conexión.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traducción sin conexión:** 1,261 frases × 20 idiomas incluidos (411 KB JSON) — búsqueda instantánea, 100% precisa, sin red
- Cuadrícula de pictogramas de 2 columnas con imágenes de ARASAAC
- Chat con IA con dictado + entrada de teclado (en la nube cuando está en línea, diccionario de frases cuando está sin conexión)
- Sistema de emergencia: cuenta regresiva → WCSession → respaldo celular → TTS
- Traducción con salida TTS (primero diccionario sin conexión, luego respaldo en la nube)
- Bandeja de entrada: recibe y responde mensajes de cuidadores
- Fijación de certificados (SPKI SHA-256) en el envío de emergencias
- NFKC + sanitización de inyección de 23 tokens en todas las rutas de IA

---

## Módulos

### 📂 Categorías
Fichas de imágenes estilo PECS. Toca una categoría, toca una ficha, escucha la palabra, mira cómo aparece en la barra de mensajes. Funciona para no lectores, pre-lectores y comunicadores emergentes por igual. Los conjuntos de fichas y su orden se personalizan con el tiempo mediante la activación de propagación: las fichas que tu hijo toca más suben; las que no se usan durante meses se desvanecen.

**Diseño envolvente** — las categorías aparecen en una columna izquierda desplazable junto al teclado, para que el usuario de AAC pueda tocar las fichas de imágenes Y escribir simultáneamente sin cambiar de modo. La barra de predicción permanece visible; ambas entradas son siempre accesibles.

![Categories in surround mode — scrollable category cards on the left, full keyboard on the right](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- 22 categorías predeterminadas: personas, comida, sentimientos, cuerpo, ropa, animales, lugares, etc.
- El cuidador puede añadir / eliminar / reordenar fichas por niño
- Cada ficha lleva una `textKey` para i18n — cambiar el idioma de la aplicación reetiqueta cada ficha con un solo toque
- Los pictogramas de las fichas provienen de ARASAAC + un conjunto curado; la clonación de voz permite que la voz de la ficha coincida con la de los hermanos o padres del niño (nivel de pago)
- Aprendizaje de n-gramas por usuario: un niño que toca "Quiero comer" tres veces ve "comer" subir después de "quiero" en la siguiente sesión
- Memoria holográfica HRR: predicciones contextuales sin búsqueda en ~0.2ms a través de WASM de Rust — +27% de precisión Top-1 en frases AAC centrales

**Ruta de renderizado:** `components/CategoryPanel.tsx` → `useCategoryStore` → fichas extraídas de `constants/phrases.ts` (sistema) + anulaciones por usuario de Supabase (de pago). Los toques de ficha invocan `messageStore.appendText(phrase)` y se enrutan a través de `aacSpeak()` para TTS.
</details>

---

### ⌨️ Escribir y hablar
Teclado en pantalla con **predicción de palabras**, **autocompletado con IA** y un botón **Hablar** de un solo toque que lee la barra de mensajes en voz alta con una voz neuronal natural. Escribir enseña al motor de predicción: las palabras que tu hijo escribe más aparecen antes en la siguiente sesión.

![Prism AAC keyboard with "hello" typed, prediction tiles, and Speak button](../../docs/screenshots/keyboard-typing.png)

**Funciones de asistente de lectura (paridad con Read & Write)** — para usuarios con necesidades de lectura / memoria / cognitivas:

- **Hablar por palabra** — cada palabra se reproduce a través de TTS en el momento en que tocas espacio, para que escuches lo que escribiste sin esperar la frase completa.
- **Hablar la frase al `.?!`** — terminar una frase con un punto, signo de interrogación o signo de exclamación lee la frase completa para que no pierdas el hilo de lo que escribiste (la brecha que descalifica a NVDA para usuarios videntes con discapacidades cognitivas). Activar/desactivar a través de Ajustes → `speakOnSentenceEnd` (activado por defecto).
- **Resaltado palabra por palabra mientras se habla** — cada palabra hablada se ilumina con un fondo amarillo mientras el TTS la lee. Los usuarios videntes con discapacidades de lectura pueden seguir visualmente; el resaltado sigue el audio sin necesidad de un dispositivo de hardware especial.

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- 5 ranuras de predicción encima del teclado qwerty, actualizadas con cada pulsación
- Completado con IA ("hw" → "how", "togoso" → "to go so") a través de Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms de media, 4.3 veces más barato que 2.5 Flash)
- Puerta de lenguaje cruzado: RO `eu` no se filtrará en la barra EN incluso cuando ambos corpus estén cargados (comparación de frecuencia entre corpus)
- "Hablar" lee con adaptación automática de tono (declarativo / interrogativo / exclamativo inferido de la puntuación)
- Nivel de voz 1: Inworld TTS-2 (natural/neuronal, los 23 idiomas de la aplicación); nivel 2: OS Web Speech (sin conexión, nativo del dispositivo); nivel 3: WASM espeak-ng (último recurso)
- El resaltado de palabras se estima por duración (~60 ms/carácter a una velocidad de 0.5, escala con el deslizador de velocidad) — funciona en todos los niveles de TTS sin cambios de backend; la sincronización precisa a través de Azure `wordBoundary` es una futura función Pro.
- Corpus de n-gramas SQLite de 1.5MB por idioma; unigramas + bigramas + trigramas; carga perezosa al cambiar de idioma
- **Memoria contextual HRR** — recuperación holográfica sin búsqueda (229KB Rust WASM) que aprende de cada frase hablada. Codifica bigramas + trigramas en un vector holográfico; sondea en ~0.2ms en cada pulsación. Capa aditiva — impulsa las primeras 2 fichas de predicción con coincidencias contextuales sin eliminar las predicciones del corpus.

**Benchmark de predicción HRR** (54 pruebas unitarias + suite de precisión de 10 escenarios):

| Escenario | Top-1 Base | Top-1 HRR+ | Mejora | MRR Base | MRR HRR+ | Mejora MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Frases AAC centrales (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Frases AAC centrales (5x diarias) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Vocabulario personal | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| Mixto (todas las frases) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| Recuperación entre sesiones | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| Prefijos ambiguos | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = palabra correcta es la ficha #1. Top-5 = palabra correcta en cualquier ficha. MRR = Mean Reciprocal Rank (más alto = palabra correcta aparece antes). HRR nunca reduce la precisión Top-5 en ningún escenario — cero regresiones. Las mayores ganancias en vocabulario personal (+9.2% MRR) y frases AAC centrales (+27.3% Top-1).

**Ruta de renderizado:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recencia × frecuencia × impulso de n-gramas) + superposición opcional de IA de `services/textCorrectService.ts` + sondeo de bigramas/trigramas HRR de `services/hrrContext.ts`. Resaltado: `services/aacSpeak.ts` emite eventos `tts-highlight-start` en el `ttsHighlightBus`; `components/MessageBar.tsx` se suscribe y pasa `activeWordIndex` a `ColoredText`.
</details>

---

### ✨ Chat con IA
Asistente en el dispositivo + en la nube ajustado a la voz del usuario de AAC. Respuestas transmitidas, cada línea se puede tocar para insertar en la barra de mensajes, de modo que la autoría permanezca en el niño. El nivel gratuito funciona a través de Gemini 2.5 Flash; los niveles de pago se enrutan a Claude Sonnet 4 con la flota prism-coder para consultas cortas.

**Modo IA Limpio** — la barra de predicción de palabras se oculta automáticamente cuando el Chat con IA está abierto (las predicciones son irrelevantes al componer una pregunta), manteniendo el enfoque en la respuesta de la IA y el botón de enviar.

**Chat con IA manos libres** — activa el botón 🔁 en el encabezado del chat para entrar en un bucle de voz continuo: el micrófono se abre automáticamente después de cada respuesta de la IA, para que el niño pueda mantener una conversación completa sin tocar la pantalla. Una barra de estado debajo del encabezado del chat confirma que el modo está activado.

**Modo de traducción** — cuando el idioma de la aplicación y el idioma de salida difieren (por ejemplo, entrada en portugués, salida en inglés), cada intercambio de IA se enruta automáticamente a través de la ruta de traducción con la transmisión habilitada, por lo que no hay penalización de velocidad en comparación con el modo monolingüe.

![AI Chat panel — prediction bar hidden in AI mode, full keyboard accessible below](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Panel en línea acoplado encima del teclado — nunca un modal que oculte la barra de mensajes
- Entrada de voz a través de la API Web Speech; el botón del micrófono muestra la transcripción provisional en vivo
- Toca cualquier línea de IA para copiarla en la barra de mensajes (conserva la autoría — Valencia et al., CHI 2023)
- **Bucle manos libres** — botón 🔁 en el encabezado; reinicia automáticamente el micrófono 1 s después de que finaliza cada respuesta de la IA; `aria-pressed` + fondo verde confirman el estado; barra de estado debajo del encabezado mientras está activo
- **Palabra de activación "Hey Prism"** — disponible dentro de la superposición de cabecera; la sesión continua de `SpeechRecognition` detecta la frase y activa el micrófono; no disponible cuando el puente nativo de iOS posee la sesión de audio
- Tiempo de espera forzado de 15s en el cliente + botón Reintentar (para que el panel no se quede atascado en "Pensando…" si la red se cae)
- 401 / red / tiempo de espera / otros → mapeo de errores amigable; nunca muestra "Sesión caducada" en bruto
- Respaldo local de Ollama (`prism-coder:1b7`) cuando está sin conexión; el contenido mixto se bloquea desde el origen del navegador `synalux.ai` en la práctica, por lo que se activa el error amigable

**Ruta de renderizado:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (o `translateAI()` en modo traducción) → flujo SSE desde Synalux `/api/v1/chat` con `credentials: 'include'`. CORS permite `synalux.ai` + orígenes de desarrollo de localhost.
</details>

---

### 🛏 Modo de cabecera

> **Característica de accesibilidad crítica.** El Modo de cabecera existe porque algunos usuarios no tienen una forma fiable de hablar, escribir o tocar una pantalla. El diseño debe funcionar primero para el caso más difícil: un paciente acostado en una cama de UCI, con los brazos a los lados, ventilado, incapaz de producir ningún sonido — comunicándose solo a través de la mirada o un único interruptor de hardware sostenido entre dos dedos.

Superposición de comunicación con IA a pantalla completa optimizada para usuarios que no pueden alcanzar la pantalla o hablar de forma fiable. Cada objetivo táctil es de gran tamaño. La voz es una vía de entrada entre varias, no la única. La interfaz es operable completamente a través de tecnología de asistencia: escaneo por interruptor, seguimiento ocular, Control por Voz de iOS, seguimiento de cabeza o un teclado en pantalla navegado con un solo interruptor.

Inspirado en la retroalimentación directa de la comunidad AAC (r/AssistiveTechnology, mayo de 2025) de usuarios que se comunican desde camas de hospital, recuperación postquirúrgica y entornos de cuidados paliativos.

**¿Funciona en Mac / Windows?** Sí. El Modo de cabecera es una característica de aplicación web progresiva — se ejecuta en cualquier navegador en cualquier dispositivo. No es solo para iOS.

---

#### ¿Para quién es esto?

El Modo de cabecera está diseñado para usuarios con un amplio espectro de habilidades motoras y del habla. Las Tarjetas de Frases Rápidas (descritas a continuación) están específicamente diseñadas para usuarios en el extremo más severo — aquellos que no pueden hablar en absoluto y tienen un movimiento de manos muy limitado o nulo.

| Perfil de usuario | Método de entrada recomendado |
|---|---|
| Puede hablar, brazos restringidos | Voz (🎙 botón de micrófono) + bucle manos libres |
| Algunas vocalizaciones, habla poco fiable | Palabra de activación "Hey Prism" + bucle manos libres |
| Sin habla, puede tocar la pantalla | Tarjetas de Frases Rápidas (un solo toque) |
| Sin habla, movimiento limitado — un interruptor | Control por Interruptor de iOS o Escaneo de Acceso por Interruptor de Android sobre Tarjetas de Frases Rápidas |
| Sin habla, sin movimiento de manos — dispositivo de seguimiento ocular | El hardware de seguimiento ocular (Tobii, EyeGaze Edge, etc.) se presenta como un puntero de ratón — todas las tarjetas son navegables |
| Sin habla, puede mover la cabeza | Seguimiento de cabeza (por ejemplo, Puntero de Cabeza de iOS, Control de Cámara en iPhone 16) — las tarjetas son objetivos de navegación de tamaño completo |
| Traqueotomía / ventilado, sin vocalización | Tarjetas de Frases Rápidas mediante seguimiento ocular o interruptor + modo asistido por cuidador |

---

#### Soporte de plataforma

| Plataforma | Modo de cabecera | Tarjetas rápidas | Bucle manos libres 🔁 | Palabra de activación 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (cualquier navegador) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Solo Safari |
| Aplicación nativa de iOS (App Store) | ✅ | ✅ | ✅ | ❌ usar Manos Libres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispositivo de seguimiento ocular (cualquiera — se presenta como ratón) | ✅ | ✅ | ✅ | ✅ |
| Escaneo por interruptor (Control por Interruptor de iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **¿Por qué no hay palabra de activación en la aplicación nativa de iOS?** El puente nativo toma posesión de la sesión de audio (`prismNativeBridge.startVoice`), lo que entra en conflicto con la API `SpeechRecognition` del navegador que utiliza el servicio de palabra de activación. Utiliza el **bucle manos libres** (🔁) en su lugar — reinicia el micrófono automáticamente 1 segundo después de que finaliza cada respuesta de la IA sin requerir ninguna entrada continua.

---

#### Cómo empezar

1.  Abre el panel **Chat con IA** — toca el icono 🤖 en la barra de herramientas.
2.  Toca **🛏** en el encabezado del panel — la superposición a pantalla completa se abre inmediatamente.
3.  Elige tu método de entrada (ver secciones siguientes).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Superposición del Modo de cabecera abierta — interfaz de usuario negra a pantalla completa. La franja superior muestra las Tarjetas de Frases Rápidas. El área central muestra las respuestas de la IA. La parte inferior muestra un gran botón rojo de micrófono y la fila de controles." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Modo de cabecera con Manos Libres activo — botón 🔁 resaltado en verde, texto de estado 'Manos Libres ACTIVADO' visible" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Botón de alternancia de Manos Libres en estado activado — fondo verde, aria-pressed=true" width="260">
</p>

#### Cómo detener / salir

-   **Tocar / pulsar:** toca **✕** en la esquina superior derecha de la superposición (objetivo de 48 × 48 px).
-   **Teclado / interruptor:** pulsa **Escape**.
-   **Voz:** di cualquier comando a través del Control por Voz de iOS mientras la superposición está abierta.

Tu historial de chat completo y el estado de la sesión de IA se conservan al salir. La superposición se sitúa encima del panel principal como una capa de renderizado separada — nada se pierde al cerrarla.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Después de cerrar el Modo de cabecera — de vuelta al panel principal de chat con IA con el historial de conversación intacto" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barra de estado del panel principal mostrando 'Hey Prism activo' con indicador azul después de regresar del Modo de cabecera" width="260">
</p>

---

### 🃏 Tarjetas de Frases Rápidas — para usuarios no verbales y con movilidad reducida

> **Esta es la ruta crítica para usuarios que no pueden hablar o tocar la pantalla libremente.** Las Tarjetas de Frases Rápidas son botones de comunicación preprogramados que se pueden activar con un solo toque, una permanencia de la mirada o una selección por escaneo de interruptor. Sin escribir. Sin voz. No se requiere internet para usarlas.

Cada tarjeta muestra un gran icono de emoji y una frase corta. Al tocar una tarjeta, esa frase se carga inmediatamente en la barra de mensajes. Si el **modo Manos Libres** está activado, la frase se envía a la IA automáticamente.

#### Tarjetas incorporadas

Quince tarjetas se precargan en el primer uso, agrupadas por urgencia. No se pueden eliminar. Funcionan sin conexión.

**Urgente (máxima prioridad — comunicar estas primero en una emergencia médica):**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| 🆘 | AYUDA — EMERGENCIA | Peligro inmediato, llamada de código, cualquier situación que requiera personal ahora |
| 😢 | Tengo dolor | Dolor de cualquier tipo — la ubicación/gravedad puede seguir en texto libre |
| 🫁 | No puedo respirar | Dificultad respiratoria, preocupación por las vías respiratorias, ataque de pánico |
| 🔔 | Llamar a la enfermera | Solicitud de personal no urgente |

**Necesidades físicas:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| 💧 | Agua por favor | Sed, boca seca, dificultad para tragar medicamentos |
| 🔥 | Tengo mucho calor | Fiebre, manta, regulación de la temperatura |
| 🥶 | Tengo mucho frío | Escalofríos, manta, temperatura ambiente |
| ↔️ | Por favor, reposicióname | Alivio de presión, comodidad, posicionamiento postquirúrgico |
| 💊 | Necesito mi medicación | Dosis programada, solicitud PRN, medicación para el dolor |

**Comunicación:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| ✅ | Sí | Confirmación — responder preguntas de sí/no del cuidador |
| ❌ | No | Negación — responder preguntas de sí/no del cuidador |
| ⏳ | Por favor, espera | Necesita un momento — no proceder todavía |

**Emocional:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| ❤️ | Te quiero | Familia, conexión emocional |
| 🙏 | Gracias | Gratitud |
| 😨 | Tengo miedo | Ansiedad, miedo, angustia — activa una respuesta empática de la IA |

#### Cómo usar las Tarjetas de Frases Rápidas

**Un solo toque / seguimiento ocular / selección por interruptor:**
Activar una tarjeta coloca su texto en la barra de mensajes. La frase puede entonces ser:
- Enviada a la IA para una respuesta contextual (por ejemplo, tocar "Tengo miedo" → la IA responde con tranquilidad y hace preguntas de seguimiento)
- Leída tal cual — los cuidadores en la habitación pueden ver la tarjeta que se tocó en la pantalla

**Con el modo Manos Libres activado:**
La frase se envía a la IA automáticamente en el momento en que se toca la tarjeta. El micrófono se reinicia 1 segundo después de que la IA responde — creando un bucle continuo sin ninguna otra entrada.

**Con la palabra de activación "Hey Prism" activa (web / escritorio):**
La palabra de activación + Tarjeta Rápida se pueden combinar: el usuario dice "Hey Prism" para abrir el micrófono, la IA responde, y el usuario puede entonces tocar una tarjeta para continuar la conversación en una dirección diferente sin volver a hablar.

#### Cómo añadir tarjetas personalizadas

Los cuidadores, BCBA y miembros de la familia pueden añadir tarjetas personalizadas adaptadas a las necesidades de comunicación específicas del usuario — los nombres de sus médicos, frases favoritas, descripciones específicas del dolor, expresiones religiosas o cualquier otra cosa.

**Pasos:**

1.  Dentro del Modo de cabecera, toca **＋ Añadir** al final de la tira de Frases Rápidas.
2.  Escribe la frase que quieres en la tarjeta (hasta 80 caracteres).
3.  Toca **Añadir Tarjeta** — la IA genera automáticamente un icono de emoji que coincide con el significado de la frase (por ejemplo, "Dame más mantas" → 🛏, "Quiero rezar" → 🤲).
4.  El icono aparece con una breve animación "✨ Generando…", luego la tarjeta se guarda.

Las tarjetas personalizadas se guardan localmente en el dispositivo (localStorage). Persisten entre sesiones y reinicios de la aplicación. No se requiere una cuenta o conexión a internet para usar las tarjetas guardadas — solo la generación inicial del icono requiere una llamada de red.

**Ejemplos de tarjetas personalizadas a considerar añadir:**

| Frase sugerida | Por qué |
|---|---|
| `[Nombre del médico], por favor, venga` | Más rápido que el genérico "llamar a la enfermera" para un clínico específico |
| `Necesito hablar con mi familia` | Situaciones emocionales/legales que requieren al pariente más cercano |
| `Por favor, apague las luces` | Sensibilidad sensorial, migraña, sueño |
| `Quiero rezar` | Cuidado espiritual — dignidad en entornos de fin de vida |
| `Algo no está bien` | Señal de angustia vaga — incita a la IA a hacer preguntas aclaratorias |
| `Necesito la succión` | Pacientes con traqueotomía / ventilador |
| `Mi vía intravenosa me duele` | Infiltración, alerta de flebitis |
| `Quiero ir a casa` | Conversaciones sobre cuidados paliativos/alta |

#### Cómo eliminar tarjetas personalizadas

1.  Toca **✏️ Editar** en el encabezado de la tira de Frases Rápidas.
2.  Aparece una insignia roja **✕** en cada tarjeta personalizada (las tarjetas incorporadas están protegidas y no se pueden eliminar).
3.  Toca ✕ en cualquier tarjeta para eliminarla.
4.  Toca **Hecho** para salir del modo de edición.

#### Configuración de escaneo por interruptor (iOS)

Para usuarios que solo pueden activar un único interruptor externo (sorber y soplar, interruptor de cabeza, interruptor de pie, interruptor de almohada):

1.  Conecta el interruptor al iPhone/iPad a través de Bluetooth o el puerto Lightning/USB-C.
2.  Ve a **Ajustes → Accesibilidad → Control por Interruptor → Interruptores** y asigna el interruptor a "Seleccionar elemento".
3.  Ve a **Control por Interruptor → Estilo de Escaneo** y elige "Escaneo Automático" — el dispositivo resaltará automáticamente los elementos uno por uno.
4.  Abre Prism AAC en Modo de cabecera. El Control por Interruptor escaneará automáticamente las Tarjetas de Frases Rápidas. Activa tu interruptor cuando la tarjeta deseada esté resaltada.
5.  La frase se envía inmediatamente — no se requiere una segunda acción.

> Todas las Tarjetas de Frases Rápidas llevan `data-scan-group="quick-cards"` para que la tecnología de asistencia pueda escanear en grupo toda la tira antes de pasar a otras regiones de la interfaz de usuario.

#### Configuración de seguimiento ocular

El hardware de seguimiento ocular (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) se presenta al sistema operativo como un puntero de ratón estándar con clic por permanencia. No se necesita una configuración especial en Prism AAC:

1.  Configura el tiempo de permanencia en el software de tu dispositivo de seguimiento ocular (recomendado: 800–1200 ms para usuarios primerizos).
2.  Abre Prism AAC en Modo de cabecera en cualquier navegador.
3.  Permanece sobre una Tarjeta de Frases Rápidas para activarla.

El tamaño mínimo de la tarjeta (88 × 80 px) cumple con el requisito de tamaño objetivo AAA de WCAG 2.5.5 de 44 × 44 CSS px, y supera el mínimo típico recomendado para la interacción con la mirada (60 × 60 px).

---

<details>
<summary><strong>Todas las características + detalles de implementación técnica</strong></summary>

**Cinco subsistemas entregados como una sola característica:**

1.  **Tarjetas de Frases Rápidas** — `services/bedsideCards.ts` + UI de la tira en `components/BedsideOverlay.tsx`.

    -   Almacenamiento: clave `localStorage` `prism_bedside_cards_v1`. Validado por esquema en cada carga — las entradas mal formadas se eliminan silenciosamente.
    -   Límite: máximo 50 tarjetas personalizadas (evita el crecimiento ilimitado del almacenamiento).
    -   Tarjetas incorporadas: 15 entradas con `id` prefijado `builtin-`; la guardia de la UI de eliminación verifica este prefijo antes de mostrar la insignia ✕, asegurando que los valores predeterminados nunca se eliminen.
    -   Generación de iconos de IA: `services/aiService.ts → inferCardIcon(text)`. Utiliza la misma cadena de enrutamiento local-Ollama → nube Synalux que el resto de la aplicación. Envía la frase como un mensaje de usuario con un prompt de sistema bloqueado ("Responde con exactamente un emoji…"). Extrae el primer punto de código Unicode de la respuesta. Siempre se resuelve — recurre a 💬 en caso de error de red o respuesta no emoji.
    -   Sin conexión: las tarjetas funcionan completamente sin conexión; solo añadir una nueva tarjeta requiere red (para la generación de iconos — recurre a 💬 si está sin conexión).

2.  **Bucle de IA manos libres (🔁)** — también accesible desde el encabezado del chat de IA principal. Después de cada respuesta de la IA, el micrófono se reinicia automáticamente (retraso de 1 s). Un patrón de referencia `handsFreeRef` / `startListeningRef` asegura que el efecto siempre llama a la devolución de llamada actual sin volver a ejecutarse en cada renderizado.

    ![Hands-free status bar in main AI panel](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3.  **Superposición de cabecera** — `fixed inset-0 z-50 bg-black` UI oscura a pantalla completa renderizada como un `<Fragment>` hermano junto al panel de IA principal para que el estado del panel se conserve entre ciclos de apertura/cierre. Accesibilidad: `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, trampa de enfoque WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab cicla dentro de la superposición, `Escape` cierra). Cobertura de la ventana gráfica verificada de forma independiente E2E (tolerancia ≤ 4 px).

    -   **Botón de micrófono grande** — 112 × 112 px (`w-28 h-28`), rojo + pulsante mientras escucha, borde blanco en reposo. Verificado ≥ 96 px por `boundingBox()` de Playwright.
    -   **Tira de Tarjetas Rápidas** — fila de desplazamiento horizontal, cada tarjeta `88 × 80 px`, `data-scan-group="quick-cards"` para agrupación de escaneo por interruptor, `role="list"` / `role="listitem"` para semántica de lector de pantalla.
    -   **Fila de controles** — Manos Libres (verde cuando está activado), palabra de activación "Hey Prism" (azul cuando está activado, oculto cuando `!wakeWordSupported`), acceso directo al Control por Voz de iOS.
    -   **Salir** — botón ✕ (`w-12 h-12`) o `Escape` → `onClose()` → `bedsideModeActive = false` en `AIChatPanel` → WCAG 2.4.3 el enfoque se devuelve al botón 🛏 que abrió el diálogo.

    ![Bedside overlay — closed, back to main AI panel](../../e2e/_screenshots/bedside-overlay-closed.png)

4.  **Palabra de activación "Hey Prism"** — `services/wakeWordService.ts`. Ejecuta una sesión continua de `SpeechRecognition` en segundo plano. Detecta cualquier transcripción que contenga "hey prism", activa el micrófono una vez y luego se reinicia para el siguiente ciclo. Guardia: no se inicia cuando el puente nativo de iOS posee el micrófono (`prismNativeBridge?.startVoice` presente). El estado activo de la palabra de activación se muestra en la barra de estado del panel principal después de cerrar la superposición.

    ![Status bar showing "Hey Prism" active](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5.  **Guía de Control por Voz de iOS** — al tocar 📱 en la fila de controles, intenta `prismNativeBridge.openSettings('accessibility')` (enlaza directamente a Accesibilidad en compilaciones nativas compatibles). En la web / escritorio, recurre a una tarjeta de instrucciones en la superposición que guía a través de `Ajustes → Accesibilidad → Control por Voz → Activado`.

    <p align="center">
      <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Tarjeta de instrucciones de Control por Voz de iOS — guía paso a paso mostrada dentro de la superposición de cabecera cuando se toca 📱 en la web/escritorio" width="260">
      <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Tarjeta de instrucciones de Control por Voz de iOS después de ser descartada — la superposición vuelve al diseño normal de cabecera" width="260">
    </p>

**Cobertura de pruebas:**
-   `services/bedsideCards.test.ts` — 22 pruebas unitarias: conjunto de tarjetas predeterminadas, ida y vuelta de localStorage, respaldo de JSON mal formado, filtrado de tarjetas inválidas, límite de 50 tarjetas, restricciones de campo `createCard`.
-   `e2e/bedside-mode.spec.ts` — 17 pruebas E2E de Playwright: visibilidad de botones, alternancia `aria-pressed`, clases de estado verde/azul, texto de la barra de estado, atributos de accesibilidad de la superposición, tamaño de `boundingBox` del micrófono, cobertura de la ventana gráfica, mostrar/descartar tarjeta de instrucciones.

**Archivos clave:**
-   `components/AIChatPanel.tsx` — estado de cabecera, estado de tarjetas (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, bucle manos libres, ciclo de vida de la palabra de activación, botones de encabezado
-   `components/BedsideOverlay.tsx` — UI de superposición, tira de Tarjetas Rápidas, diálogo de añadir tarjeta, modo de edición, trampa de enfoque, tarjeta de instrucciones de control por voz
-   `services/bedsideCards.ts` — tipo `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
-   `services/aiService.ts` → `inferCardIcon(text)` — inferencia de emoji de IA
-   `services/wakeWordService.ts` — detección continua de frase de activación
</details>

---

### 📨 Enviar un mensaje — selector de proveedor
Cuando un contacto tiene múltiples proveedores configurados (por ejemplo, tanto Correo como SMS), aparece una sección **"Enviar vía"** encima del área de composición. Un solo toque cambia de proveedor antes de componer — no es necesario salir del panel.

![Contact provider picker — 'Send via' row with Mail highlighted green, SMS available](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat AAC
Los mensajes entrantes de proveedores conectados (Telegram, WhatsApp, Email, Slack, etc.) llegan a este panel. La insignia de no leídos en la barra de herramientas muestra el recuento, la alarma + la notificación entre pestañas se activa cuando llega un nuevo mensaje, y tocar una línea de mensaje la copia en la barra para que el niño pueda componer una respuesta con su propia voz.

![AAC Chat panel showing inbound caregiver messages with unread badge](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Bandeja de entrada consultada a través del portal Synalux `/api/v1/prism-aac/inbox/poll` (no-op en 404 si el portal no está configurado)
- Notificación `BroadcastChannel` entre pestañas en caso de nuevo mensaje
- Abstracción de proveedor: añadir Outlook / Slack / Discord = ~30 LOC cada uno (ver `synalux-private/scripts/fetch-messages.mjs`)
- El estado de lectura se sincroniza para que los cuidadores vean cuándo el niño ha visto su mensaje
- Nivel gratuito: 1 proveedor conectado; nivel de pago: ilimitado
- TTS por mensaje para que el niño pueda escuchar el texto entrante con su voz preferida

**Ruta de renderizado:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (sondeo de 5s cuando sidePanel === 'aac-chat', 60s en caso contrario) → `useScheduleStore.setIncomingMessages()`. Cada mensaje también se añade a la pista "Mensajes de cuidadores" del horario.
</details>

---

### 🧮 Asignaturas escolares
Lienzo de cuadrícula de celdas que alberga **19 teclados de asignaturas** que cubren el programa completo de secundaria: matemáticas + ciencias + programación + artes + humanidades. Cada pestaña enruta al tutor de IA a través de una plantilla de prompt específica del dominio (33 plantillas en total) para que el modelo no aplique el razonamiento algebraico a un cuadro de Punnett o confunda una dinámica musical con un literal de programación. **El historial es consciente de la configuración regional + región** hasta el nivel de estado / provincia / Land / comunidad autónoma — más de 280 regiones en 23 países.

![Cell-grid canvas with 5 + 7 = 12 typed across cells](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Pestañas de asignaturas (19 en total)</strong></summary>

**Matemáticas (9 teclados)** — Principal, Matemáticas Avanzadas (π √ exponentes + 5 herramientas de decoración: caja de fracciones, casa de división larga, barra de raíz, línea de sumatoria, barra de fracción), a–z, Matemáticas Varias (teoría de conjuntos + lógica), Tiempo y Distancia, Peso, Volumen, Geometría, Dinero.

**Ciencias (4)** — Química (24 elementos + flechas de reacción + cargas + subíndices + marcadores de fase), Física (griego completo + 16 unidades SI + ∫/∂/∇/∑/∏ + constantes), Biología (ADN/ARN + genética + 8 rangos de taxonomía + 12 orgánulos), Estadística (μ σ x̄ + 12 operaciones + distribuciones).

**Programación (2)** — Python (24 operaciones + 26 palabras clave) y Java (24 operaciones + 26 palabras clave). El código se envía un carácter por celda para que se disponga de forma natural en la cuadrícula monoespaciada.

**Artes + Humanidades (4)** — Música (3 claves + 6 notas + 5 silencios + 5 alteraciones + 8 dinámicas), Ciencias de la Tierra (clima + placas + 10 planetas + UA/al/pc/Mya/Gya), Historia (consciente de la configuración regional + región), Lenguaje y Literatura (12 etiquetas POS + 6 tipos de oraciones + puntuación + estilos de citación).

</details>

<details>
<summary><strong>Tutor de IA — 11 dominios × 3 modos = 33 prompts</strong></summary>

![AI tutor overlay with mocked hint above the canvas](../../docs/screenshots/math-tutor-hint.png)

Tres modos por asignatura: 💡 **Pista** (sugerencia suave del siguiente paso, nunca resuelve), ✓ **Verificar** (valida la respuesta del niño, celebra si es correcta), 🎓 **Resolver** (explicación completa paso a paso, máximo 4 pasos). La pestaña activa le dice al tutor en qué asignatura está el niño. Tiempo de espera forzado de 15 s + botón Reintentar para que la superposición nunca se quede atascada.
</details>

<details>
<summary><strong>Historia — consciente de la configuración regional + región</strong></summary>

![History keyboard in en locale (no region) — universal + national tiers](../../docs/screenshots/math-keyboard-history-en.png)
![History keyboard with US-TX region — Alamo, Texas annexation, JFK appear](../../docs/screenshots/math-keyboard-history-us-tx.png)

Tres niveles apilados:
1.  Eventos **universales** enseñados en todos los currículos (476, 1914 Primera Guerra Mundial, 1939 Segunda Guerra Mundial, 1969 luna)
2.  Eventos **nacionales** seleccionados por `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 idiomas compatibles
3.  Eventos **subnacionales** seleccionados por `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **más de 280 regiones en 23 países**, incluyendo los 50 estados de EE. UU. + DC, 13 provincias / territorios canadienses, las 4 naciones del Reino Unido, Irlanda (República + 4 provincias históricas), los 16 Länder alemanes, las 17 comunidades autónomas españolas, las 20 regiones italianas, además de AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

El prompt del tutor lleva la configuración regional + región para que una fecha ambigua como 1836 en `US-TX` se resuelva como el Álamo (no la estadidad de Alabama); 1759 en `CA-QC` se ancle a las Llanuras de Abraham; 1714 en `ES-CT` a la caída de Barcelona.

</details>

<details>
<summary><strong>Flujos de trabajo de prueba — 12 asignaturas × problemas de palabras de Grado 8-12 × 72 pruebas de Playwright</strong></summary>

Hojas de problemas paso a paso que ejercitan cada teclado de asignatura, además de una prueba ejecutable de Playwright por problema que controla el panel de matemáticas en vivo y verifica que los glifos de cada paso caigan en la cuadrícula de celdas. Modelado directamente a partir de una página de referencia de álgebra de Grado 9 real.

-   **Capa 1 — paso a paso genérico:** [`tests/workflows/`](tests/workflows/) — 12 documentos markdown (matemáticas avanzadas, biología, química, ciencias de la tierra, geometría, historia, lenguaje y literatura, matemáticas varias, física, programación-java, programación-python, estadística).
-   **Capa 2 — aula real por nivel de grado:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 documentos markdown con problemas de palabras con variables nombradas (álgebra-grado-9, geometría-grado-10, física-grado-11, química-grado-10, biología-grado-9, estadística-grado-11, programación-python-grado-9, programación-java-grado-11, precálculo-grado-12, ciencias de la tierra-grado-9, lenguaje y literatura-grado-8, historia mundial-grado-10) + [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md) de brecha de teclado por asignatura.
-   **Capa 3 — Playwright e2e:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 pruebas (`npx playwright test --project=desktop e2e/math-workflows`).

Índice completo, asignaturas con menos soporte clasificadas y el manual "cómo añadir un nuevo flujo de trabajo" → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Otras funciones de matemáticas (herramienta de bloqueo, magnificación de dos toques, guardar / sincronizar)</strong></summary>

-   **Herramienta de bloqueo** — después de que el niño termina un problema, bloquea la región. Las celdas bloqueadas se muestran ligeramente atenuadas y rechazan las ediciones.
-   **Magnificación de dos toques** — el primer toque arma la tecla (escala 1.4× + halo verde), el segundo toque la confirma. Desarmado automático en 2 s. Para usuarios con imprecisión motora.
-   **Guardar + sincronizar** — primero localmente en `localStorage`; sincronización de mejor esfuerzo con el portal Synalux a través del botón `↻ Sincronizar`. Límite de 100 documentos / 200 KB de cuerpo; los más antiguos se eliminan.
-   **Permanencia de pulsación** — permanencia configurable por tecla (0–1500ms) con anillo de progreso verde.

![Saved docs overlay showing one entry and a Sync button](../../docs/screenshots/math-docs-overlay.png)
![A digit key armed in the green-halo magnified state](../../docs/screenshots/math-two-hit-armed.png)
![Lock tool armed, prompting the user to tap a corner of the region](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Teclados de asignaturas — imágenes adicionales</strong></summary>

![Chemistry keyboard with H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Biology keyboard with A T G](../../docs/screenshots/math-keyboard-biology.png)
![Java keyboard with `private String`](../../docs/screenshots/math-keyboard-java.png)
![Music keyboard](../../docs/screenshots/math-keyboard-music.png)
![Statistics keyboard](../../docs/screenshots/math-keyboard-statistics.png)
![Earth Science keyboard](../../docs/screenshots/math-keyboard-earth-science.png)
![Language Arts keyboard](../../docs/screenshots/math-keyboard-language-arts.png)
![Romanian-locale history](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Horario
Horario visual "primero-luego" para apoyo a la rutina y la transición. Cada paso es una ficha de imagen + etiqueta; al finalizar una ficha, suena un timbre + una marca de progreso visual. La tienda de recompensas (nivel de pago) se desbloquea al final de una rutina.

![Schedule panel with first-then board + activity list](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Cuadrícula preestablecida de 24 fichas para añadir actividades con un solo toque: despertarse, cepillarse los dientes, desayunar, escuela, merienda, almuerzo, jugar, leer, arte, caminar, cenar, bañarse, cuento para dormir, hora de dormir, medicación, usar hilo dental, ordenar, lavar la ropa, cuidado de mascotas, deportes, …
- Reordenar arrastrando y soltando; edición en línea con icono de lápiz; las adiciones preestablecidas llevan `textKey` para que el cambio de idioma reetiquete
- Máquina de estados "Primero-Luego": pulso de ficha armada, timbre ascendente de 3 notas al expirar el temporizador, seguro para el movimiento (`prefers-reduced-motion` → anillo estático), semántica `aria-pressed`
- Calentamiento de audio: un oscilador de 1Hz casi silencioso mantiene el AudioContext "en funcionamiento" en iOS Safari para que el timbre del temporizador suene realmente después de un largo silencio (sin calentamiento, el timbre se dispara en un contexto suspendido = sin sonido)
- Los mensajes del cuidador se añaden al horario como una pista de "Mensajes" para que el niño vea lo que viene + quién envió el mensaje

**Ruta de renderizado:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 actividades preestablecidas + personalizadas) → `services/feedback.ts:playTimerRing()` → AudioContext compartido a través de `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Juegos
12 juegos de AAC basados en evidencia. Construidos para enseñar comunicación, **no para tiempo de pantalla**. Cada juego registra las vocalizaciones + la precisión para que el motor adaptativo pueda sugerir el siguiente juego más adecuado.

![Games panel with 9 game tiles](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Los 12 juegos + detalles técnicos</strong></summary>

| Juego | Habilidad objetivo |
|---|---|
| Bubble Pop | Causa + efecto, comunicación intencional |
| Color Hunt | Vocabulario receptivo (nombres de colores) |
| My Story | Secuenciación narrativa |
| Match It | Emparejamiento + pensamiento categórico |
| Yes/No | Discriminación binaria, pedir/rechazar |
| Finish It | Completar oraciones (cloze) |
| Category Sort | Categorización semántica |
| Emotion Match | Etiquetado de afectos, ToM |
| What Comes Next | Razonamiento secuencial |
| Same / Different | Discriminación visual — emparejar o contrastar |
| I Hear It (Sound Match) | Discriminación auditiva + vocabulario |
| Turn Taker | Práctica de toma de turnos sociales |

- Nivel gratuito: Bubble Pop, Color Hunt, My Story (3 juegos)
- Nivel de pago: los 12
- Los datos por juego alimentan `services/adaptiveEngine.ts` — longitud de la vocalización / categoría / hora del día / resultado → sugiere el siguiente juego
- Todos los juegos deshabilitan las categorías de fichas AAC que no son relevantes para el vocabulario de ese juego, para que el niño no se distraiga

**Ruta de renderizado:** `components/GamesPanel.tsx` → componentes de juegos individuales en `components/games/`. Cada juego registra a través de `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Tienda
Paquetes de voz (voces de Inworld, voz personalizada clonada de un hermano/padre), paquetes de vocabulario (vocabulario central en español, habla con apoyo de signos), paquetes de juegos (juegos adicionales más allá de los 9). Las aplicaciones se instalan en la barra de herramientas a través del mismo registro que utilizan los paneles incorporados.

![Marketplace panel with installable apps](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Las aplicaciones residen como entradas JSON (`lib/marketplace/manifests/local.ts`) + un `lib/marketplace/registry.ts` en tiempo de ejecución con `getHandler(appId)` que devuelve el componente del panel
- Clonación de voz (nivel de pago): grabación de 90s → voz entrenada utilizable para cualquier TTS en la aplicación, incluyendo las fichas de categoría
- Las aplicaciones instaladas se renderizan como botones de la barra de herramientas después de las incorporadas; `useSettingsStore.installedApps` es la fuente de verdad
- Puerta por nivel: la tienda lista todo, pero los botones de instalación se deshabilitan para los elementos que superan el plan del usuario

**Ruta de renderizado:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` para la compra, luego descarga de activos (archivos de voz, JSON de vocabulario) en IndexedDB.
</details>

---

### 📄 Lector de PDF
Abre un PDF, ve una ficha por página, toca para escucharla en tu voz. Hojas de trabajo escolares, cartas para llevar a casa, artículos — introduce cualquier PDF y escucha en lugar de intentar leerlo. No se requiere Adobe Reader; toda la biblioteca se ejecuta en tu navegador.

![PDF Reader panel — empty state with "+ Open PDF" prompt](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Una ficha por página; cada una muestra las primeras 3 líneas + un botón `▶ Página N` que se envía a través de `aacSpeak()` (misma voz + tono + resaltado de palabras que todo lo demás)
- `▶ Leer todo` concatena cada página en una vocalización continua
- La detección de páginas vacías (PDFs de imágenes escaneadas) sugiere la herramienta OCR
- `pdfjs-dist` importado dinámicamente en la primera apertura — un fragmento separado de ~3 MB del CDN, con versión fijada al paquete npm
- El botón de la barra de herramientas (📄) es opcional a través de Ajustes → Barra de herramientas para que la barra de herramientas predeterminada mínima permanezca limpia

**Ruta de renderizado:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (`getDocument` de pdfjs → `getTextContent` por página) → `services/aacSpeak.ts`.
</details>

---

### 👁 Lector de capturas de pantalla (OCR)
Pega o sube una foto de una hoja de trabajo, una captura de pantalla de una página web, una imagen de una página de libro de texto — el texto reconocido aparece junto a la imagen y puedes tocar **▶ Hablar** para escucharlo, o **↧ Enviar a la barra de mensajes** para editar antes de hablar.

![Screenshot Reader (OCR) panel — empty state with "+ Open image" prompt](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

- Matriz OCR de 20 idiomas mapeada desde las configuraciones regionales de Prism AAC a los códigos de Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Archivos `traineddata` por idioma almacenados en caché después del primer uso (~10 MB para inglés, más para CJK) — la primera ejecución muestra "Leyendo la imagen… (la primera ejecución descarga el modelo OCR — puede tardar 10-30 s)"
- Se muestra el porcentaje de confianza para que el usuario de AAC pueda saber si confiar en el resultado o volver a tomar la foto
- El hook de limpieza `disposeOcr()` termina cada worker generado al descargar la página para liberar la memoria WASM
- El botón de la barra de herramientas (👁) es opcional a través de Ajustes → Barra de herramientas

**Ruta de renderizado:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`createWorker` de `tesseract.js` → `recognize`) → `services/aacSpeak.ts` o `messageStore.setText`.
</details>

---

### 🎧 Reproductor de confort

Reproductor multimedia de cabecera para pacientes hospitalizados — coma, UCI, no verbales o cualquier persona que necesite contenido de confort continuo junto a la cama.

<details>
<summary>Detalles de la característica</summary>

Familiares y amigos graban mensajes de voz, suben fotos y videos. La lista de reproducción se reproduce en bucle continuamente para que el paciente siempre tenga voces y caras familiares cerca.

-   **Grabar** mensajes de voz directamente en la aplicación (API MediaRecorder)
-   **Subir** archivos de audio, fotos y videoclips (100 MB por archivo, 500 MB en total)
-   **Bucle automático** a través de todos los elementos continuamente — configúralo y aléjate
-   Modo **pantalla completa** para fotos y video (pantalla de cabecera)
-   Integración **TTS nativa** — las frases tocadas se pronuncian a través de AVSpeechSynthesizer en iOS
-   **Sin conexión** — todos los medios almacenados en IndexedDB, funciona sin internet
-   **Accesible por teclado** — cada control tiene etiquetas ARIA y navegación por teclado
-   **Revisado con grado militar** — 27 hallazgos de seguridad corregidos (fugas de URL de blob, manejo de cuotas, validación de entrada, listas blancas MIME, limpieza al desmontar)
-   El botón de la barra de herramientas (🎧) es opcional a través de Ajustes → Barra de herramientas

**Límites de almacenamiento:** 50 elementos como máximo, 100 MB por archivo, 500 MB en total. Los tipos MIME están restringidos a audio (webm/mp4/mpeg/ogg/wav), imágenes (jpeg/png/gif/webp/heic) y video (mp4/webm/quicktime).

**Ruta de renderizado:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (blobs de IndexedDB).
</details>

---

### 🧩 Extensión de Chrome — las mismas funciones de asistente de lectura en cualquier campo de texto
La aplicación web Prism AAC cubre el flujo del asistente de lectura dentro de su propia superficie. La extensión de Chrome (`chrome-extension/`) lleva el **mismo comportamiento a CUALQUIER campo de texto en CUALQUIER sitio** — Gmail, Google Docs, Word Online, portales escolares, formularios bancarios — cerrando la única brecha de Read & Write que no era accesible solo desde una página web.

![PrismAAC Reading Assistant — speak as you type, with word-by-word highlight, in any text field](../../docs/screenshots/extension-marquee.png)

La superposición flotante se adjunta encima de cualquier campo de texto enfocado. Toca **▶ Hablar** para volver a leer, o simplemente sigue escribiendo — terminar una frase con `.?!` la lee automáticamente con cada palabra iluminándose en amarillo a medida que se pronuncia:

![PrismAAC overlay above a compose page, mid-sentence with "school" highlighted yellow as TTS speaks it](../../docs/screenshots/extension-overlay.png)

La traducción mientras se habla muestra AMBAS la línea de origen (cursiva pequeña) y la línea traducida (tamaño completo, con resaltado de palabra activa a medida que se pronuncia). Más de 50 idiomas a través del endpoint público gratuito de Google (sin clave API):

![PrismAAC overlay translating English to Romanian — source line "I had a really good day at school today" with translated "Am avut o zi foarte bună la școală astăzi" below, "foarte" highlighted](../../docs/screenshots/extension-translate.png)

Página de opciones — la configuración se sincroniza en el perfil de Chrome del usuario a través de `chrome.storage.sync`. Lista de deshabilitación por sitio, selector de voz, deslizadores de velocidad / volumen / tono, selectores de idioma, todo opcional:

![PrismAAC extension options page — speak triggers, target language Romanian, voice picker, rate/volume/pitch sliders](../../docs/screenshots/extension-options.png)

**Instalar (modo desarrollador por ahora — listado en Chrome Web Store pendiente de revisión):**

```sh
cd chrome-extension
npm install
npm run build
```

Abre `chrome://extensions`, habilita el **Modo de desarrollador**, haz clic en **Cargar descomprimida** y selecciona `chrome-extension/dist`.

**Características:**

-   Hablar la frase al `.?!`, hablar cada palabra al espacio, todo conmutable
-   **Resaltado palabra por palabra** impulsado por el evento `SpeechSynthesisUtterance.boundary` nativo del navegador (sincronización VERDADERA por palabra, frente a la heurística de ~60 ms/carácter de la aplicación web — la ruta del portal devuelve MP3 sin eventos de transmisión, pero Web Speech los expone de forma nativa)
-   **Traducir mientras se habla** — elige un idioma de destino (más de 50 compatibles a través del endpoint público gratuito de Google, sin clave API). La superposición muestra AMBAS la línea de origen (cursiva pequeña) Y la línea traducida (con resaltado de palabra activa); se selecciona automáticamente una voz de Web Speech que coincida con el idioma de destino
-   Superposición flotante de Shadow-DOM anclada encima del campo enfocado (▶ Hablar, 📌 Fijar, × Cerrar)
-   `Cmd / Ctrl + Shift + S` para hablar el campo enfocado bajo demanda; `Esc` cancela
-   Lista de deshabilitación por sitio para banca / formularios sensibles
-   La configuración se sincroniza en el perfil de Chrome del usuario a través de `chrome.storage.sync` — no se requiere una cuenta de Prism AAC

**Privacidad:** el modo sin traducción es completamente sin conexión (Web Speech se ejecuta de forma nativa). El modo de traducción realiza una llamada HTTPS por cada frase única a `translate.googleapis.com` (almacenada en caché después del primer acceso). Código fuente disponible en [`chrome-extension/`](chrome-extension/) — paquete TypeScript + esbuild (contenido 18 KB, opciones 7 KB, fondo 339 B).

---

### 👋 Gestos manos libres
Entrada opcional basada en cámara para usuarios que no pueden tocar de forma fiable. Perfiles de clic por permanencia de la postura de la cabeza + gestos de la postura de la mano. Se ejecuta localmente — ningún video sale del dispositivo.

<details>
<summary><strong>Características + detalles técnicos</strong></summary>

-   **Modo básico**: seguimiento de la postura de la cabeza (FaceLandmarker, Mediapipe). El usuario mira una tecla, mantiene la mirada durante `headTrackingDwellMs` (predeterminado 1200 ms) → clic. Un anillo de progreso visual se llena durante la permanencia.
-   **Modo avanzado**: seguimiento de la postura de la mano. Perfiles de gestos personalizados por usuario (palma abierta = enter, puño = retroceso, pellizco = espacio, etc.) configurados a través de `components/HandCalibration.tsx`.
-   Pila de seguridad contra la deriva: si la cabeza del usuario se desvía más de `headTrackingDriftThresholdPx` durante `headTrackingDriftWindowMs` fotogramas consecutivos, el seguimiento se desactiva automáticamente y muestra un mensaje de recalibración (informado por el usuario en mayo de 2026: el seguimiento seguiría silenciosamente la deriva durante una hora y perdería los objetivos de tecla reales).
-   **Vía de escape Esc** — presionar Esc en cualquier teclado desactiva inmediatamente el seguimiento y vuelve a mostrar el teclado qwerty sin perder la barra de mensajes.
-   Singleton de flujo de cámara (`services/cameraStream.ts`) para que el seguimiento de cabeza + mano compartan un flujo; cambiar de modo es gratuito.
-   La calibración por usuario persiste; el rastreador corporal se recupera automáticamente al reanudar la sesión.

**Documentación detallada:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (matemáticas de calibración, aprendiz por percentiles, egomoción, filtro One Euro, ~30 parámetros ajustables), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ Ajustes
23 idiomas, tema (claro / oscuro / alto contraste), tamaño de cuadrícula (4–20 fichas), adaptaciones motoras (permanencia de pulsación en matemáticas, magnificación de dos toques, permanencia de seguimiento de cabeza, sensibilidad de gestos, desactivación automática de deriva), selector de voz (de pago), autocorrección de IA activada/desactivada, notificaciones, personalización de la barra de herramientas, selector de región de historial.

![Settings — language picker + theme toggle](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Ajustes de matemáticas + accesibilidad</strong></summary>

![Settings — math hold-time + two-hit magnify](../../docs/screenshots/panel-settings-math.png)

-   **Permanencia de pulsación en matemáticas** — deslizador de 0–1500 ms; 0 = clic instantáneo, 200–1500 ms ayuda a usuarios con imprecisión motora (un anillo de progreso verde se llena durante la permanencia para que puedan verlo).
-   **Magnificación de dos toques** — el primer toque en cualquier tecla de matemáticas la arma (escala 1.4× + halo verde, sin confirmación), el segundo toque la confirma. Se desarma automáticamente en 2 s. Se combina con la permanencia de pulsación.
-   **Permanencia de seguimiento de cabeza** — 200–5000 ms.
-   **Sensibilidad** — 1–10.
-   **Desactivación automática de deriva** — alternar + umbral (px) + ventana (ms).
-   **Mostrar calibración de mano** — abre el editor de perfiles de postura de mano.

</details>

<details>
<summary><strong>Modos de entrada — voz, gestos, autocorrección de IA</strong></summary>

![Settings — input modes panel](../../docs/screenshots/panel-settings-input-modes.png)

-   **Entrada de voz** — API Web Speech, consciente del idioma (inglés del Reino Unido vs inglés de EE. UU., etc.); nivel gratuito
-   **Autocorrección y completado de IA** — cada pausa de pulsación se enruta a través de la autocorrección en la nube (Gemini 2.5 Flash-Lite). Desactivado por defecto en escenarios de bajo ancho de banda.
-   **Notificaciones** — alarma + notificación entre pestañas en mensajes de chat AAC entrantes.
-   **Entrada de cámara** — interruptor maestro de seguimiento de cabeza + mano.
-   **Objetivo de seguimiento de cámara** — cabeza, mano o detección automática.

</details>

<details>
<summary><strong>Personalización de la barra de herramientas</strong></summary>

La barra de herramientas es completamente reordenable. La versión predeterminada 0.9.0 se envía con un conjunto mínimo (micrófono, chat AAC, alerta, categorías, ajustes) para que la pantalla permanezca despejada para los nuevos usuarios — cualquier otra función incorporada (matemáticas, chat de IA, horario, juegos, tienda, reproductor de confort, notas, historial, sonido) se puede volver a habilitar con un solo toque en Ajustes → Barra de herramientas. Las aplicaciones instaladas desde la tienda se insertan automáticamente después de las incorporadas.

</details>

---

## Pruébalo

| | |
|---|---|
| 🌐 **Aplicación web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — pruébala en cualquier navegador |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Código fuente** | Este repositorio. AGPL-3.0 — bifurca libremente, comparte las modificaciones |

---

## Planes

| | Gratuito | De pago |
|---|---|---|
| Fichas de imágenes + 22 categorías | ✅ | ✅ |
| Escribir para hablar | ✅ | ✅ |
| Voz predeterminada (Inworld) | ✅ | ✅ |
| Teclado escolar de 19 asignaturas + tutor de IA | ✅ básico | ✅ + modelos premium |
| Horario | ✅ | ✅ + tienda de recompensas |
| Juegos | 3 (Bubble Pop, Color Hunt, My Story) | Los 12 |
| Selector de voz | — | ✅ todas las voces de Inworld |
| Clonación de voz (tu propia voz) | — | ✅ |
| Sincronización de notas del cuidador | — | ✅ |
| Predicción de palabras (aprendizaje por usuario) | — | ✅ |
| Historial de configuración regional + región | ✅ | ✅ |
| Entrada de gestos manos libres | ✅ | ✅ |

[Ver precios de Synalux →](https://synalux.ai/pricing)

---

## Seguridad clínica

-   **El acceso a AAC nunca se restringe como consecuencia.** Un niño siempre debe tener su voz.
-   **No hay PHI en la nube sin consentimiento.** Las notas del cuidador se cifran antes de subirse.
-   **El audio permanece local.** La entrada de voz se transcribe en el navegador a través de la API Web Speech.
-   **Diseñado por BCBA.** El seguimiento de operantes verbales coincide con la 5ª Edición de la Lista de Tareas de BACB.
-   **Valores predeterminados informados sobre el trauma.** Sin mecánicas de castigo. La tienda de recompensas es opcional.

Leer más: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Infraestructura y GDPR

### Arquitectura multirregión

| Componente | Región | Propósito |
|---|---|---|
| **Supabase US** | Este de EE. UU. (Virginia) | Base de datos principal — autenticación, datos de usuario, notas del cuidador |
| **Supabase EU** | Centro de la UE (Fráncfort) | Cumple con GDPR — los datos de usuarios de la UE nunca salen de la UE |
| **Vercel** | Borde global | Aplicación web, rutas API, CDN |
| **Inworld TTS** | EE. UU. | Síntesis de texto a voz neuronal |
| **HuggingFace Hub** | EE. UU./UE | Pesos del modelo (1.7B, 8B, 14B, 32B) |
| **En el dispositivo** | Dispositivo del usuario | Inferencia de llama.cpp (iPhone/iPad/Mac) |

### Cumplimiento del GDPR

Los datos de los usuarios de la UE se almacenan exclusivamente en la región de Fráncfort (eu-central-1). El portal detecta la ubicación del usuario a través del encabezado `x-vercel-ip-country` de Vercel y enruta las operaciones de la base de datos a la instancia de Supabase adecuada:

-   **Usuarios de la UE** → `supabase-eu` (Fráncfort) — datos personales, autenticación, preferencias, notas del cuidador
-   **Usuarios no pertenecientes a la UE** → `supabase-us` (Virginia) — mismas categorías de datos, jurisdicción de EE. UU.
-   **Inferencia de IA** → en el dispositivo (no salen datos del dispositivo) o API de Synalux (no se almacena PII)
-   **Audio TTS** → generado en el servidor, transmitido al cliente, no almacenado

**Garantías de residencia de datos:**
-   Los datos personales de la UE nunca transitan por servidores de EE. UU.
-   Tokens de autenticación con ámbito en la instancia regional de Supabase
-   Notas del cuidador cifradas en reposo (Supabase AES-256)
-   Grabaciones de voz (Reproductor de confort) almacenadas en IndexedDB del navegador — nunca subidas
-   El modelo de IA en el dispositivo se ejecuta localmente — cero telemetría en la nube

**Derecho al borrado:** La eliminación de usuarios se propaga a través de la autenticación, perfiles, notas del cuidador y análisis de uso en la base de datos regional. Las instancias autoalojadas se pueden borrar con `supabase db reset`.

### Costos a escala

| Usuarios | Supabase | Vercel | TTS | Modelos de IA | Total |
|---|---|---|---|---|---|
| 0–1K | $50/mes (2 regiones) | $0 (Hobby) | ~$5/mes | $0 (en el dispositivo) | ~$55/mes |
| 1K–10K | $50/mes | $20/mes (Pro) | ~$50/mes | $0 | ~$120/mes |
| 10K–100K | $50/mes + complementos de cómputo | $20/mes | ~$200/mes | RunPod $125/mes | ~$395/mes |

---

## Modelos de IA y soporte de dispositivos

Funciona en todos los dispositivos Apple. Cero dependencia de la nube para la comunicación AAC central.

Prism AAC selecciona automáticamente el mejor modelo que tu hardware puede ejecutar, recurre elegantemente en dispositivos con limitaciones y nunca requiere una conexión a internet para la comunicación básica.

| Dispositivo | RAM | Modelo | Precisión | AAC | Tamaño | Costo |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 14B Q4_K_M (v36) | **100%** | 100% | 8.4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 8B Q4_K_M (v36) → 1.7B (respaldo por OOM) | **100%** | 100% | 4.7 GB / 1.1 GB | $0 |
| **iPhone 12–14, iPads más antiguos** | <8 GB | 1.7B Q4_K_M (v42) | **100%** | 100% | 1.1 GB | $0 |
| **Mac M1+ vía WiFi** | 16+ GB | 14B vía Ollama (v36) | **100%** | 100% | 8.4 GB | $0 |

### Cascada de la aplicación web

La aplicación web intenta primero la inferencia local, luego recurre a la nube, de modo que los usuarios con Ollama instalado pagan $0 y los usuarios sin él siguen obteniendo la funcionalidad completa.

<details>
<summary>Diagrama de cascada</summary>

```
  El usuario envía un mensaje
        |
        v
  +-- OLLAMA LOCAL (autodetectado en localhost:11434) --+
  |                                                      |
  |   14b (100%, ~1.1s) ─[fallo]─> 8b (100%, ~0.8s) ─[fallo]─> 1b7 (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [¿fallan todos los locales?]
         |
         v
  +-- RESPALDO EN LA NUBE (API de Synalux) --------+
  |  Claude Sonnet 4 (de pago) / Gemini (gratuito) |
  |  99% de precisión, ~3s                          |
  +-----------------------------------------+

  Carga lateral automática: el primer lanzamiento detecta Ollama → descarga el mejor modelo → local para siempre.
```

</details>

### Cascada nativa de iOS

La aplicación nativa sondea la RAM disponible al iniciar, descarga el modelo correcto desde HuggingFace CDN (una sola vez) y ejecuta la inferencia a través de llama.cpp Metal. Sin servidor. Sin suscripción. No salen datos del dispositivo.

<details>
<summary>Diagrama de cascada</summary>

```
  Inicio de la aplicación
      |
      v
  Detección de RAM (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 14B Q4_K_M (8.4 GB) ──> 100%, ~1.1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 8B Q4_K_M (4.7 GB) ──> 100%, ~0.8s
      |                                    |
      |                               ¿OOM? → 1.7B Q4_K_M (1.1 GB) → 100%, ~1.6s
      |
      +── <8 GB ──> 1.7B Q4_K_M (1.1 GB) ──> 100%, ~1.6s

  Todas las rutas: llama.cpp Metal, $0 para siempre, no salen datos del dispositivo.
  Actualización WiFi: Ajustes → IA Local → introducir IP de Mac para 14B/32B.
```

</details>

### Modos de diseño de teclado (persistentes)

Tres modos se alternan con un solo toque — el diseño elegido se guarda y se restaura en cada inicio.

-   **KB MÁX** — el teclado llena todo el espacio debajo de la barra de predicción
-   **KB MÍN** — categorías 75% / teclado 25%
-   **KB OCULTO** — categorías a pantalla completa, teclado oculto

<details>
<summary>Diagrama de diseño</summary>

```
  KB MÁX                 KB MÍN                 KB OCULTO
  +--------------------+ +--------------------+ +--------------------+
  | Barra de herramientas | | Barra de herramientas | | Banner de bienvenida |
  | Barra de predicción | | Barra de predicción | |                    |
  |                    | |                    | |                    |
  |  TECLADO           | | Categorías  (75%)  | | Categorías         |
  |  llena todo el     | |                    | | (pantalla completa)|
  |  espacio debajo    | |--------------------| |                    |
  |  de la predicción  | | Teclado     (25%)  | |                    |
  | [123][v][  espacio ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- botón [v] ------->+-- botón barra lateral -->+-- botón barra lateral --+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### Resumen de costos

| Ruta | Modelo | Precisión | Latencia | Costo |
|---|---|---|---|---|
| iPad Pro 16GB | 14B Q4_K_M (v36) | **100%** | ~1.1s | **$0** |
| iPhone/iPad 8GB | 8B Q4_K_M (v36) → 1.7B (respaldo por OOM) | **100%** | ~0.8s | **$0** |
| Cualquier dispositivo | 1.7B Q4_K_M (v42) | **100%** | ~1.6s | **$0** |
| WiFi a Mac | 14B vía Ollama (v36) | **100%** | ~1.1s | **$0** |
| Nube (gratuito) | Gemini 2.5 Flash | 99% | ~3s | Synalux lo absorbe |
| Nube (de pago) | Claude Sonnet 4 | 99% | ~3s | Incluido en el plan |

**La propuesta:** Cada niño obtiene una precisión de nivel Claude, ya sea que esté en un iPhone SE de $329 o en un iPad Pro de $2,000. "Local-first" significa cero dependencia de la nube, cero tarifas API mensuales, cero exposición de PHI y tiempos de respuesta de menos de un segundo. Los cuatro modelos prism-coder obtienen **100%** en el benchmark de enrutamiento de 102 casos (prompt del sistema v36/v7, media de 3 semillas, mayo de 2026), con cero llamadas a herramientas inventadas. El modelo 32B además obtiene **300/300 (100%)** en la suite extendida eval_300 (17 herramientas, 9 categorías, validado con 3 semillas).

---

## Autoalojamiento

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux opera la versión alojada canónica (gratuita + de pago). Los autoalojadores y las bifurcaciones deben liberar las modificaciones bajo AGPL-3.0.

### Modelos de IA locales (costo cero en la nube)

**Opción A — En la aplicación (recomendado):** Ajustes → 🤖 Modelos de IA Local → haz clic en Descargar junto a cualquier modelo. Barra de progreso incluida. Funciona desde iPad/iPhone en la misma red WiFi que un Mac ejecutando Ollama.

**Opción B — Línea de comandos:**

Instala [Ollama](https://ollama.com), luego:

```bash
ollama pull dcostenco/prism-coder:1b7   # 1.1 GB — cualquier máquina, iPhone 12+ — 100% de enrutamiento (v42)
ollama pull dcostenco/prism-coder:8b    # 4.7 GB — iPhone/iPad 8GB, Mac M1+ — 100% de enrutamiento (v36)
ollama pull dcostenco/prism-coder:14b   # 8.4 GB — Mac 16GB+, iPad Pro — 100% de enrutamiento (v36)
ollama pull dcostenco/prism-coder:32b   # 16 GB  — Mac M2 Ultra+ (MoE) — 100% de enrutamiento (v7)
```

Añade a `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone en WiFi:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # en Mac
# Luego en la aplicación Ajustes → IA Local → introducir: http://<mac-ip>:11434
```

Enrutamiento automático: 1.7B → cualquier dispositivo · 8B → móvil/borde · 14B → estándar · 32B → nube/empresa. Respaldo en la nube cuando Ollama no es accesible.

---

<details>
<summary><strong>📚 Arquitectura tecnológica (enrutamiento de modelos, voz, reconocimiento de gestos, detalles de construcción)</strong></summary>

**Pila**: Next.js, Zustand, API Web Speech (transcripción), Inworld TTS-2 + respaldo Azure Neural (voz), FaceLandmarker (gestos).

**Enrutamiento de modelos** (lado del servidor a través del portal Synalux):
-   **En el dispositivo** (toque de botón → frase): `prism-coder:1b7` (Qwen3-1.7B Q4_K_M, llama.cpp Metal) — cero red, cero costo, ~1.6s
-   **Nube simple** (chat, nivel gratuito): `prism-coder:14b` (Qwen3-14B ajustado) → respaldo Gemini 2.5 Flash
-   **Nube compleja** (razonamiento, nivel pro): `prism-coder:32b` (QwQ-32B ajustado) → respaldo Claude Sonnet 4
-   **Autocorrección + predicción de palabras**: Gemini 2.5 Flash-Lite — 752ms de media, multilingüe (ro/ru/es)
-   Las rutas críticas de velocidad (toque de botón → voz) evitan el enrutamiento — nunca se bloquean por la red
-   Precisión de enrutamiento ([evaluación Prism de 102 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), prompt del sistema v36/v7, media de 3 semillas, mayo de 2026):

  | Modelo | Precisión | Latencia media | Herramientas inventadas |
  |---|---|---|---|
  | prism-coder:32b swe14 (local) | **100.0%** | 1.4s | 0 |
  | Cascada 14B→32B (local) | **100.0%** | ~1.1s | 0 |
  | prism-coder:8b v36 (local) | **100.0%** | 0.8s | 0 |
  | prism-coder:14b v36 (local) | **100.0%** | 1.1s | 0 |
  | Sonnet 4 (nube) | **99%** | 3.2s | 0 |
  | Opus 4.7 (nube) | **98.3%** | 3.0s | 0 |
  | prism-coder:1b7 v42 (local) | **100.0%** | 1.6s | 0 |

-   Evaluación extendida — eval_300 (300 casos, 17 herramientas, 9 categorías, 3 semillas): prism-coder:32b = **300/300 (100%)**

**Voz (TTS)** cadena de respaldo:
-   Nivel 1: Inworld TTS-2 (de pago en todos los idiomas; gratuito para ro/uk/ru/de/ko/ar donde Synalux absorbe el costo)
-   Nivel 2: Voces premium de la API Web Speech del SO (sin conexión)
-   Nivel 3: WASM espeak-ng (último recurso)

**Reconocimiento de gestos**:
-   Básico: postura de la cabeza + clic por permanencia a través de FaceLandmarker
-   Avanzado: postura de la mano a través de MediaPipe; perfiles de gestos por usuario

**Arquitectura**: navegación solo modal (sin enrutador), tema a través de tokens.bg/text/border/accent.

**Documentación detallada en este repositorio:**
-   [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — enrutamiento completo de voz
-   [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — detalles internos del modo de gestos
-   [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — cambio automático de tono
-   [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — ruta de alerta crítica para la vida
-   [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — barandillas de aprendizaje por usuario
-   [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — arnés de fiabilidad de seguimiento de cabeza/mano
-   [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — accesibilidad del objetivo táctil
-   [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
-   [`RESEARCH.md`](RESEARCH.md) — base de evidencia
-   [`CHANGELOG.md`](CHANGELOG.md) — historial de versiones

</details>

<details>
<summary><strong>🆕 Por qué Prism AAC es diferente (la pila de algoritmos subyacente)</strong></summary>

**Tres cosas que ninguna otra aplicación AAC en el mercado hace juntas:**

### 1. IA en el dispositivo + segura para HIPAA por defecto

**Por qué la IA local es importante para AAC — velocidad, seguridad y fiabilidad:**

| | Solo IA en la nube | Prism AAC (primero local) |
|--|---|---|
| Toque de botón → voz | 2–30s (ida y vuelta de red) | **~0.5s** (en el dispositivo) |
| Funciona sin conexión | ❌ No | ✅ Sí |
| PHI sale del dispositivo | ✅ Siempre | ❌ Nunca (ruta de voz) |
| Cumplimiento de HIPAA | Requiere BAA con cada proveedor | **En el dispositivo = no se necesita BAA** |
| WiFi rural / deficiente | Roto | **Totalmente funcional** |
| Costo mensual por usuario | $2–15 tarifas API | **$0 (local)** |

**El modelo 1.7B se ejecuta completamente en tu dispositivo** — iPad M1+, Mac o portátil. Un niño que presiona un botón obtiene una respuesta en ~500ms con cero llamadas de red. Ningún PHI, ninguna vocalización, ningún patrón de comunicación sale del dispositivo durante el uso normal.

Las notas del cuidador se cifran localmente antes de cualquier sincronización opcional en la nube. Las plataformas AAC comparables solo en la nube (TouchChat, sincronización en la nube de Proloquo2Go) requieren cargas de cuenta para funcionar — Prism AAC no.

**Para implementaciones empresariales / clínicas (14B + 32B):** los modelos 14B y 32B se ejecutan en un Mac dedicado a través de Ollama en la red clínica. Los iPads se conectan a través de la red WiFi local — los datos nunca salen del edificio. No se necesitan acuerdos con proveedores de la nube para el cumplimiento de HIPAA.

**Cómo configurarlo:**

```
iPad / iPhone (en la misma red WiFi que el Mac)
    ↓  se conecta a
Mac ejecutando Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  sirve
prism-coder:1b7 · :14b · :32b
    ↓  toda la inferencia permanece en
Red local — nada llega a internet
```

Ajustes → 🤖 Modelos de IA Local → introducir IP de Mac → todos los modelos disponibles al instante. Sin costo en la nube. Sin exposición de PHI. Sin dependencia de la red para la comunicación AAC.

### 2. Clasificación de frases que se adapta a TU hijo
Las listas de frecuencia estáticas están obsoletas. Prism AAC clasifica las frases sugeridas a través de la [**activación de propagación Prism v14.0.0**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — el mismo modelo de memoria cognitiva ACT-R detrás de décadas de investigación de Carnegie Mellon. Recencia × frecuencia × historial por usuario, no una lista de popularidad estática. Las frases que el niño dice hoy suben; las frases no utilizadas durante un año se desvanecen (decaimiento de la tasa de lecciones `d=0.25`, vida media de ~1 año).

### 3. Las correcciones del cuidador se convierten en datos de entrenamiento — automáticamente
Cuando un cuidador corrige una sugerencia que el modelo hizo mal (por ejemplo, "no, la palabra es *comer*, no *querer*"), el [recolector post-vuelo de audit-hooks](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) extrae el error y lo persiste. Después de ~50 sesiones, el sistema advierte *antes* de que el modelo cometa un error similar. No hay trabajo de etiquetado para los cuidadores, ni costosas ejecuciones de reentrenamiento — las correcciones son el currículo.

**Alcance honesto:** Precisión de enrutamiento en la [evaluación Prism de 102 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (6 herramientas Prism, 12 categorías, prompt del sistema v36/v7, semillas 2027–2029): 32b v7 = 100.0%, 8b v36 = 100.0%, 14b v36 = 100.0%, 1.7b v42 = 100.0%. Cero nombres de herramientas inventados en todos los tamaños de modelo y todas las semillas. El 1.7B se ejecuta en el dispositivo para un enrutamiento rápido de frases (carga/guardado/compactación); el 14B/32B manejan sesiones complejas y flujos de trabajo clínicos. En la clasificación completa de Berkeley BFCL V4 (más de 2,000 casos, llamada a funciones generales), el 1.7B obtiene ~59% — comparable a otros modelos de menos de 2B. Lo que hace que Prism AAC sea defendible no es solo la puntuación del modelo, sino el modelo más la pila de algoritmos de activación de propagación de Prism que lo rodea.

</details>

---

## Licencia

[AGPL-3.0](LICENSE) — código abierto, aprobado por la OSI, elegible para subvenciones.

Eres libre de bifurcar y autoalojar. La licencia requiere que también compartas las modificaciones bajo AGPL-3.0 — ese es el trato que mantiene la innovación en AAC abierta y accesible para las familias.