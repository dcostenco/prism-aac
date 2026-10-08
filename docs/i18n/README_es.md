<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ayuda a niños y adultos no verbales a hablar.**

Aplicación de Comunicación Aumentativa y Alternativa (CAA) para niños con deficiencias motoras y necesidades complejas de comunicación. Toca imágenes, construye frases, escúchalas en voz alta — en 25 idiomas (28 variantes regionales). Funciona en cualquier tableta, portátil, iPhone, iPad y Apple Watch.

Parte de la [plataforma Synalux](https://synalux.ai).

**Pruébalo ahora:**
- **Aplicación web (gratis):** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — funciona en cualquier dispositivo con un navegador
- **iOS (iPhone + iPad + Apple Watch):** [App Store](https://apps.apple.com/app/id6764692277)
- **Precios:** [synalux.ai/pricing](https://synalux.ai/pricing) — gratis, más un plan opcional Prism AAC Cloud (4,99 US$/mes) para voz natural e inclusión de IA en la nube

🌐 [English](../../README.md) · **Español** · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Descargar-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Probar-Gratis-43e97b?style=for-the-badge" alt="Probar gratis"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Planes-Gratis_+_De_pago-764ba2?style=for-the-badge" alt="Precios"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacidad-Política-lightgrey?style=for-the-badge" alt="Privacidad"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Términos-del_servicio-lightgrey?style=for-the-badge" alt="Términos"></a>
</p>

![Pantalla principal de Prism AAC en iPad — barra de herramientas, barra de escritura, cinco casillas de predicción y el teclado QWERTY completo (aplicación web de producción, 1.9.0)](../../docs/screenshots/app-hero.png)

### Aplicaciones nativas

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC en iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC en iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC en Apple Watch Ultra" width="120" />
</p>

<sub>Capturas de iPhone e iPad realizadas en la versión 1.9.0 (53) ejecutando la aplicación web de producción, 08/09/2026. Captura del reloj correspondiente a la versión 1.4.0.</sub>

| Plataforma | Estado | IA en el dispositivo | Notas |
|------------|--------|----------------------|-------|
| **Web** (PWA) | ✅ Producción | Descarga automáticamente el mejor modelo local | Cualquier navegador, instalable; plan Cloud mediante Stripe |
| **iPad Pro 16GB** | ✅ Producción | IA de 4B en el dispositivo (100 % de precisión) | Más rápido, totalmente privado; plan Cloud mediante compra dentro de la app de Apple |
| **iPhone Pro 8GB** | ✅ Producción | 4B Q4_K_M en el dispositivo (100 % de precisión) | Seleccionado automáticamente según la RAM |
| **Todos los iPhone** | ✅ Producción | 2B Q3_K_M en el dispositivo (99,1 % de precisión) | 2,3 GB — se adapta a cualquier iPhone |
| **Apple Watch** | ✅ Producción | Frases sin conexión (1261 × 20 idiomas) | Independiente — pictogramas, TTS, emergencias |
| **Extensión de Chrome** | ✅ Producción | — | Asistente de lectura en cualquier campo de texto |
| **WiFi a Mac** | ✅ Producción | 9B/27B mediante Ollama | Ajustes → IA local → introducir IP de la Mac |

---

## Vídeo de presentación en la App Store

Vídeo de 30 segundos que muestra las principales funciones con narración de Inworld TTS:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Escena | Función | Captura de pantalla |
|---|---|---|
| **Inicio** — tocar frases | Tablero de pictogramas con 22 categorías, botón Hablar | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorías** | Frases rápidas para Ayuda, Comida, Lugares, Sentimientos | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat IA** | Redactar mensajes, practicar conversaciones | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerta de emergencia** | Llamada a cuidador/enfermero con un solo toque | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Horario** | Rutinas diarias visuales — mañana, escuela, almuerzo, hora de dormir | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Juegos** | Explotar burbujas, Caza de colores, Emparejar, Sí/No, Completar | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matemáticas y escuela** | Matemáticas adaptativas con Pista, Comprobar, Resolver + teclado numérico | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Seguimiento cefálico y ocular** | Cursor por fijación basado en cámara, control ocular, calibración | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 idiomas** | Inglés, español, francés, ruso, japonés, coreano, chino, árabe y más | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## De un vistazo

| Módulo | Qué hace | Vista previa |
|---|---|---|
| 📂 **Categorías** | Módulos de imágenes al estilo PECS para personas no lectoras | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Escribir y hablar** | Teclado + predicción de palabras + voz neuronal | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat IA** | Asistente en el dispositivo y en la nube optimizado para usuarios de CAA | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat CAA** | Mensajes entrantes de cuidadores y contactos | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matemáticas y materias** | Lienzo en cuadrícula con tutor adaptado a cada materia | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Horario** | Rutinas visuales de tipo «primero-después» | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Juegos** | 12 juegos terapéuticos de CAA | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Mercado** | Paquetes de voces, de vocabulario y de juegos | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Reproductor de confort** | Reproductor multimedia de cabecera para pacientes hospitalizados | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Modo de cabecera** | Chat IA a pantalla completa para uso en soporte de teléfono o tumbado | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **Contexto visual** | La cámara detecta objetos → sugiere frases relevantes | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **Manos libres** | Reconocimiento de gestos de cabeza y manos | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Ajustes** | 25 idiomas, adaptaciones motoras, selector de voz + caché de voz | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **Voz e IA en la nube** | Plan opcional de 4,99 US$/mes para voces naturales e IA en la nube | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## Accesibilidad

Prism AAC fue sometido a una [auditoría adversaria de accesibilidad de 70 puntos](ACCESSIBILITY.md) en junio de 2026, evaluado en iPhone vertical, iPhone horizontal, iPad vertical e iPad horizontal. Se solucionó cada problema y se verificó con pruebas automatizadas e2e.

### Métodos de entrada — utiliza cualquier parte del cuerpo

| Método | Cómo funciona | Configuración |
|--------|---------------|---------------|
| **Táctil** | Toque estándar + cuadrícula de pictogramas | Funciona de forma predeterminada |
| **Seguimiento cefálico** | La cámara sigue el movimiento de la cabeza → clic por dwell (fijación) | Ajustes → Modos de entrada |
| **Mirada ocular** | Ponderación de la posición ocular en el seguimiento cefálico | Ajustes → Modos de entrada |
| **Escaneo por conmutador** | Escaneo automático/manual mediante conmutador Bluetooth, teclado o mando | Ajustes → Modos de entrada → Escaneo por conmutador |
| **Reconocimiento de gestos** | Parpadeo, asentimiento, sonrisa, boca abierta → acciones asignadas | Ajustes → Modos de entrada → Gestos |
| **Entrada por voz** | Dictado con autocorrección por IA, manos libres, palabra de activación | Botón de micrófono en la barra de herramientas |
| **Teclado simplificado** | Las 15 letras más frecuentes en cuadrícula 3×5 (auto para tamaño 4) | Ajustes → Tamaño de cuadrícula → 4 |

Navegación en el tablero de imágenes: desliza a izquierda o derecha en la cuadrícula de vocabulario o en la franja inferior de categorías para explorar las páginas. En una Mac, utiliza el desplazamiento horizontal del trackpad o haz clic y arrastra; las flechas laterales siguen disponibles. Cambiar de página no selecciona ninguna palabra — toca o haz clic de forma deliberada en una casilla para elegirla. El desplazamiento vertical y el gesto de pinza para zoom no cambian de página. Consulta [navegación por deslizamiento y límites de pruebas](docs/SWIPE_NAVIGATION.md).

### Diseño adaptable — iPhone y iPad, vertical u horizontal

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone vertical" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone horizontal" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad vertical" width="240" />
</p>

### Modos visuales

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="Oscuro + alto contraste en iPhone" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="Oscuro + alto contraste en iPad horizontal" width="340" />
</p>

- Temas **Claro / Oscuro / Alto contraste**
- Consultas de medios del sistema **`prefers-contrast: more`** y **`prefers-reduced-motion`**
- **Gesto de pinza para zoom** habilitado (hasta 5×) — cumple con WCAG 1.4.4
- **16 palabras de emergencia × 8 idiomas** en modo de recuperación tras fallos

Para ver el informe completo de la auditoría con los 70 hallazgos, consulta [ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## Seguridad y Privacidad

PrismAAC es utilizado por niños, adultos no verbales y poblaciones clínicas. La seguridad no es una función; es una restricción que da forma a cada ruta de inferencia.

### Arquitectura de seguridad por capas

| Capa | Qué | Dónde se ejecuta | Latencia |
|------|-----|------------------|----------|
| **L1 — Control de seguridad determinista** | Intercepción médica/de crisis basada en Regex | Cliente + servidor (cada ruta) | 0 ms |
| **L2 — Entrenamiento de seguridad del modelo** | Alineación RLHF de Qwen3.5 | En el dispositivo + nube | Integrada |
| **L3 — Control de confianza** | Rechaza texto corto/corrompido/con texto de la plantilla filtrado | En el dispositivo + servidor | 0 ms |
| **L4 — Verificador de fundamentación** | Verificación NLI: las afirmaciones deben deducirse lógicamente de la evidencia | Servidor (niveles de pago) | ~200 ms |

### Detalles del control de seguridad L1

El control L1 ejecuta verificaciones regex deterministas en **tanto la entrada como la salida** a través de todas las rutas de inferencia — incluyendo la ruta local offline de Ollama que omite el servidor por completo.

**Lo que captura:** expresiones de crisis en primera persona (intención de autolesión), instrucciones peligrosas de dosificación médica.

**Lo que NO captura (por diseño):** términos clínicos genéricos ("dose of risperidone", "milligrams", "suicide prevention training"). Estos aparecen en notas legítimas médicas/de BCBA y bloquearlos perjudicaría a los usuarios clínicos a los que sirve este producto. No se confía en absoluto en la propia alineación del modelo de 2B en el dispositivo para la seguridad (obtiene una puntuación de ~59% en BFCL V4 general). L1 es el mecanismo de seguridad determinista primario.

**Limitaciones conocidas de L1:**
- **Cobertura de idioma desigual.** Las frases de crisis se comparan en inglés y en otros idiomas, y los conjuntos difieren según la ruta. El control del chat de IA web (`services/crisisSafetyFilter.ts`) también compara frases en español, francés, portugués, rumano, ruso, ucraniano, árabe, alemán, japonés, coreano, chino y búlgaro. La verificación offline en el lado del cliente (`checkInputSafetyClient`) también compara en español, francés, portugués, ruso, árabe, alemán y ucraniano. El control de iOS tiene su propia lista integrada (inglés, español, francés, rumano, ruso, árabe y hebreo) y añade palabras clave desde el servidor al iniciarse cuando puede conectarse a él. Los patrones de dosificación médica son solo en inglés en cada ruta del cliente. Un idioma compatible sin patrones en una ruta determinada está protegido únicamente por el propio entrenamiento de seguridad del modelo (L2).
- **Regex es un suelo, no un techo.** El malestar parafraseado ("I don't want to be here anymore") no se compara. L1 captura formulaciones definidas de alta señal; L2 (alineación del modelo) maneja la cola larga.

**Cobertura por ruta:**

| Ruta | L1 Entrada | L1 Salida | Notas |
|------|:----------:|:---------:|-------|
| Ollama local (offline, web) | ✅ en el lado del cliente | ✅ en el lado del cliente | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| iOS en el dispositivo (llama.cpp) | ✅ nativo | ✅ nativo | `SafetyFilter.swift` (`ios-native/PrismAAC/Sources/Safety/`); la verificación de salida intercepta únicamente contenido de jailbreak |
| Portal `/prism-aac/chat` | ✅ | transmisión en tiempo real* | Entrada verificada antes de la llamada al modelo |
| Portal `/prism-aac/infer` | ✅ | ✅ | Módulo de patrones de seguridad compartido |
| Portal `/prism-aac/inference` | ✅ | ✅ | Módulo de patrones de seguridad compartido |

*Las respuestas en la nube transmitidas en tiempo real confían en la seguridad del modelo (L2) para la salida; L1 no puede filtrar por regex un flujo de tokens en vuelo.

### Cómo se ve una intercepción de crisis

Si un usuario escribe angustia a través de la interfaz AAC, L1 responde inmediatamente (antes de que se ejecute cualquier modelo):

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Privacidad

- La IA en el dispositivo procesa las instrucciones localmente — ningún dato sale del dispositivo
- Los servicios del habla en la nube y la IA en la nube (cuando se utilizan) van al portal de Synalux a través de TLS; el texto se procesa en memoria y no se almacena
- Ninguna instrucción de usuario se almacena ni se utiliza para entrenamiento
- No se requiere cuenta; la telemetría anónima de uso/errores (Datadog) nunca contiene texto escrito o hablado
- Consulte [PRIVACY.md](../../PRIVACY.md) para ver la política de privacidad completa

---

## Alternativa gratuita a Read & Write

PrismAAC incluye de forma gratuita todas las funciones de asistencia a la lectura por las que la mayoría de usuarios de CAA compran Read & Write, desde el navegador y sin necesidad de crear una cuenta para el nivel web. Consulta [Escribir y hablar](#%EF%B8%8F-escribir-y-hablar) para la lectura al finalizar la frase y resaltado de palabras, [Lector de PDF](#-lector-de-pdf) y [Lector de capturas de pantalla (OCR)](#-lector-de-capturas-de-pantalla-ocr) para documentos, y la [Extensión de Chrome](#-extensión-de-chrome--mismas-funciones-de-asistencia-a-la-lectura-en-cualquier-campo-de-texto) para cobertura en otras aplicaciones como Gmail, Google Docs, Word Online o cualquier otra plataforma.

## Comparativa de PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Cámara → sugerencia de frases** (detecta objetos, sugiere palabras) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **IA en el dispositivo** (enrutamiento 99–100 %, compatible con HIPAA) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **Clasificación de frases por usuario** (se adapta a cada niño) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Las correcciones del cuidador **se convierten en datos de entrenamiento** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Tutor de IA** (matemáticas + otras 10 materias) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Lienzo de matemáticas en cuadrícula** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Historial con adaptación regional** (+280 regiones) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Manos libres** cabeza + mano + gestos + escaneo conmutador | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **Chat IA manos libres** (bucle de voz + palabra de activación + cabecera) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Juegos de CAA** terapéuticos (12 integrados) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **Código abierto** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Nivel gratuito** (acceso para seguridad vital) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Mercado** de paquetes de voces | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **Multilingüe** (25 idiomas) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Notas del cuidador** (hogar / escuela / clínica) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| Modo independiente en **Apple Watch** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Asistente de lectura mediante **extensión de Chrome** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = compatibilidad total &nbsp;&nbsp; 🟡 = parcial &nbsp;&nbsp; 🔴 = no disponible

> La comparativa refleja la información de producto disponible públicamente a fecha de 05/2026. PrismAAC se encuentra en desarrollo activo; los competidores pueden añadir funciones con el tiempo. Las contribuciones son bienvenidas para mantener esta lista actualizada — consulta `CONTRIBUTING.md`.
>
> Grid 3 y Tobii Dynavox ofrecen integraciones avanzadas de hardware para control ocular y escaneo con conmutadores no detalladas arriba (dependientes de hardware y configuraciones clínicas especializadas).

---

## iOS y Apple Watch

### iPhone / iPad

Aplicación nativa en Swift que envuelve la interfaz web en WKWebView con una arquitectura de **IA de doble motor en el dispositivo** mediante llama.cpp Metal.

Para garantizar un acceso a la IA instantáneo y sin conexión en todos los dispositivos, la aplicación ejecuta automáticamente dos modelos diferentes de forma simultánea en función de la memoria disponible en el dispositivo:

| Dispositivo | RAM | IA conversacional | Precisión de enrutamiento | Autocompletado |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3,4 GB) | **100 %** | 360M (integrado) |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3,4 GB) | **100 %** | 360M (integrado) |
| Todos los demás iPhone / iPad | < 8 GB | 2B Q3_K_M (2,3 GB) | **99,1 %** | 360M (integrado) |

> Precisión: prueba de referencia BFCL, 115 casos de enrutamiento de herramientas × 3 semillas aleatorias, temperatura=0, junio de 2026.

#### IA en el dispositivo — funciona sin conexión desde el primer inicio

Todos los dispositivos incluyen un modelo de IA integrado en la aplicación. Sin descargas, sin WiFi y sin necesidad de cuenta — abre la aplicación y empieza a comunicarte.

| Dispositivo | Modelo incluido | Tamaño | Qué hace |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2,3 GB | Enrutamiento de herramientas, Manos libres, Modo cabecera, Palabra de activación (99,1 % de precisión) |
| **Apple Watch** | SmolLM2-360M | 207 MB | Expansión de símbolos, frases de emergencia, texto predictivo (100 % de precisión) |

Modelos más grandes (9B, 27B) disponibles en Ajustes → IA local para enrutamiento por WiFi a Mac (100 % de precisión en BFCL).

<details>
<summary><strong>Detalles técnicos</strong></summary>

- **Filtro de seguridad determinista L1:** intercepción médica/de crisis por regex tanto en la entrada (antes de ejecutar ningún modelo) como en la salida (antes de mostrarla al usuario). Los patrones se centran específicamente en la intención de autolesión — los términos clínicos/farmacológicos genéricos («dosis de», «miligramos») NO se interceptan para evitar bloquear el uso clínico legítimo de la CAA.
- **Seguridad de salida en el cliente:** los resultados de Ollama local pasan por `checkOutputSafetyClient` antes de mostrarse — los usuarios sin conexión obtienen la misma protección L1 que los usuarios en la nube.
- **Umbral de confianza:** las respuestas en el dispositivo por debajo de los umbrales de longitud/calidad se rechazan y se derivan a la nube (niveles de pago) o se reducen progresivamente (nivel gratuito).
- La gestión basada en la memoria se reduce de forma progresiva: IA completa → IA en la nube → solo funciones básicas → modo de emergencia
- Recuperación ante falta de memoria (OOM): 4B Q4_K_M → 2B Q3_K_M → 360M
- Ajuste de área segura para Dynamic Island / notch
- Enlace WCSession para alertas de emergencia en Apple Watch
- Tokens de autenticación protegidos con Keychain

</details>

**Ajustes → 🤖 Modelos de IA local** — descarga y gestiona modelos en el dispositivo:
- Detecta automáticamente Ollama en `localhost:11434`
- WiFi a Mac: iPad/iPhone → Ollama en Mac (9B/27B con 100 % de precisión BFCL)
- Descarga por modelo con barra de progreso en tiempo real
- Modelos: `:2b` (2,3 GB) · `:4b` (3,4 GB) · `:9b` (5,8 GB) · `:27b` (16,8 GB)


### Apple Watch (independiente)

Funciona sin iPhone — de forma independiente con un diccionario de frases sin conexión.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traducción sin conexión:** 1261 frases × 20 idiomas incluidos (JSON de 411 KB) — búsqueda instantánea, 100 % precisa, sin red
- Cuadrícula de pictogramas de 2 columnas con imágenes de ARASAAC
- Chat IA con dictado + entrada por teclado (nube con conexión, diccionario de frases sin conexión)
- Sistema de emergencia: cuenta atrás → WCSession → respaldo celular → TTS
- Traducción con salida por voz TTS (diccionario sin conexión primero, respaldo en la nube)
- Bandeja de entrada: recibe y responde mensajes de los cuidadores
- Anclaje de certificados (SPKI SHA-256) en el envío de emergencias
- Saneamiento NFKC + inyección de 23 tokens en todas las rutas de IA

---

## 📊 Panel de información para el cuidador (v1.8)

La aplicación recopila datos de comportamiento internamente — precisión de predicción, tendencias motoras, fiabilidad de voz, estabilidad del seguimiento de cabeza, patrones de comunicación, correcciones del cuidador. Anteriormente, **nada de esto llegaba a los cuidadores**. La única interfaz para el cuidador era un bloc de notas de texto.

Ahora hay una **pestaña de Información** en el Panel del Cuidador con 7 módulos de supervisión en tiempo real, cada uno respaldado por un recolector de métricas en segundo plano que se ejecuta cada 5 minutos sin afectar a la ruta de predicción.

### Qué ven los cuidadores

| Módulo | Qué información aporta | Valor clínico |
|---|---|---|
| **Efectividad de predicción** | «72 % de aciertos ↑ vs 24h previas» | El conjunto de vocabulario funciona — o no |
| **Adopción de vocabulario** | «45 activas · 12 nuevas · 8 sin uso» | Qué frases se han adoptado y cuáles deben retirarse |
| **Temas de comunicación** | «Principal: escuela (35 %), comida (22 %)» | Los cambios en los temas pueden señalar regresión o un cambio de entorno |
| **Tendencia motora** | «Fijación 850ms ↓ (mejorando)» | Mejor control motor → menor tiempo de fijación; empeoramiento → derivar a Terapia Ocupacional |
| **Fiabilidad del seguimiento** | «2 desviaciones · 98 % de actividad» | Desviaciones frecuentes → revisar postura, fatiga o calibración |
| **Fiabilidad de voz** | «97 % de éxito · 1 alternativa» | ¿Falla Azure TTS? ¿Clave API caducada? ¿Problema de conexión? |
| **Carga de correcciones** | «47 correcciones totales» | Una tasa de corrección en aumento = el modelo necesita reentrenamiento para este niño |

### Diseño del panel

| Panel del Cuidador | | ✕ |
|:---|:---|---:|

| + Nota | Registro | **Información** |
|:---:|:---:|:---:|

> **Efectividad de predicción**
> `72 % aciertos` &nbsp;&nbsp; ↑ vs 24h
> ![sparkline](https://img.shields.io/badge/tendencia-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **Adopción de vocabulario**
> `45 activas` · `12 nuevas` · `8 sin uso`
> `████████████████░░░░░░` adoptadas 69 % / probadas 18 % / sin uso 13 %

> **Temas de comunicación**
> `escuela` 35 % · `comida` 22 % · `juego` 18 %
> ![sparkline](https://img.shields.io/badge/escuela-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/comida-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/juego-18%25-2196F3?style=flat-square)

> **Tendencia motora**
> `Fijación 850ms` &nbsp;&nbsp; ↓ mejorando
> ![sparkline](https://img.shields.io/badge/tendencia-1200____1100____950_____850ms-FF9800?style=flat-square)

> **Fiabilidad del seguimiento**
> `2 desviaciones hoy` · `98 % de actividad`
> ![sparkline](https://img.shields.io/badge/actividad-98%25-4CAF50?style=flat-square)

> **Fiabilidad de voz**
> `97 % de éxito` · `1 alternativa`
> `██████████████████████████████░` Azure 94 % / Web Speech 3 % / error 3 %

> **Carga de correcciones**
> `47 correcciones totales` &nbsp;&nbsp; +3 esta semana
> ![sparkline](https://img.shields.io/badge/tendencia-38_____41_____44_____47-795548?style=flat-square)

<sub>286 puntos de datos · últimos 7 días · actualización cada 5 min</sub>

### Arquitectura

```
Toque en PredictionBar --> recordPredictionHit() (importación dinámica, ~0,01 ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (temporizador 5 min)  |
        |                                            |
        |  subscribeTtsHealth() ------> ttsAccum     |
        |  subscribeTrackingEvents() -> trackAccum   |
        |  getAdaptiveSignals() ------> motor/temas  |
        |  corpusHealth() ------------> correcciones |
        |  phraseUsageStore ----------> vocabulario  |
        |                                            |
        |  flushBucket() -> metricsStore.buckets     |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  metricsStore (zustand + localStorage)     |
        |  rotación 7 días - bloques 5 min - 400 KB  |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (carga diferida)     |
        |  7 módulos InsightCard + SVG Sparkline     |
        |  Se renderiza solo al tocar la pestaña     |
        +--------------------------------------------+
```

### Garantías de rendimiento

| Aspecto | Garantía |
|---|---|
| **Ruta de pulsaciones** | 0 ms añadidos — aciertos/fallos usan importaciones dinámicas e incrementos de contadores |
| **Memoria** | ~400 KB en localStorage + ~50 KB en RAM durante 7 días |
| **Paquete de código** | ~2 KB JS (sin bibliotecas de gráficos externas — gráficos SVG puros) |
| **Sin conexión** | 100 % en localStorage — sin llamadas a la red |
| **iPad** | Tarjetas con desplazamiento vertical, gráficos de 120×32px |
| **Privacidad** | Sin datos de salud (PHI) — solo recuentos operativos, protegidos por el PIN del cuidador |

### Ejemplo: lectura del módulo de efectividad de predicción

```
Efectividad de predicción
78 % de aciertos               ↑ vs 24h previas
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **78 % de aciertos**: el 78 % de las veces, el niño tocó una palabra de la barra de predicción en lugar de escribirla manualmente. Esto indica que el vocabulario está bien adaptado a sus patrones de comunicación.
- **↑ vs 24h previas**: la tasa de aciertos mejoró respecto a ayer — el motor adaptativo está aprendiendo.
- **Gráfico de tendencia**: muestra la evolución del porcentaje de aciertos en las últimas 24 horas. Las bajadas pueden coincidir con la introducción de nuevos temas o cambios de entorno.

Si la tasa de aciertos cae por debajo del 40 %, es probable que haya que actualizar el vocabulario — el niño está intentando comunicarse sobre temas que el motor de predicción no cubre.

### Ejemplo: lectura del módulo de tendencia motora

```
Tendencia motora
Fijación 1200ms                ↑ empeorando
╭──╮
│  ╰──╮╭──╮╭─
```

- **Fijación 1200ms**: el niño necesita mantener la mirada o el cursor durante 1,2 segundos para activar una selección. Rango habitual: 800–2000 ms.
- **↑ empeorando**: el tiempo de fijación está aumentando (el niño necesita más tiempo). Esto puede indicar fatiga, un cambio en la medicación o una alteración motora progresiva.
- **Acción a tomar**: si la tendencia se mantiene durante 3 días o más, se recomienda derivar el caso a Terapia Ocupacional. La aplicación adapta el tiempo de fijación automáticamente, pero es aconsejable que un profesional evalúe la causa subyacente.

---

## Módulos

### 📂 Categorías

En el modo Imagen, el Tamaño de cuadrícula determina el número de casillas por página de vocabulario (4 es 2 × 2; 6 es 3 × 2). Desliza hacia la izquierda o hacia la derecha por el tablero para explorar, o utiliza las flechas situadas junto al título de la categoría. Navegar no añade ninguna palabra ni la pronuncia; toca una casilla para seleccionarla. La posición de la página se indica a los lectores de pantalla sin mostrar un contador de páginas visible en el pie de página.

Casillas de imágenes estilo PECS. Toca una categoría, toca una casilla, escucha la palabra y observa cómo se añade a la barra de mensajes. Funciona para personas no lectoras, en etapa de prelectura o en desarrollo de la comunicación. Las colecciones de casillas y su orden se personalizan con el tiempo mediante activación por difusión: las casillas que el niño usa con más frecuencia suben de posición; las que no se utilizan durante meses se desvanecen.

**Disposición envolvente** — las categorías aparecen en una columna desplazable a la izquierda junto al teclado, lo que permite al usuario interactuar con las casillas de imágenes Y escribir simultáneamente sin cambiar de modo. La barra de predicción permanece visible y ambas entradas están siempre accesibles.

![Categorías en modo envolvente — tarjetas de categorías desplazables a la izquierda, teclado completo a la derecha](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- 22 categorías predeterminadas: personas, comida, sentimientos, cuerpo, ropa, animales, lugares, etc.
- El cuidador puede añadir / eliminar / reordenar casillas para cada niño
- Cada casilla incluye una clave `textKey` para i18n — cambiar el idioma de la aplicación actualiza el texto de todas las casillas con un solo toque
- Los pictogramas proceden de ARASAAC y de una selección optimizada; la clonación de voz permite adaptar la voz de la casilla a la de los hermanos o padres del niño (nivel de pago)
- Aprendizaje de n-gramas por usuario: si un niño toca «Yo quiero comer» tres veces, «comer» aparecerá con mayor prioridad tras «quiero» en la siguiente sesión
- Memoria holográfica HRR: predicciones contextuales sin búsqueda en ~0,2 ms mediante Rust WASM — +27 % de precisión Top-1 en frases básicas de CAA

**Ruta de renderizado:** `components/CategoryPanel.tsx` → `useCategoryStore` → casillas tomadas de `constants/phrases.ts` (sistema) + personalizaciones de Supabase por usuario (de pago). Los toques en las casillas invocan `messageStore.appendText(phrase)` y se envían mediante `aacSpeak()` a TTS.
</details>

---

### ⌨️ Escribir y hablar
Teclado en pantalla con **predicción de palabras**, **autocompletado por IA** y un botón **Hablar** con un solo toque que lee la barra de mensajes en voz alta con una voz neuronal natural. La escritura entrena al motor de predicción: las palabras que el niño escribe con más frecuencia aparecen antes en la siguiente sesión.

![Teclado de Prism AAC con la palabra «hola» escrita, casillas de predicción y botón Hablar](../../docs/screenshots/keyboard-typing.png)

**Funciones de asistencia a la lectura (equivalencia con Read & Write)** — diseñadas para usuarios con necesidades de lectura, memoria o cognitivas:

- **Lectura por palabra** — cada palabra se pronuncia mediante TTS en el momento en que se toca la barra espaciadora, permitiendo escuchar lo escrito sin esperar a completar la frase.
- **Lectura de frase completa al usar `.?!`** — al finalizar una frase con punto, signo de interrogación o exclamación, se lee la frase completa para facilitar el seguimiento del texto escrito (una limitación común de los lectores de pantalla tradicionales para usuarios con discapacidad cognitiva). Se activa en Ajustes → `speakOnSentenceEnd` (activado por defecto).
- **Resaltado palabra por palabra durante la lectura** — cada palabra leída se ilumina con un fondo amarillo a medida que el TTS la pronuncia. Permite un seguimiento visual cómodo a los usuarios con dificultades de lectura, sincronizando el resaltado con el audio sin requerir hardware adicional.

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- 5 casillas de predicción sobre el teclado QWERTY, actualizadas con cada pulsación
- Autocompletado con IA («hola c» → «hola cómo», «quiero i» → «quiero ir») mediante Synalux `text/correct` (Gemini 2.5 Flash-Lite, promedio de ~752 ms, 4,3 veces más económico que 2.5 Flash)
- Aislamiento entre idiomas: los n-gramas de un idioma no se filtran en la barra de otro aunque ambos estén cargados (comparación de frecuencias entre corpus)
- El botón «Hablar» lee con adaptación automática de entonación (declarativa / interrogativa / exclamativa inferida por la puntuación)
- Cadena de síntesis de voz: caché de voz persistente (reproduce sin realizar una nueva petición) → voz en la nube a través del portal (Inworld TTS-2; Azure Neural para idiomas no disponibles en Inworld; Gemini TTS como último recurso en la nube) → Web Speech del sistema operativo (sin conexión) → WASM espeak-ng (último recurso local). Consulta [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) y [`docs/SPEECH_CACHE.md`](docs/SPEECH_CACHE.md)
- El resaltado de palabras se calcula por estimación de duración (~60 ms/carácter a velocidad=0,5, escalable con el control de velocidad) — funciona en todos los niveles de TTS sin cambios en el servidor; la sincronización precisa mediante `wordBoundary` de Azure se integrará como función Pro.
- Corpus de n-gramas en SQLite de 1,5 MB por idioma; unigramas + bigramas + trigramas; carga diferida al cambiar de idioma
- **Memoria contextual HRR** — recuperación holográfica sin búsqueda (Rust WASM de 229 KB) que aprende de cada frase pronunciada. Codifica bigramas y trigramas en un vector holográfico; realiza búsquedas en ~0,2 ms en cada pulsación. Capa aditiva: prioriza las 2 primeras casillas de predicción con coincidencias contextuales sin eliminar las predicciones del corpus general.

**Evaluación de predicción HRR** (54 pruebas unitarias + conjunto de precisión de 10 escenarios):

| Escenario | Base Top-1 | HRR+ Top-1 | Incremento | Base MRR | HRR+ MRR | Incremento MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Frases base de CAA (1x) | 36,7 % | 46,7 % | **+27,3 %** | 0,634 | 0,672 | +6,0 % |
| Frases base de CAA (5x al día) | 36,7 % | 46,7 % | **+27,3 %** | 0,634 | 0,672 | +6,0 % |
| Vocabulario personal | 70,4 % | 81,5 % | **+15,8 %** | 0,809 | 0,883 | +9,2 % |
| Mixto (todas las frases) | 47,2 % | 56,9 % | **+20,6 %** | 0,669 | 0,707 | +5,7 % |
| Retención entre sesiones | 80,0 % | 80,0 % | +0,0 % | 0,900 | 0,900 | +0,0 % |
| Prefijos ambiguos | 66,7 % | 66,7 % | +0,0 % | 0,738 | 0,738 | +0,0 % |

Top-1 = la palabra correcta aparece en la casilla #1. Top-5 = la palabra correcta aparece en cualquier casilla. MRR = Rango Recíproco Medio (un valor más alto indica que la palabra correcta aparece antes). HRR no reduce la precisión Top-5 en ningún escenario — cero regresiones. Las mayores mejoras se obtienen en vocabulario personal (+9,2 % MRR) y frases base de CAA (+27,3 % Top-1).

**Ruta de renderizado:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recencia × frecuencia × impulso de n-gramas) + capa opcional de IA `services/textCorrectService.ts` + consulta de bigramas/trigramas HRR `services/hrrContext.ts`. Resaltado: `services/aacSpeak.ts` emite eventos `tts-highlight-start` en el bus `ttsHighlightBus`; `components/MessageBar.tsx` se suscribe y pasa `activeWordIndex` a `ColoredText`.
</details>

---

### ✨ Chat IA
Asistente en el dispositivo y en la nube adaptado a la forma de comunicarse del usuario de CAA. Respuestas en tiempo real con opción de insertar cualquier línea en la barra de mensajes para preservar la autoría del usuario. El nivel gratuito utiliza Gemini 2.5 Flash; los niveles de pago derivan las consultas a Claude Sonnet 4 mediante la infraestructura prism-coder.

**Modo IA despejado** — la barra de predicción de palabras se oculta automáticamente cuando el Chat IA está abierto (las predicciones no son necesarias al redactar una pregunta), manteniendo la atención en la respuesta de la IA y el botón de envío.

**Chat IA manos libres** — activa el botón 🔁 en la cabecera del chat para entrar en un bucle de voz continuo: el micrófono se abre automáticamente tras cada respuesta de la IA, permitiendo mantener una conversación fluida sin tocar la pantalla. Una barra de estado bajo la cabecera confirma que el modo está activo.

**Modo de traducción** — cuando el idioma de la aplicación y el de salida son diferentes (por ejemplo, entrada en portugués y salida en español), cada intercambio con la IA se redirige automáticamente mediante la ruta de traducción con emisión en tiempo real, manteniendo la misma velocidad que en modo monolingüe.

![Panel de Chat IA — barra de predicción oculta en modo IA, teclado completo accesible debajo](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Panel integrado situado sobre el teclado — sin ventanas emergentes que oculten la barra de mensajes
- Entrada por voz mediante Web Speech API; el botón del micrófono muestra la transcripción en tiempo real
- Toca cualquier línea generada por la IA para copiarla a la barra de mensajes (preserva la autoría del usuario — Valencia et al., CHI 2023)
- **Bucle manos libres** — botón 🔁 en la cabecera; reactiva el micrófono 1 s después de que la IA termine de responder; `aria-pressed` + fondo verde confirman el estado; barra de estado visible bajo la cabecera mientras está activo
- **Palabra de activación «Oye Prism»** — disponible dentro del Modo de cabecera; una sesión continua de `SpeechRecognition` detecta la frase y activa el micrófono; no disponible cuando el puente nativo de iOS controla la sesión de audio
- Tiempo límite de 15s en el cliente + botón Reintentar (evita que el panel se quede bloqueado en «Pensando...» si se pierde la conexión)
- Gestión de errores clara para fallos de red, autenticación o tiempo de espera
- Respaldo en Ollama local (`prism-coder:2b`) en modo sin conexión

**Ruta de renderizado:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (o `translateAI()` en modo traducción) → transmisión SSE desde Synalux `/api/v1/chat` con `credentials: 'include'`. Las reglas CORS permiten el origen `synalux.ai` y desarrollos en localhost.
</details>

---

### 🛏 Modo de cabecera

> **Función esencial de accesibilidad.** El Modo de cabecera se ha diseñado para usuarios que no disponen de una forma habitual de hablar, escribir o tocar una pantalla. Su diseño contempla desde el inicio los casos de mayor necesidad: un paciente en una unidad de cuidados intensivos, en cama, con ventilación asistida y sin emisión de voz, que se comunica exclusivamente mediante la mirada o un conmutador accionado con los dedos.

Pantalla completa de comunicación con IA optimizada para usuarios con acceso táctil o vocal limitado. Todos los botones presentan dimensiones amplias. La voz es una opción de entrada más, no la única. Toda la interfaz es compatible con tecnologías de apoyo: escaneo por conmutador, control ocular, Control por voz de iOS, seguimiento cefálico o teclado en pantalla accionado mediante un único conmutador.

Desarrollado a partir de aportaciones de la comunidad de CAA (r/AssistiveTechnology, mayo de 2025) por usuarios en entornos de hospitalización, recuperación quirúrgica y cuidados paliativos.

**¿Funciona en Mac / Windows?** Sí. El Modo de cabecera es una función de la aplicación web progresiva (PWA) — se ejecuta en cualquier navegador y dispositivo. No es exclusivo de iOS.

---

#### ¿A quién va dirigido?

El Modo de cabecera está diseñado para adaptarse a diversos niveles de movilidad y habla. Las Tarjetas de Frases Rápidas (detalladas a continuación) están orientadas a situaciones de alta necesidad — personas sin habla y con movilidad de manos reducida o nula.

| Perfil de usuario | Método de entrada recomendado |
|---|---|
| Capacidad de habla, movilidad de brazos reducida | Voz (botón 🎙 micrófono) + Bucle manos libres |
| Vocalización parcial, habla poco precisa | Palabra de activación «Oye Prism» + Bucle manos libres |
| Sin habla, con acceso táctil | Tarjetas de Frases Rápidas (un solo toque) |
| Sin habla, movilidad reducida — un conmutador | Escaneo por conmutador (iOS Switch Control o Android Switch Access) sobre las tarjetas |
| Sin habla, sin movilidad manual — dispositivo de mirada | El hardware de seguimiento ocular (Tobii, EyeGaze Edge, etc.) actúa como puntero de ratón — todas las tarjetas son navegables |
| Sin habla, con movilidad cefálica | Seguimiento cefálico (ej. Puntero cefálico de iOS, Control de cámara en iPhone 16) — las tarjetas ofrecen superficies de selección amplias |
| Traqueostomía / ventilación asistida, sin vocalización | Tarjetas de Frases Rápidas mediante mirada ocular o conmutador + modo asistido por cuidador |

---

#### Compatibilidad por plataforma

| Plataforma | Modo cabecera | Tarjetas rápidas | Bucle manos libres 🔁 | Palabra de activación 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (cualquier navegador) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Solo Safari |
| Aplicación nativa iOS (App Store) | ✅ | ✅ | ✅ | ❌ usar Manos libres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispositivo de seguimiento ocular (actúa como ratón) | ✅ | ✅ | ✅ | ✅ |
| Escaneo por conmutador (iOS Switch Control) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **¿Por qué no hay palabra de activación en la app nativa de iOS?** El puente nativo gestiona la sesión de audio (`prismNativeBridge.startVoice`), lo que entra en conflicto con la API `SpeechRecognition` del navegador que utiliza la palabra de activación. Se recomienda utilizar el **Bucle manos libres** (🔁) en su lugar — reactiva el micrófono automáticamente 1 segundo después de cada respuesta de la IA sin requerir interacción continua.

---

#### Cómo iniciar

1. Abre el panel de **Chat IA** — toca el icono 🤖 en la barra de herramientas.
2. Toca **🛏** en la cabecera del panel — la pantalla completa se abrirá inmediatamente.
3. Selecciona tu método de entrada (consulta las secciones siguientes).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Modo de cabecera abierto — interfaz de pantalla completa sobre fondo oscuro. La franja superior muestra las Tarjetas de Frases Rápidas. El área central muestra las respuestas de la IA. La parte inferior incluye un botón de micrófono amplio y los controles." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Modo de cabecera con Manos libres activo — botón 🔁 destacado en verde, texto de estado 'Manos libres ACTIVADO' visible" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Botón de activación del modo Manos libres en estado activo — fondo verde, aria-pressed=true" width="260">
</p>

#### Cómo salir / cerrar

- **Táctil:** toca **✕** en la esquina superior derecha (área de toque de 48 × 48 px).
- **Teclado / conmutador:** pulsa **Escape**.
- **Voz:** indica cualquier comando mediante el Control por voz de iOS con la interfaz abierta.

El historial de conversación y el estado de la IA se mantienen al salir. La pantalla de cabecera se superpone al panel principal como una capa independiente sin alterar la sesión en curso.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Tras cerrar el Modo de cabecera — retorno al panel principal de chat IA conservando el historial de conversación" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barra de estado del panel principal mostrando 'Oye Prism activo' con indicador azul tras salir del Modo de cabecera" width="260">
</p>

---

### 🃏 Tarjetas de Frases Rápidas — para usuarios no verbales y con movilidad reducida

> **Ruta principal de interacción para usuarios que no pueden hablar ni tocar la pantalla con facilidad.** Las Tarjetas de Frases Rápidas son botones de comunicación preconfigurados que se activan mediante un único toque, fijación de la mirada o escaneo por conmutador. Sin necesidad de escritura, voz ni conexión a internet para su uso.

Cada tarjeta muestra un icono emoji de gran tamaño y una frase breve. Al seleccionar una tarjeta, su texto se añade inmediatamente a la barra de mensajes. Con el **Modo manos libres** activo, la frase se envía automáticamente a la IA.

#### Tarjetas integradas

Se incluyen quince tarjetas predeterminadas clasificadas por nivel de necesidad. No se pueden eliminar y funcionan sin conexión.

**Prioridad alta (atención inmediata en situaciones médicas):**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| 🆘 | AYUDA — EMERGENCIA | Peligro inminente, llamada de aviso, necesidad de atención inmediata |
| 😢 | Tengo dolor | Expresión de dolor — se pueden añadir detalles de ubicación/intensidad |
| 🫁 | No puedo respirar | Dificultad respiratoria, molestia en la vía aérea, malestar intenso |
| 🔔 | Llamar a enfermería | Solicitud de asistencia habitual |

**Necesidades físicas:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| 💧 | Agua por favor | Sed, boca seca, ayuda para tomar medicación |
| 🔥 | Tengo mucho calor | Fiebre, ajuste de ropa de cama, temperatura |
| 🥶 | Tengo mucho frío | Escalofríos, manta, temperatura ambiente |
| ↔️ | Por favor cámbiame de postura | Alivio de presión, comodidad, cambios posturales |
| 💊 | Necesito mi medicina | Toma de medicación programada o pautada |

**Comunicación:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| ✅ | Sí | Confirmación — respuesta a preguntas del cuidador |
| ❌ | No | Rechazo — respuesta a preguntas del cuidador |
| ⏳ | Por favor espera | Petición de tiempo antes de continuar |

**Expresión emocional:**

| Icono | Frase | Cuándo usar |
|:---:|---|---|
| ❤️ | Te quiero | Afecto, apoyo familiar |
| 🙏 | Gracias | Agradecimiento |
| 😨 | Tengo miedo | Ansiedad, temor o malestar — genera una respuesta de apoyo por la IA |

#### Uso de las Tarjetas de Frases Rápidas

**Toque único / mirada ocular / conmutador:**
Al activar una tarjeta, su texto se transfiere a la barra de mensajes. A continuación, la frase permite:
- Enviarse a la IA para obtener una respuesta adaptada al contexto (ej. tocar «Tengo miedo» → la IA ofrece palabras de tranquilidad y preguntas de seguimiento)
- Leerse directamente — los cuidadores presentes pueden ver la tarjeta seleccionada en la pantalla

**Con el Modo manos libres activo:**
La frase se envía a la IA en cuanto se selecciona la tarjeta. El micrófono se reactiva 1 segundo después de la respuesta de la IA, manteniendo la conversación sin requerir más acciones.

**Con la palabra de activación «Oye Prism» activa (web / escritorio):**
Permite combinar la palabra de activación y las tarjetas: el usuario dice «Oye Prism» para abrir el micrófono, recibe la respuesta de la IA y puede seleccionar una tarjeta para continuar la interacción sin necesidad de hablar de nuevo.

#### Cómo añadir tarjetas personalizadas

Cuidadores, terapeutas y familiares pueden incluir tarjetas personalizadas según las necesidades del usuario — nombres de médicos, expresiones habituales, descripciones de dolor específicas u otras indicaciones.

**Pasos:**

1. En el Modo de cabecera, toca **＋ Añadir** al final de la barra de Frases Rápidas.
2. Escribe la frase deseada para la tarjeta (hasta 80 caracteres).
3. Toca **Añadir tarjeta** — la IA asignará automáticamente un icono emoji acorde al significado del texto (ej. «Quiero más mantas» → 🛏, «Quiero rezar» → 🤲).
4. El icono se muestra tras una breve animación «✨ Generando...» y la tarjeta queda guardada.

Las tarjetas personalizadas se conservan localmente en el dispositivo (localStorage). Se mantienen entre sesiones y tras reiniciar la aplicación. No requieren cuenta ni conexión a internet para su uso — solo la asignación inicial del icono realiza una consulta a la red.

**Ejemplos de tarjetas personalizadas recomendadas:**

| Frase sugerida | Motivo |
|---|---|
| `Por favor que venga [Nombre del médico]` | Permite avisar a un profesional concreto de forma directa |
| `Necesito hablar con mi familia` | Comunicación con familiares o allegados |
| `Por favor apaga la luz` | Sensibilidad a la luz, descanso o malestar |
| `Quiero rezar` | Apoyo espiritual y acompañamiento |
| `Siento algo raro` | Indicación de malestar general — permite a la IA hacer preguntas de aclaración |
| `Necesito la aspiración` | Pacientes con traqueostomía o ventilación |
| `Me duele la vía` | Avisos relacionados con la canalización o suero |
| `Quiero irme a casa` | Conversaciones sobre alta o preferencias de estancia |

#### Cómo eliminar tarjetas personalizadas

1. Toca **✏️ Editar** en la cabecera de la franja de Frases Rápidas.
2. Aparecerá un distintivo **✕** rojo en las tarjetas personalizadas (las tarjetas integradas del sistema están protegidas y no se pueden eliminar).
3. Toca ✕ en la tarjeta que desees retirar.
4. Toca **Hecho** para salir del modo de edición.

#### Configuración para escaneo por conmutador (iOS)

Para usuarios que utilicen un único conmutador externo (pulsador de soplo/aspiración, conmutador de cabeza, de pie o de almohada):

1. Conecta el conmutador al iPhone/iPad por Bluetooth o mediante el puerto Lightning/USB-C.
2. Ve a **Ajustes → Accesibilidad → Control por botón → Botones** y asigna el dispositivo a «Seleccionar elemento».
3. Ve a **Control por botón → Modo de exploración** y elige «Exploración automática» — el sistema resaltará los elementos de forma secuencial.
4. Abre Prism AAC en Modo de cabecera. El control por botón recorrerá las Tarjetas de Frases Rápidas. Acciona el conmutador cuando se resalte la tarjeta deseada.
5. La frase se enviará directamente — sin requerir acciones adicionales.

> Todas las Tarjetas de Frases Rápidas incluyen el atributo `data-scan-group="quick-cards"` para facilitar que las tecnologías de apoyo escaneen la franja como un grupo completo.

#### Configuración para seguimiento ocular

Los dispositivos de seguimiento ocular (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) funcionan en el sistema operativo como un puntero de ratón estándar con clic por fijación. No requieren ajustes especiales en Prism AAC:

1. Configura el tiempo de fijación en el software de tu dispositivo de mirada (recomendado: 800–1200 ms para primeros usuarios).
2. Abre Prism AAC en Modo de cabecera desde cualquier navegador.
3. Mantén la mirada sobre una Tarjeta de Frase Rápida para activarla.

El tamaño mínimo de las tarjetas (88 × 80 px) cumple con los requisitos de dimensión de objetivo WCAG 2.5.5 AAA (44 × 44 px CSS), superando la recomendación habitual para interacción por mirada ocular (60 × 60 px).

---

<details>
<summary><strong>Todas las funciones + detalles técnicos de implementación</strong></summary>

**Cinco subsistemas integrados en un mismo módulo:**

1. **Tarjetas de Frases Rápidas** — `services/bedsideCards.ts` + interfaz de franja en `components/BedsideOverlay.tsx`.

   - Almacenamiento: `localStorage` con la clave `prism_bedside_cards_v1`. Estructura validada en cada carga — las entradas con errores se omiten de forma transparente.
   - Límite: máximo de 50 tarjetas personalizadas (evita un crecimiento desmedido del almacenamiento).
   - Tarjetas integradas: 15 entradas con `id` con prefijo `builtin-`; el control de la interfaz de eliminación verifica este prefijo antes de mostrar el distintivo ✕, asegurando que las tarjetas por defecto no se borren.
   - Generación de iconos por IA: `services/aiService.ts → inferCardIcon(text)`. Utiliza la misma cadena de enrutamiento de Ollama local → nube Synalux que el resto de la aplicación. Envía la frase como mensaje de usuario con una instrucción de sistema predefinida («Responde únicamente con un emoji...»). Extrae el primer punto de código Unicode de la respuesta. Siempre se resuelve — utiliza 💬 como valor por defecto en caso de error de red o respuesta no válida.
   - Sin conexión: las tarjetas funcionan completamente sin conexión; solo añadir una tarjeta nueva requiere red (para asignar el icono — usa 💬 si no hay conexión).

2. **Bucle de IA manos libres (🔁)** — accesible también desde la cabecera principal de chat IA. Tras cada respuesta de la IA, el micrófono se reactiva automáticamente (retraso de 1 s). Se utiliza una estructura de referencias con `handsFreeRef` / `startListeningRef` para garantizar que la llamada ejecute el estado actualizado sin forzar renderizados innecesarios.

   ![Barra de estado manos libres en el panel principal de chat IA](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Superposición de cabecera** — interfaz oscura a pantalla completa en `components/BedsideOverlay.tsx` (`fixed inset-0 z-50 bg-black`) renderizada como un `<Fragment>` hermano junto al panel principal de IA para conservar el estado de la conversación. Accesibilidad: `role="dialog"`, `aria-modal="true"`, `aria-label="Modo de cabecera"`, captura de foco WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab navega dentro de la superposición, `Escape` cierra). Cobertura de pantalla verificada mediante pruebas E2E (tolerancia ≤ 4 px).

   - **Botón de micrófono amplio** — 112 × 112 px (`w-28 h-28`), rojo y con efecto de pulsación mientras escucha, borde blanco en reposo. Dimensiones verificadas ≥ 96 px mediante `boundingBox()` de Playwright.
   - **Franja de tarjetas rápidas** — fila con desplazamiento horizontal, cada tarjeta de `88 × 80 px`, `data-scan-group="quick-cards"` para agrupación en escaneo por conmutador, semántica de lectores de pantalla mediante `role="list"` / `role="listitem"`.
   - **Fila de controles** — Manos libres (verde cuando está activo), palabra de activación «Oye Prism» (azul cuando está activa, oculta si `!wakeWordSupported`), acceso directo a Control por voz de iOS.
   - **Cerrar** — botón ✕ (`w-12 h-12`) o `Escape` → `onClose()` → `bedsideModeActive = false` en `AIChatPanel` → retorno de foco WCAG 2.4.3 al botón 🛏 que abrió la vista.

   ![Superposición de cabecera — cerrada, retorno al panel principal de IA](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **Palabra de activación «Oye Prism»** — `services/wakeWordService.ts`. Ejecuta una sesión continua de `SpeechRecognition` en segundo plano. Detecta transcripciones que contengan «oye prism», activa el micrófono una vez y se reinicia para el siguiente ciclo. Protección: no se inicia si el puente nativo de iOS controla el micrófono (`prismNativeBridge?.startVoice` presente). El estado de la palabra de activación se muestra en la barra de estado del panel principal al salir de la pantalla de cabecera.

   ![Barra de estado mostrando «Oye Prism» activo](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Guía de Control por voz de iOS** — al tocar 📱 en la fila de controles se intenta la llamada `prismNativeBridge.openSettings('accessibility')` (acceso directo a Accesibilidad en compilaciones nativas compatibles). En web y escritorio muestra una tarjeta informativa con los pasos: `Ajustes → Accesibilidad → Control por voz → Activar`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Tarjeta de instrucciones de Control por voz de iOS — guía paso a paso mostrada dentro de la superposición de cabecera al tocar 📱 en web/escritorio" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Tarjeta de instrucciones de Control por voz tras cerrarla — la superposición vuelve a la vista normal" width="260">
   </p>

**Cobertura de pruebas:**
- `services/bedsideCards.test.ts` — 22 pruebas unitarias: conjunto de tarjetas por defecto, persistencia en localStorage, recuperación ante JSON erróneo, filtrado de tarjetas no válidas, límite de 50 tarjetas, restricciones en `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 pruebas E2E con Playwright: visibilidad de botones, alternancia de `aria-pressed`, clases de estado verde/azul, texto en la barra de estado, atributos de accesibilidad, dimensión del micrófono mediante `boundingBox`, cobertura de pantalla y apertura/cierre de la tarjeta de instrucciones.

**Archivos principales:**
- `components/AIChatPanel.tsx` — estado de cabecera, tarjetas (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, bucle manos libres, ciclo de vida de la palabra de activación, botones de cabecera
- `components/BedsideOverlay.tsx` — interfaz de cabecera, franja de tarjetas rápidas, diálogo para añadir tarjetas, modo de edición, captura de foco, tarjeta de Control por voz
- `services/bedsideCards.ts` — tipo `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — asignación de emojis por IA
- `services/wakeWordService.ts` — detección continua de la frase de activación
</details>

---

### 📨 Enviar un mensaje — selector de proveedor
Cuando un contacto tiene varios proveedores configurados (por ejemplo, correo y SMS), aparece la sección **«Enviar mediante»** sobre el área de redacción. Un toque permite cambiar de proveedor antes de enviar — sin salir del panel.

![Selector de proveedor de contacto — fila 'Enviar mediante' con Correo destacado en verde, SMS disponible](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat CAA
Los mensajes entrantes de proveedores conectados (Telegram, WhatsApp, correo electrónico, Slack, etc.) se reciben en este panel. El indicador de no leídos en la barra de herramientas muestra la cantidad, una alerta y notificación entre pestañas se activa al recibir un nuevo mensaje, y tocar una línea del mensaje la copia a la barra para que el usuario pueda redactar una respuesta con su propia voz.

![Panel de Chat CAA mostrando mensajes entrantes del cuidador con distintivo de no leídos](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Consulta periódica de la bandeja de entrada a través del portal Synalux `/api/v1/prism-aac/inbox/poll` (sin acción si devuelve 404 o el portal no está configurado)
- Notificación entre pestañas mediante `BroadcastChannel` al recibir un nuevo mensaje
- Estructura modular de proveedores: añadir Outlook / Slack / Discord requiere ~30 líneas de código por servicio
- El estado de lectura se sincroniza para que los cuidadores sepan cuándo se ha visto el mensaje
- Nivel gratuito: 1 proveedor conectado; nivel de pago: sin límite
- Lectura individual por mensaje mediante TTS para escuchar el texto en la voz seleccionada

**Ruta de renderizado:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (consulta cada 5s cuando sidePanel === 'aac-chat', cada 60s en caso contrario) → `useScheduleStore.setIncomingMessages()`. Cada mensaje se añade también al canal de «Mensajes de cuidadores» dentro del horario.
</details>

---

### 🧮 Materias escolares
Lienzo en cuadrícula con **19 teclados temáticos** que abarcan el programa de educación secundaria y bachillerato: matemáticas, ciencias, programación, artes y humanidades. Cada pestaña orienta al tutor de IA mediante plantillas de consulta específicas por materia (33 plantillas en total) para evitar razonamientos algebraicos en un cuadro de Punnett o confusiones entre acotaciones musicales y código de programación. **El módulo de Historia cuenta con adaptación regional por país, provincia o comunidad autónoma** — más de 280 regiones en 23 países.

![Lienzo en cuadrícula con la operación 5 + 7 = 12 escrita en las casillas](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Pestañas por materia (19 en total)</strong></summary>

**Matemáticas (9 teclados)** — Principal, Mat. Avanzadas (π √ exponentes + 5 herramientas de edición: división, fracciones, raíz, sumatorio), a–z, Mat. Varias (teoría de conjuntos + lógica), Tiempo y Distancia, Peso, Volumen, Geometría, Moneda.

**Ciencias (4)** — Química (24 elementos + flechas de reacción + cargas + subíndices + estados de agregación), Física (alfabeto griego completo + 16 unidades del SI + ∫/∂/∇/∑/∏ + constantes), Biología (ADN/ARN + genética + 8 rangos taxonómicos + 12 orgánulos), Estadística (μ σ x̄ + 12 operadores + distribuciones).

**Programación (2)** — Python (24 operadores + 26 palabras clave) y Java (24 operadores + 26 palabras clave). El código asigna un carácter por casilla para mantener una distribución clara en la cuadrícula.

**Artes y Humanidades (4)** — Música (3 claves + 6 notas + 5 silencios + 5 alterativas + 8 dinámicas), Ciencias de la Tierra (meteorología + tectónica + 10 cuerpos celestes + UA/al/pc/Ma/Ga), Historia (con adaptación local y regional), Lengua y Literatura (12 categorías gramaticales + 6 tipos de oraciones + puntuación + estilos de cita).

</details>

<details>
<summary><strong>Tutor de IA — 11 materias × 3 modos = 33 plantillas de consulta</strong></summary>

![Superposición del tutor de IA con una pista sobre el lienzo](../../docs/screenshots/math-tutor-hint.png)

Tres modos por materia: 💡 **Pista** (orientación paso a paso, sin dar la solución), ✓ **Comprobar** (valida la respuesta del usuario y confirma los aciertos), 🎓 **Resolver** (explicación detallada en un máximo de 4 pasos). La pestaña activa indica la materia al tutor. Tiempo límite de 15 s + botón Reintentar para mantener la fluidez de uso.
</details>

<details>
<summary><strong>Historia — adaptación por idioma y región</strong></summary>

![Teclado de historia en idioma inglés sin región — niveles universal y nacional](../../docs/screenshots/math-keyboard-history-en.png)
![Teclado de historia con región US-TX — eventos locales de Texas](../../docs/screenshots/math-keyboard-history-us-tx.png)

Estructura en tres niveles:
1. **Universal** — acontecimientos presentes en planes de estudio globales (476, Primera Guerra Mundial 1914, Segunda Guerra Mundial 1939, llegada a la Luna 1969)
2. **Nacional** — eventos seleccionados según el `idioma` (es, en, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 idiomas compatibles
3. **Regional** — acontecimientos específicos definidos por `historyRegion` (ES-CT, ES-AN, MX-DIF, US-TX, CA-QC, ARG, ...) — **más de 280 regiones en 23 países** incluyendo las 17 comunidades autónomas de España, los 50 estados de EE. UU., provincias de Canadá, naciones del Reino Unido, estados de México, Argentina, Colombia, regiones de Italia, Alemania, entre otros.

El tutor adapta las referencias históricas según la región seleccionada: el año 1810 en `MX` prioriza el inicio de la Independencia de México, mientras que en `ARG` se orienta a la Revolución de Mayo; el año 1714 en `ES-CT` hace referencia a los hechos de Barcelona.

</details>

<details>
<summary><strong>Flujos de prueba — 12 materias × ejercicios prácticos × 72 pruebas automatizadas</strong></summary>

Conjuntos de ejercicios ordenados por pasos para cada teclado temático, junto con pruebas ejecutables en Playwright que interactúan con el panel de matemáticas y verifican los caracteres ingresados en la cuadrícula.

- **Nivel 1 — pasos estructurados:** [`tests/workflows/`](tests/workflows/) — 12 documentos de referencia (matemáticas avanzadas, biología, química, ciencias de la tierra, geometría, historia, lengua, matemáticas varias, física, programación Java, programación Python, estadística).
- **Nivel 2 — ejercicios por curso:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 documentos con problemas aplicados por materia + informe de cobertura [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **Nivel 3 — pruebas E2E:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 pruebas automáticas (`npx playwright test --project=desktop e2e/math-workflows`).

Índice completo y guía de desarrollo de pruebas → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Otras funciones de matemáticas (bloqueo de área, ampliación en dos toques, guardado y sincronización)</strong></summary>

- **Herramienta de bloqueo** — permite fijar un área del lienzo al terminar un ejercicio. Las casillas protegidas se muestran con tono atenuado y no admiten cambios.
- **Ampliación en dos toques** — el primer toque resalta la casilla (escala 1,4× y borde verde), el segundo confirma la selección. Desactivación automática tras 2 s. Diseñado para facilitar la precisión táctil.
- **Guardado y sincronización** — almacenamiento local en `localStorage`; opción de sincronización con el portal Synalux mediante el botón `↻ Sincronizar`. Capacidad para 100 documentos / 200 KB; sustitución automática de las entradas más antiguas.
- **Tiempo de fijación** — ajuste de permanencia por casilla (0–1500 ms) con indicador circular de progreso.

![Superposición de documentos guardados mostrando una entrada y el botón Sincronizar](../../docs/screenshots/math-docs-overlay.png)
![Teclado numérico con una tecla resaltada mediante el sistema de dos toques](../../docs/screenshots/math-two-hit-armed.png)
![Herramienta de bloqueo activa pidiendo seleccionar la esquina de un área](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Teclados temáticos — imágenes adicionales</strong></summary>

![Teclado de química con H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Teclado de biología con bases A T G](../../docs/screenshots/math-keyboard-biology.png)
![Teclado de Java con sintaxis `private String`](../../docs/screenshots/math-keyboard-java.png)
![Teclado de música](../../docs/screenshots/math-keyboard-music.png)
![Teclado de estadística](../../docs/screenshots/math-keyboard-statistics.png)
![Teclado de ciencias de la tierra](../../docs/screenshots/math-keyboard-earth-science.png)
![Teclado de lengua y literatura](../../docs/screenshots/math-keyboard-language-arts.png)
![Teclado de historia en variante regional](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Horario
Horario visual «primero-después» para el seguimiento de rutinas y transiciones. Cada paso se compone de una imagen y un texto; al completar una tarea se emite un tono indicador y una marca visual de progreso. La sección de logros (nivel de pago) se activa al finalizar una secuencia de actividades.

![Panel de horario con tablero primero-después y lista de actividades](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Cuadrícula de 24 tareas predeterminadas accesibles con un toque: despertar, lavarse los dientes, desayuno, escuela, merienda, almuerzo, jugar, leer, plástica, paseo, cena, baño, cuento, dormir, medicación, hilo dental, recoger, colada, mascotas, deporte, …
- Reordenación mediante arrastre; edición de texto directamente en la tarjeta; las tareas predeterminadas incluyen `textKey` para actualizar su idioma al cambiar los ajustes
- Control de estados «primero-después»: destello en la tarjeta activa, tono progresivo al finalizar el tiempo, adaptación para movimiento reducido (`prefers-reduced-motion` → indicador estático), compatibilidad con `aria-pressed`
- Mantenimiento de audio: señal de baja frecuencia constante para conservar la activación del AudioContext en Safari iOS, garantizando la reproducción de avisos sonoros tras periodos de inactividad

**Ruta de renderizado:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 actividades predeterminadas + personalizadas) → `services/feedback.ts:playTimerRing()` → AudioContext compartido mediante `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Juegos
12 juegos orientados al aprendizaje de la comunicación mediante CAA, **enfocados en el desarrollo del lenguaje**. Cada juego registra el progreso y la precisión para permitir al sistema recomendar las actividades más convenientes.

![Panel de juegos con 9 tarjetas de acceso](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Los 12 juegos + detalles técnicos</strong></summary>

| Juego | Habilidad principal |
|---|---|
| Explotar burbujas | Causa y efecto, intención comunicativa |
| Caza de colores | Vocabulario comprensivo (nombres de colores) |
| Mi historia | Secuenciación narrativa |
| Emparejar | Identificación de conceptos y categorías |
| Sí / No | Respuesta binaria, aceptación y rechazo |
| Completar | Completar frases (ejercicios cloze) |
| Clasificación | Categorización semántica |
| Expresiones | Reconocimiento de emociones y estados |
| Qué viene después | Razonamiento secuencial |
| Igual / Diferente | Discriminación visual — semejanza y contraste |
| Sonidos | Discriminación auditiva y vocabulario |
| Turnos | Práctica de la alternancia en la comunicación |

- Los 12 juegos están disponibles sin coste; ningún juego requiere una suscripción
- Los datos de cada partida alimentan `services/adaptiveEngine.ts` — longitud de la frase / categoría / franja horaria / resultado → sugiere el siguiente juego más adecuado
- Durante el juego se ajustan temporalmente las categorías del tablero no vinculadas a la actividad para facilitar la concentración

**Ruta de renderizado:** `components/GamesPanel.tsx` → componentes de juego individuales en `components/games/`. Cada juego registra datos a través de `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Mercado
Catálogo de paquetes de voces (voces de Inworld o voces personalizadas de familiares), paquetes de vocabulario (vocabulario de inicio, apoyos visuales) y módulos de juegos adicionales. Las aplicaciones instaladas se integran en la barra de herramientas a través del registro del sistema.

![Panel del mercado con aplicaciones disponibles para instalar](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Las aplicaciones se estructuran como manifiestos JSON (`lib/marketplace/manifests/local.ts`) con un registro de ejecución `lib/marketplace/registry.ts` donde `getHandler(appId)` devuelve el componente del panel
- Clonación de voz (nivel de pago): una grabación de 90 segundos permite generar una voz utilizable en el TTS de la aplicación y en las casillas de categorías
- Las aplicaciones instaladas se añaden como botones en la barra de herramientas a continuación de los módulos principales; el estado se gestiona en `useSettingsStore.installedApps`
- El catálogo muestra todos los elementos disponibles, limitando la instalación según el plan del usuario

**Ruta de renderizado:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` para la gestión de complementos, seguido de la descarga de componentes (archivos de voz, vocabulario JSON) en IndexedDB.
</details>

---

### 📄 Lector de PDF
Abre un PDF, visualiza una tarjeta por página y toca para escuchar el texto leído con la voz configurada. Documentos escolares, lecturas o folletos — permite cargar archivos PDF y escucharlos en lugar de leerlos en pantalla. No requiere lectores externos; el proceso se realiza en el navegador.

![Panel del lector de PDF — estado inicial con la opción "+ Abrir PDF"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Una tarjeta por página con vista previa de las 3 primeras líneas y un botón `▶ Página N` conectado a `aacSpeak()` (mismo tono, voz y resaltado de palabras que en el resto de la aplicación)
- La opción `▶ Leer todo` procesa las páginas en una secuencia continua
- La detección de páginas sin texto editable (PDFs escaneados) sugiere utilizar la herramienta de OCR
- La biblioteca `pdfjs-dist` se carga bajo demanda al abrir la función por primera vez desde CDN, vinculada a la versión del paquete npm
- El acceso directo en la barra de herramientas (📄) se activa desde Ajustes → Barra de herramientas para mantener una interfaz sencilla

**Ruta de renderizado:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → obtención de texto por página `getTextContent`) → `services/aacSpeak.ts`.
</details>

---

### 👁 Lector de capturas de pantalla (OCR)
Sube o toma una fotografía de una ficha, una captura de pantalla o la página de un libro — el texto reconocido se muestra junto a la imagen con las opciones **▶ Hablar** para escucharlo o **↧ Enviar a la barra** para editarlo antes de reproducirlo.

![Panel del lector de OCR — estado inicial con la opción "+ Abrir imagen"](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- Compatibilidad con 20 idiomas mapeando la configuración regional de PrismAAC a códigos de Tesseract (spa / eng / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Los archivos de idioma de Tesseract se guardan en caché tras la primera descarga (~10 MB para español e inglés; mayor tamaño en idiomas CJK) — la primera ejecución muestra el aviso «Procesando imagen... (la primera descarga del modelo puede requerir entre 10 y 30 segundos)»
- Indicador del porcentaje de precisión del reconocimiento para valorar el resultado
- La función de limpieza `disposeOcr()` libera los procesos y la memoria WASM al cerrar el panel
- El acceso directo en la barra de herramientas (👁) se activa desde Ajustes → Barra de herramientas

**Ruta de renderizado:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` o `messageStore.setText`.
</details>

---

### 🎧 Reproductor de confort

Reproductor multimedia de cabecera diseñado para acompañamiento continuo en entornos hospitalarios o de reposo.

<details>
<summary>Detalles de las funciones</summary>

Familiares y allegados pueden grabar mensajes de voz y añadir fotografías o vídeos. La lista se reproduce de forma continua para ofrecer un entorno cercano al usuario.

- **Grabar** mensajes de voz desde la propia aplicación (API MediaRecorder)
- **Añadir** archivos de audio, fotos y vídeos (hasta 100 MB por archivo, 500 MB en total)
- **Reproducción continua** en bucle de todos los elementos contenidos
- Modo a **pantalla completa** para imágenes y vídeo
- **Integración con TTS nativo** — reproducción de frases mediante AVSpeechSynthesizer en dispositivos iOS
- **Sin conexión** — el contenido se almacena localmente en IndexedDB sin requerir red
- **Accesibilidad mediante teclado** — controles etiquetados con atributos ARIA y navegación por teclado
- Módulo revisado según criterios de seguridad (gestión de URLs temporales, límites de almacenamiento, validación de entrada y tipos MIME permitidos)
- El acceso directo en la barra de herramientas (🎧) se activa desde Ajustes → Barra de herramientas

**Límites de almacenamiento:** máximo 50 elementos, 100 MB por archivo, 500 MB en total. Formatos permitidos: audio (webm/mp4/mpeg/ogg/wav), imagen (jpeg/png/gif/webp/heic) y vídeo (mp4/webm/quicktime).

**Ruta de renderizado:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persistencia) → `services/comfortMediaStorage.ts` (almacenamiento en IndexedDB).
</details>

---

### 🧩 Extensión de Chrome — funciones de asistencia a la lectura en cualquier campo de texto
Mientras la aplicación web de PrismAAC gestiona la lectura asistida en su propio entorno, la extensión de Chrome (`chrome-extension/`) lleva **estas mismas funciones a cualquier campo de texto en cualquier sitio web** — Gmail, Google Docs, Word Online, portales educativos o formularios — ofreciendo una alternativa completa para la asistencia a la lectura.

![Asistente de lectura de PrismAAC — lectura en tiempo real con resaltado palabra por palabra en cualquier campo de texto](../../docs/screenshots/extension-marquee.png)

El elemento flotante se sitúa sobre el campo de texto enfocado. Toca **▶ Hablar** para releer, o continúa escribiendo — al finalizar una frase con `.?!` se reproducirá automáticamente mientras cada palabra se ilumina en amarillo al ser pronunciada:

![Barra superpuesta de PrismAAC sobre una zona de escritura, con la palabra "escuela" resaltada en amarillo durante la lectura](../../docs/screenshots/extension-overlay.png)

La función de traducción en tiempo real muestra TANTO la frase original (en texto de menor tamaño e cursiva) COMO la traducción (a tamaño completo, con resaltado de la palabra activa). Compatible con más de 50 idiomas a través del servicio público de Google (sin necesidad de clave API):

![Barra superpuesta traduciendo de inglés a español — frase original "I had a really good day at school today" con la traducción "Hoy he tenido un día muy bueno en la escuela" debajo, destacando la palabra activa](../../docs/screenshots/extension-translate.png)

Página de opciones — los ajustes se sincronizan entre dispositivos en el perfil de Chrome mediante `chrome.storage.sync`. Incluye lista de sitios excluidos, selector de voz, controles de velocidad, tono y volumen, e idioma de destino:

![Página de opciones de la extensión PrismAAC — opciones de lectura, idioma de destino español, selector de voz y controles de síntesis](../../docs/screenshots/extension-options.png)

**Instalación (modo desarrollador):**

```sh
cd chrome-extension
npm install
npm run build
```

Abre `chrome://extensions`, activa el **Modo de desarrollador**, haz clic en **Cargar descomprimida** y selecciona la carpeta `chrome-extension/dist`.

**Funciones:**

- Lectura de frase al usar `.?!`, lectura de palabra al pulsar espacio (opciones configurables)
- **Resaltado palabra por palabra** mediante el evento nativo del navegador `SpeechSynthesisUtterance.boundary` (sincronización directa por palabra)
- **Traducción durante la lectura** — selección de idioma de destino (+50 idiomas mediante el servicio de traducción de Google, sin clave API). Muestra la frase original Y la traducción (con resaltado de la palabra leída); selecciona automáticamente una voz nativa en el idioma de destino
- Interfaz flotante en Shadow-DOM situada sobre el campo enfocado (▶ Hablar, 📌 Fijar, × Cerrar)
- Atajo `Cmd / Ctrl + Shift + S` para leer el texto enfocado; `Esc` para detener
- Lista de exclusión por sitio web para formularios sensibles o de banca
- Sincronización de preferencias en el perfil de Chrome a través de `chrome.storage.sync` — sin necesidad de cuenta en PrismAAC

**Privacidad:** el modo sin traducción funciona completamente sin conexión (Web Speech de forma nativa). El modo de traducción realiza una consulta HTTPS por frase a `translate.googleapis.com` (guardada en caché tras la primera consulta). Código fuente accesible en [`chrome-extension/`](chrome-extension/) — desarrollado en TypeScript con compilación esbuild.

---

### 👋 Gestos manos libres
Entrada por cámara opcional para usuarios que no pueden interactuar mediante toques táctiles. Permite control por posición cefálica con clic por fijación y perfiles de gestos manuales. Proceso 100 % local — la señal de vídeo no sale del dispositivo.

<details>
<summary><strong>Funciones + detalles técnicos</strong></summary>

- **Modo básico**: seguimiento de la orientación de la cabeza (FaceLandmarker, MediaPipe). El usuario orienta la mirada hacia una casilla, mantiene la posición durante `headTrackingDwellMs` (por defecto 1200 ms) → realiza la selección. Un anillo visual muestra el progreso de la fijación.
- **Modo avanzado**: seguimiento de la posición de la mano. Permite definir perfiles de gestos por usuario (mano abierta = enter, puño = borrar, pellizco = espacio, etc.) desde `components/HandCalibration.tsx`.
- Control de desviación: si la cabeza se desplaza más de `headTrackingDriftThresholdPx` durante `headTrackingDriftWindowMs` fotogramas consecutivos, el seguimiento se pausa de forma automática y muestra una indicación de recalibración.
- **Salida mediante tecla Esc** — pulsar la tecla Esc en cualquier teclado desactiva el seguimiento de inmediato y recupera la vista QWERTY habitual sin modificar el texto de la barra de mensajes.
- Gestión única de cámara (`services/cameraStream.ts`) para compartir la captura entre el seguimiento de cabeza y de mano de forma eficiente.
- La calibración del usuario se conserva localmente y el sistema se reanuda automáticamente al volver a la aplicación.

**Documentación de referencia:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (cálculos de calibración, aprendizaje por percentiles, filtro One Euro), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 Contexto visual — sugerencias de frases mediante cámara

Orienta la cámara hacia objetos cotidianos para que la barra de predicción muestre frases relacionadas. Una taza y un tenedor sobre la mesa → «Quiero más», «Agua por favor», «Ya he terminado». Una cama → «Tengo sueño», «Buenas noches». Un libro → «Ayuda por favor», «No lo entiendo». **Una función exclusiva en aplicaciones de CAA.**

| Escena | Objetos detectados | Frases sugeridas |
|---|---|---|
| 🍽️ Comida | taza, tenedor, cuchara, plato, botella | «Quiero más», «Agua por favor», «Ya he terminado», «Qué bueno», «Quema» |
| 😴 Hora de dormir | cama, peluche | «Tengo sueño», «Buenas noches», «Léeme un cuento», «Un abrazo por favor» |
| 📚 Tareas | libro, portátil, teclado | «Ayuda por favor», «No lo entiendo», «Terminado», «Más tiempo» |
| 🎮 Juego | peluche, pelota | «Quiero jugar», «Mi turno», «¡Qué divertido!», «¡Otra vez!» |
| 🛁 Aseo | inodoro, lavabo | «Necesito ir al baño», «Lavar las manos», «Ayúdame» |
| 📺 Televisión | televisión, mando, sofá | «Quiero ver la tele», «Apágalo», «Está muy alto» |

Frases disponibles en más de 12 idiomas (español, inglés, francés, portugués, rumano, ucraniano, ruso, alemán, japonés, coreano, chino, árabe, entre otros). El idioma se adapta automáticamente a la configuración de la aplicación.

![Contexto visual — escena de comida detectada](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>Funcionamiento (detalles técnicos)</strong></summary>

**Arquitectura:** Captura de cámara (`cameraStream.ts`) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4 MB int8, WASM) → Inferencia de escena (reglas deterministas, 11 tipos de escena) → Inserción en barra de predicción (`setAiCompletion` + impulso de n-gramas en `learnWord`).

**Rendimiento:**
- Procesamiento a **2 FPS** (una detección cada 500 ms) — optimizado para objetos estáticos con bajo consumo de batería
- Uso de CPU: **< 6 %** en dispositivos móviles
- Tamaño del modelo: **4 MB** (EfficientDet-Lite0 cuantizado en int8, ejecutado sobre el entorno WASM de MediaPipe)
- Uso de RAM adicional: **~5 MB** (modelo, búferes y vocabulario de frases)
- Control térmico: reduce a 1 FPS y pausa 30 s si se detecta incremento de temperatura

**Privacidad:**
- Proceso 100 % local — los fotogramas de la cámara **nunca salen del dispositivo**
- Los resultados de detección son **temporales** — no se guardan en localStorage ni en servicios en la nube
- La categoría `person` se detecta pero **no se muestra** ni genera sugerencias
- No se muestra vista previa de la cámara durante la detección de objetos

**Seguridad:**
- Función **desactivada por defecto** — el cuidador debe activarla en Ajustes → Modos de entrada → Contexto visual
- Las frases sugeridas **no se leen automáticamente** — requieren selección voluntaria por parte del usuario
- Las frases de emergencia se gestionan en una capa independiente y **nunca son desplazadas** por las sugerencias visuales
- La escena debe permanecer estable durante **3 fotogramas consecutivos** (~1,5 s) para confirmarse — evita cambios bruscos

**Modelo de detección:** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 categorías COCO, alojado en la red CDN junto a los modelos de cara y postura de MediaPipe.

**Inferencia de escena:** Motor de reglas determinista (sin modelos ML adicionales). Asocia combinaciones de objetos con contextos según la hora del día: `taza + tenedor + cuchara` a mediodía = `comida` (confianza 0,90). 11 tipos de escenas configurables.

**Integración en predicción:** Utiliza dos métodos de `predictionStore`:
1. `setAiCompletion(phrase)` — coloca la frase principal en la primera casilla de predicción
2. `learnWord(word, prev)` — prioriza el vocabulario del contexto mediante n-gramas sintéticos

El impulso de contexto se atenúa tras 30 segundos si los objetos salen de la vista. La escritura activa en el teclado suspende temporalmente las sugerencias visuales para dar prioridad a la intención del usuario.

**Archivos principales:**
- `services/objectDetectionService.ts` — captura de cámara, bucle MediaPipe, control térmico
- `services/sceneInference.ts` — motor de reglas, 11 tipos de escena, ponderación horaria
- `services/visionPredictionBridge.ts` — conexión entre detección y barra de predicción
- `constants/visionPhrases.ts` — vocabulario de frases por escena en +12 idiomas
- `constants/objectVocabulary.ts` — etiquetas de objetos COCO → vocabulario localizado
- `store/visionStore.ts` — almacén de estado temporal (Zustand)
- `hooks/useVisionContext.ts` — enlace de React entre detección, predicción y ajustes

**Pruebas:** 62 pruebas unitarias que cubren reglas de escena, vocabulario de objetos, traducciones de frases, ciclo de vida del estado e integración del flujo completo.

**Verificación E2E en Safari:**
```
ESCENA=comida     CONF=0,90 FRASES=Quiero más|Agua por favor|Ya he terminado   BADGE=🍽️
ESCENA=dormir     CONF=0,70 FRASES=Tengo sueño|Buenas noches|Léeme un cuento   BADGE=😴
ESCENA=tareas     CONF=0,80 FRASES=Ayuda por favor|No lo entiendo|Terminado    BADGE=📚
```
</details>

---

### ⚙️ Ajustes
25 idiomas / 28 variantes regionales, tema (claro / oscuro / alto contraste), tamaño de cuadrícula (4 a 20 casillas), opciones de accesibilidad motora (tiempo de permanencia en matemáticas, ampliación en dos toques, tiempo de fijación en seguimiento de cabeza, sensibilidad de gestos, corrección de desviación), selector de voz (gratuito), gestión y uso de la caché de voz, autocorrección por IA, notificaciones, personalización de la barra de herramientas, región para el módulo de historia y gestión de la cuenta Synalux con el plan Cloud.

![Ajustes — selector de idioma y tema](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Ajustes de matemáticas y accesibilidad</strong></summary>

![Ajustes — tiempo de permanencia en matemáticas y ampliación en dos toques](../../docs/screenshots/panel-settings-math.png)

- **Tiempo de permanencia en matemáticas** — control de 0 a 1500 ms; 0 = toque inmediato, 200–1500 ms facilita la selección a usuarios con temblor o movilidad reducida (un indicador verde muestra la progresión del tiempo).
- **Ampliación en dos toques** — el primer toque resalta la tecla (escala 1,4× y borde verde sin seleccionar), el segundo toque la activa. Cancelación automática tras 2 s.
- **Tiempo de fijación en seguimiento cefálico** — entre 200 y 5000 ms.
- **Sensibilidad** — niveles de 1 a 10.
- **Desactivación por desviación** — control mediante umbrales en píxeles y ventanas de tiempo en ms.
- **Ver calibración de mano** — abre el panel de ajuste para perfiles de gestos manuales.

</details>

<details>
<summary><strong>Modos de entrada — voz, gestos, autocorrección por IA</strong></summary>

![Ajustes — panel de modos de entrada](../../docs/screenshots/panel-settings-input-modes.png)

- **Entrada por voz** — Web Speech API con reconocimiento por idioma; disponible en nivel gratuito
- **Autocorrección y autocompletado por IA** — analiza las pausas de escritura a través del servicio en la nube (Gemini 2.5 Flash-Lite). Desactivado por defecto en conexiones de ancho de banda reducido.
- **Notificaciones** — avisos sonoros y entre pestañas para mensajes de Chat CAA.
- **Entrada por cámara** — control principal para seguimiento de cabeza y mano.
- **Selección de seguimiento** — cabeza, mano o detección automática.

</details>

<details>
<summary><strong>Personalización de la barra de herramientas</strong></summary>

La barra de herramientas permite reordenar sus elementos. La versión 0.9.0 incluye una configuración inicial simplificada (micrófono, chat CAA, alertas, categorías, ajustes) para mantener un entorno despejado — todos los demás módulos (matemáticas, chat IA, horario, juegos, mercado, reproductor de confort, notas, historial, sonido) se pueden activar desde Ajustes → Barra de herramientas. Las aplicaciones instaladas desde el Mercado se añaden automáticamente a continuación de los módulos del sistema.

</details>

---

## Pruébalo

| | |
|---|---|
| 🌐 **Aplicación web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — pruébalo en cualquier navegador |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Código fuente** | Este repositorio. Licencia AGPL-3.0 — libre para crear derivados y compartir modificaciones |

---

## Planes

Dos opciones disponibles: **Gratuito** y **Prism AAC Cloud**. Sin periodos de prueba obligatorios, sin necesidad de tarjeta para la versión Gratuita y sin cobros automáticos por exceso de uso.

| | Gratuito | Prism AAC Cloud — 4,99 US$/mes |
|---|---|---|
| Tableros de comunicación, teclado y frases guardadas | ✅ | ✅ |
| Voces del dispositivo disponibles y voz en caché | ✅ | ✅ |
| IA en el dispositivo y comunicación de emergencia | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| Generación de voz natural en la nube | no incluida (disponible en la ruta pública de voz hasta la implantación de límites) | 50.000 caracteres / mes |
| Consultas de IA en la nube (chat, autocorrección, predicción, tutor) | — | 100 / mes |
| Reinicio de límites mensuales | — | Día 1 de cada mes a las 00:00 UTC |

- Adquisición a través de la aplicación iOS (compra dentro de la app mediante Apple StoreKit 2) o desde la web (Stripe); ambas opciones activan la suscripción en la misma cuenta. Cancelar en un canal no elimina el acceso configurado.
- La reproducción de voces guardadas en caché y las voces nativas del dispositivo no consumen el límite mensual. Si se supera el límite, las voces e IA en la nube se pausan hasta el siguiente periodo — las funciones de comunicación principales en el dispositivo continúan operativas en todo momento.
- Ajustes → Cuenta Synalux → **Voz e IA en la nube** muestra el estado del plan, los consumos y las opciones de gestión o renovación.
- Notas de desarrollo: (1) las funciones de impulso en predicción, conectores de chat CAA, gestión de contactos y alertas SMS extendidas se asocian al plan AAC configurado mediante suscripción web (Stripe); (2) la generación de pictogramas por IA y la instalación de complementos del mercado se vinculan al plan general de Synalux. El selector de voz y los 12 juegos están disponibles para todos los usuarios.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="Aplicación iOS: Ajustes → Cuenta Synalux → Voz e IA en la nube — límites, renovación, Suscribirse con Apple · 4,99 $/mes, Restaurar compras de Apple" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="Aplicación web: misma sección con opción Suscribirse · 4,99 US$/mes mediante Stripe" width="260" />
</p>

[Página de precios →](https://synalux.ai/pricing) · [Términos](TERMS.md) · [Privacidad](PRIVACY.md)

---

## Criterios de diseño clínico

- **El acceso a la CAA no se interrumpe bajo ninguna condición.** Garantiza que el usuario disponga siempre de su medio de comunicación.
- **Protección de datos de salud en la nube.** Las notas de los cuidadores se cifran antes de cualquier transmisión.
- **Procesamiento de audio local.** La entrada de voz se transcribe localmente en el navegador mediante la Web Speech API.
- **Desarrollado con asesoramiento en análisis de conducta (BCBA).** El seguimiento del uso verbal se adapta a las directrices de la 5.ª edición de la lista de tareas del BACB.
- **Interfaz adaptada a la diversidad de necesidades.** Sin dinámicas de penalización. La sección de logros se activa de forma opcional.

Más información: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Pruebas automatizadas

**5.139 pruebas automatizadas** verifican las funciones en entorno web, iOS, análisis visual y enrutamiento de IA.

| Ámbito de prueba | Pruebas | Resultado |
|---|---|---|
| Aplicación web completa (componentes, estados, servicios) | 4.971 | ✅ superado |
| Reconocimiento de escena / cámara / objetos | 167 | ✅ superado |
| Seguimiento de manos y precisión de postura corporal | 54 | ✅ superado |
| Enrutamiento de IA local (instancia Ollama activa) | 8 | ✅ superado |
| Pruebas nativas iOS (XCUITest) | 19 | ✅ superado |
| Servidor Prism MCP | 2.679 | ✅ superado |

**Precisión de la IA en el dispositivo** — nivel de acierto al seleccionar acciones de comunicación:

| Dispositivo | Modelo | Tamaño | Precisión | Evaluación |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100 %** (300/300) | Evaluación clínica de CAA (expansión de símbolos, emergencia, predicción) |
| **Todos los iPhone** | Qwen3.5-4B Q3_K_M | 2,3 GB | **99,1 %** (114/115 × 3 ejecuciones) | Enrutamiento de funciones BFCL |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3,4 GB | **100 %** (115/115 × 3 ejecuciones) | Enrutamiento de funciones BFCL |
| **iPad Pro / Mac** | Prism-Coder 9B | 8,4 GB | **100 %** (115/115 × 3 ejecuciones) | Enrutamiento de funciones BFCL |

<details>
<summary><strong>¿Qué representa un «99,1 % de precisión en enrutamiento» en la práctica?</strong></summary>

La IA en el dispositivo determina qué acción ejecutar cuando el usuario activa una función — guardar una nota, recuperar una sesión o consultar el historial. Esto se evalúa mediante 115 escenarios reales ejecutados en 3 secuencias aleatorias. El modelo de 2,3 GB resuelve correctamente 114 de 115 casos en cada iteración. La única variación identificada interpreta una consulta técnica como búsqueda de conocimiento en lugar de respuesta en texto plano — un caso que no se presenta en el uso habitual de la CAA.

En comparación, el modelo anterior de 2B registraba un 90,4 % (11 desviaciones). El modelo actual reduce diez veces las variaciones de enrutamiento manteniendo el mismo tamaño de descarga.

</details>

---

## Infraestructura y cumplimiento de la normativa de protección de datos (RGPD)

### Arquitectura multirregional

| Componente | Región | Propósito |
|---|---|---|
| **Supabase US** | US East (Virginia) | Base de datos principal — autenticación, datos de usuario, notas de cuidadores |
| **Supabase EU** | EU Central (Frankfurt) | Cumplimiento del RGPD — los datos de usuarios de la UE se almacenan en Europa |
| **Vercel** | Red global (Edge) | Aplicación web, rutas API, red de distribución de contenidos |
| **Inworld TTS** | EE. UU. | Síntesis de voz por IA (neuronal) |
| **HuggingFace Hub** | EE. UU. / UE | Alojamiento de modelos de IA (2B, 4B, 14B, 32B) |
| **En el dispositivo** | Dispositivo del usuario | Inferencia local con llama.cpp (iPhone/iPad/Mac) |

### Cumplimiento del RGPD

Los datos de los usuarios de la UE se almacenan en la región de Fráncfort (eu-central-1). El sistema identifica la ubicación mediante la cabecera `x-vercel-ip-country` de Vercel y asigna las operaciones a la instancia de Supabase correspondiente:

- **Usuarios de la UE** → `supabase-eu` (Fráncfort) — datos personales, autenticación, preferencias y notas de cuidadores
- **Usuarios fuera de la UE** → `supabase-us` (Virginia) — mismas categorías de datos, bajo jurisdicción de EE. UU.
- **Inferencia de IA** → en el dispositivo (sin salida de datos) o a través de la API Synalux (sin almacenamiento de datos de identificación personal)
- **Audio de voz (TTS)** → generado en servidor y transmitido en tiempo real, sin almacenamiento permanente

**Garantías de residencia de datos:**
- Los datos personales de la UE no se transfieren a servidores fuera del territorio europeo
- Tokens de autenticación asociados a la instancia regional de Supabase
- Notas de cuidadores cifradas en reposo (Supabase AES-256)
- Grabaciones de audio (Reproductor de confort) almacenadas en IndexedDB del navegador — sin subida a red
- La IA local en el dispositivo opera completamente sin conexión

**Derecho de supresión:** La solicitud de eliminación de un usuario elimina de forma transparente sus datos de autenticación, perfil, notas de cuidadores y métricas en la base de datos regional. Las instalaciones independientes se pueden reiniciar mediante el comando `supabase db reset`.

### Estimación de costes según escala de uso

| Usuarios activos | Supabase | Vercel | Voz (TTS) | Modelos de IA | Total estimado |
|---|---|---|---|---|---|
| 0–1K | $50/mes (2 regiones) | $0 (Hobby) | ~$5/mes | $0 (en el dispositivo) | ~$55/mes |
| 1K–10K | $50/mes | $20/mes (Pro) | ~$50/mes | $0 | ~$120/mes |
| 10K–100K | $50/mes + cómputo | $20/mes | ~$200/mes | RunPod $125/mes | ~$395/mes |

---

## Modelos de IA y compatibilidad de dispositivos

Compatible con dispositivos del ecosistema Apple. Funciona sin dependencia de servicios en la nube para la comunicación básica de CAA.

PrismAAC selecciona el modelo más adecuado según la capacidad del hardware, adaptándose en dispositivos con recursos limitados sin requerir conexión a internet para la comunicación habitual.

| Dispositivo | RAM | Modelo seleccionado | Precisión | CAA | Tamaño | Coste |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100 %** | 100 % | 8,4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (recuperación OOM) | **100 %** | 100 % | 4,7 GB / 1,1 GB | $0 |
| **iPhone 12–14, iPad anteriores** | <8 GB | 2B Q3_K_M (v43) | **99,1 %** | 100 % | 2,3 GB | $0 |
| **Mac M1+ por WiFi** | 16+ GB | 9B/27B mediante Ollama (v36) | **100 %** | 100 % | 8,4 GB | $0 |

### Esquema de selección en la aplicación web

La aplicación web intenta utilizar en primer lugar la inferencia local y, si no está disponible, se conecta a los servicios en la nube — permitiendo un coste $0 a usuarios con Ollama local y manteniendo el servicio completo a quienes no lo tienen.

<details>
<summary>Diagrama de selección</summary>

```
  El usuario envía un mensaje
        |
        v
  +-- OLLAMA LOCAL (detectado en localhost:11434) ---------------------+
  |                                                                     |
  |   14b (100%, ~1,1s) ─[error]─> 8b (100%, ~0,8s) ─[error]─> 2b (100%, ~1,6s)
  +---------------------------------------------------------------------+
         |
    [¿sin respuesta local?]
         |
         v
  +-- RESPALDO EN LA NUBE (API Synalux) ---+
  |  Claude Sonnet 4 (pago) / Gemini (gratis)|
  |  99% precisión, ~3s                     |
  +-----------------------------------------+

  Detección automática: al iniciar localiza Ollama → descarga el modelo idóneo → uso local permanente.
```

</details>

### Esquema de selección en la aplicación nativa iOS

La aplicación nativa comprueba la memoria RAM disponible al iniciar, descarga el modelo correspondiente desde la red CDN de HuggingFace (una sola vez) y ejecuta la inferencia con llama.cpp Metal. Sin servidores externos. Sin suscripciones requeridas. Los datos no salen del dispositivo.

<details>
<summary>Diagrama de selección</summary>

```
  Inicio de la aplicación
      |
      v
  Detección de RAM (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8,4 GB) ──> 100%, ~1,1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4,7 GB) ──> 100%, ~0,8s
      |                                    |
      |                               ¿Sin RAM? → 2B Q4_K_M (1,1 GB) → 100%, ~1,6s
      |
      +── <8 GB ──> 2B Q4_K_M (1,1 GB) ──> 100%, ~1,6s

  Todas las opciones: ejecución con llama.cpp Metal, coste $0, procesamiento local.
  Conexión remota: Ajustes → IA local → introducir la IP de la Mac para usar modelos 9B/27B.
```

</details>

### Modos de visualización del teclado (con persistencia de opción)

Un toque permite alternar entre tres disposiciones de teclado, guardando la preferencia para siguientes usos.

- **MAX KB** — el teclado ocupa todo el espacio inferior de la pantalla
- **MIN KB** — distribución combinada: 75 % categorías / 25 % teclado
- **HIDE KB** — categorías a pantalla completa, teclado oculto

<details>
<summary>Esquema de distribución</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | Barra herramientas | | Barra herramientas | | Barra herramientas |
  | Barra predicción   | | Barra predicción   | | Frase de bienvenida|
  |                    | |                    | |                    |
  |  TECLADO           | | Categorías  (75%)  | | Categorías         |
  |  ocupa el espacio  | |                    | | (pantalla completa)|
  |  inferior completo | |--------------------| |                    |
  |                    | | Teclado     (25%)  | |                    |
  | [123][v][ espacio ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- botón [v] -------->+-- botón lateral ---->+-- botón lateral --+
        |                                                                 |
        +<----------------------------------------------------------------+
```

</details>

### Resumen de rendimiento y costes

| Ruta de ejecución | Modelo | Precisión | Latencia promedio | Coste |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100 %** | ~1,1s | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (recuperación OOM) | **100 %** | ~0,8s | **$0** |
| Cualquier dispositivo | 2B Q4_K_M (v42) | **100 %** | ~1,6s | **$0** |
| WiFi a Mac | 9B/27B mediante Ollama (v36) | **100 %** | ~1,1s | **$0** |
| Nube (nivel gratuito) | Gemini 2.5 Flash | 99 % | ~3s | Incluido por Synalux |
| Nube (nivel de pago) | Claude Sonnet 4 | 99 % | ~3s | Incluido en el plan |

**Propuesta de valor:** Ofrece una precisión equivalente a modelos avanzados en cualquier equipo, desde un iPhone SE hasta un iPad Pro. La prioridad del procesamiento local elimina la dependencia de conexiones externas, costes recurrentes por API y transferencias de datos sensibles, manteniendo tiempos de respuesta inferiores a un segundo. La infraestructura prism-coder alcanza valores de precisión de entre **99,1 % y 100 %** en la prueba de evaluación de funciones BFCL (promedio de 3 ejecuciones, junio de 2026): los modelos 27B/9B/4B alcanzan el 100 %, y el modelo 2B registra un 99,1 %.

---

## Despliegue en servidor propio

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux mantiene la versión principal alojada (con opciones gratuita y de pago). Quienes deseen realizar un despliegue propio o crear versiones derivadas deben publicar sus cambios bajo la licencia AGPL-3.0.

### Modelos de IA locales (sin costes de red)

**Opción A — Desde la propia aplicación (recomendada):** Ajustes → 🤖 Modelos de IA local → seleccionar Descargar en el modelo deseado. Muestra la progresión del proceso. Funciona desde un iPad/iPhone conectado a la misma red WiFi que una Mac ejecutando Ollama.

**Opción B — Desde la línea de comandos:**

Instala [Ollama](https://ollama.com) y ejecuta:

```bash
ollama pull dcostenco/prism-coder:2b   # 1,1 GB — compatible con cualquier equipo, iPhone 12+ — 100% enrutamiento (v42)
ollama pull dcostenco/prism-coder:4b    # 4,7 GB — iPhone/iPad 8GB, Mac M1+ — 100% enrutamiento (v36)
ollama pull dcostenco/prism-coder:9b   # 8,4 GB — Mac 16GB+, iPad Pro — 100% enrutamiento (v36)
ollama pull dcostenco/prism-coder:27b   # 16 GB  — Mac M2 Ultra+ (MoE) — 100% enrutamiento (v7)
```

Añade al archivo `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**Conexión desde iPad Pro / iPhone mediante WiFi:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # en la Mac
# A continuación, en la app: Ajustes → IA local → introducir: http://<ip-de-la-mac>:11434
```

Enrutamiento automático: 2B → cualquier dispositivo · 4B → móviles / verificación · 9B → uso estándar · 27B → alta precisión / entornos profesionales. Respaldo en la nube si Ollama no está disponible.

---

<details>
<summary><strong>📚 Arquitectura técnica (enrutamiento de modelos, voz, reconocimiento de gestos, detalles de compilación)</strong></summary>

**Tecnologías principales**: Next.js, Zustand, Web Speech API (transcripción), Inworld TTS-2 + respaldo Azure Neural (síntesis de voz), FaceLandmarker (gestos).

**Enrutamiento de modelos** (gestión en servidor a través del portal Synalux):
- **En el dispositivo** (toque de casilla → frase): `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — procesamiento local, coste $0, ~1,6s
- **Consultas estándar en la nube** (chat, nivel gratuito): `prism-coder:9b` (Qwen3-14B optimizado) → respaldo Gemini 2.5 Flash
- **Consultas avanzadas en la nube** (razonamiento, nivel Pro): `prism-coder:27b` (QwQ-32B optimizado) → respaldo Claude Sonnet 4
- **Autocorrección y predicción de palabras**: Gemini 2.5 Flash-Lite — tiempo medio 752 ms, soporte multilingüe (es/ro/ru)
- Las operaciones principales de comunicación (toque → voz) no dependen del enrutamiento externo para no demorar la respuesta
- Resultados de precisión en enrutamiento ([evaluación Prism de 102 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), prompt v36/v7, promedio de 3 semillas, mayo de 2026):

  | Modelo | Precisión | Latencia promedio | Herramientas no válidas |
  |---|---|---|---|
  | prism-coder:27b swe14 (local) | **100,0 %** | 1,4s | 0 |
  | cascada 14B→32B (local) | **100,0 %** | ~1,1s | 0 |
  | prism-coder:4b v36 (local) | **100,0 %** | 0,8s | 0 |
  | prism-coder:9b v36 (local) | **100,0 %** | 1,1s | 0 |
  | Sonnet 4 (nube) | **99 %** | 3,2s | 0 |
  | Opus 4.7 (nube) | **98,3 %** | 3,0s | 0 |
  | prism-coder:2b v42 (local) | **100,0 %** | 1,6s | 0 |

- Evaluación extendida — eval_300 (300 casos, 17 herramientas, 9 categorías, 3 semillas): prism-coder:27b = **300/300 (100 %)**

**Cadena de respaldo de voz (TTS)**:
- Nivel 1: Inworld TTS-2 (de pago en todos los idiomas; acceso sin coste en es/ro/uk/ru/de/ko/ar gestionado por Synalux)
- Nivel 2: Voces de alta calidad de la API Web Speech del sistema operativo (sin conexión)
- Nivel 3: WASM espeak-ng (recurso local final)

**Reconocimiento de gestos**:
- Básico: posición de la cabeza + clic por fijación mediante FaceLandmarker
- Avanzado: posición de la mano mediante MediaPipe; perfiles de gestos guardados por usuario

**Estructura**: navegación basada en paneles sin enrutador de páginas, gestión de temas mediante variables de diseño para fondo, texto, bordes y tonos de acento.

**Documentación técnica detallada en este repositorio:**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — detalles del flujo de síntesis de voz
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — funcionamiento interno del modo de gestos
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — ajuste automático del tono de voz
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — gestión de avisos de emergencia
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — salvaguardas de aprendizaje por usuario
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — conjunto de pruebas para seguimiento cefálico y manual
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — especificaciones de accesibilidad para objetivos táctiles
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — bases de investigación y evidencias
- [`CHANGELOG.md`](CHANGELOG.md) — historial de cambios por versión

</details>

<details>
<summary><strong>🆕 Aspectos diferenciales de PrismAAC (bases de su arquitectura de software)</strong></summary>

**Tres capacidades que diferencian a PrismAAC de otras aplicaciones del sector:**

### 1. IA local en el dispositivo — adaptada a los requerimientos de protección de datos (HIPAA)

**Beneficios del procesamiento de IA local en la comunicación de CAA — velocidad, privacidad y disponibilidad:**

| Aspecto | IA basada solo en la nube | PrismAAC (procesamiento local prioritario) |
|--|---|---|
| Selección de casilla → reproducción de voz | 2–30s (dependiente de red) | **~0,5s** (procesamiento en el dispositivo) |
| Funcionamiento sin conexión a internet | ❌ No disponible | ✅ Disponible |
| Salida de datos de salud (PHI) del equipo | ✅ Se envían a la red | ❌ Permanece local (ruta de comunicación de voz) |
| Cumplimiento de HIPAA | Requiere acuerdos BAA con cada proveedor externo | **El procesamiento local conserva los datos en el equipo — facilita el cumplimiento de requisitos de seguridad** |
| Uso en zonas de baja cobertura | Interrupciones en el servicio | **Funcionamiento completo** |
| Coste mensual de infraestructura por usuario | $2–15 en tarifas de API | **$0 (en el dispositivo)** |

**El modelo de 2B se ejecuta íntegramente en tu dispositivo** — iPad M1+, Mac o portátil. Al seleccionar una casilla se obtiene una respuesta en ~500 ms sin realizar consultas externas a la red. Ni las frases, ni los datos personales ni los hábitos de uso salen del dispositivo en las operaciones habituales.

Las notas escritas por los cuidadores se cifran en el equipo antes de realizar cualquier sincronización opcional. A diferencia de otras plataformas de CAA que requieren subir los datos a servidores externos para su uso, PrismAAC permite un funcionamiento autónomo.

**Para despliegues institucionales o clínicos (modelos 9B y 27B):** los modelos 9B y 27B pueden ejecutarse en un equipo Mac dedicado mediante Ollama dentro de la red local del centro. Los iPad se conectan a través de la red WiFi interna — los datos se mantienen dentro de la instalación. Esta arquitectura facilita el cumplimiento de los controles técnicos de privacidad (como HIPAA) al conservar la información en la propia infraestructura; la conformidad regulatoria final depende de la entidad responsable del servicio mediante la aplicación de sus políticas, medidas de seguridad físicas y administrativas, y los acuerdos BAA que correspondan.

**Procedimiento de configuración:**

```
iPad / iPhone (conectado a la misma red WiFi que la Mac)
    ↓  se conecta a
Mac ejecutando Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  proporciona los modelos
prism-coder:2b · :14b · :32b
    ↓  todo el procesamiento permanece en la
Red local — sin tráfico hacia internet
```

Ajustes → 🤖 Modelos de IA local → introducir la IP de la Mac → disponibilidad inmediata de los modelos. Sin costes por servicios en la nube. Sin transferencia de datos de salud. Sin requerir conexión a internet para las funciones de comunicación de CAA.

### 2. Clasificación adaptativa de frases según el uso de cada usuario
Las listas fijas de frecuencia no se adaptan a las necesidades cambiantes. PrismAAC clasifica las sugerencias mediante la **activación por difusión de Prism v14.0.0**, basada en el modelo de memoria cognitiva ACT-R desarrollado en investigaciones de la Universidad Carnegie Mellon. Evalúa la recencia, la frecuencia y el historial de uso individual en lugar de aplicar un orden estático. Las frases utilizadas recientemente ganan relevancia; las frases no utilizadas durante meses reducen su prioridad (tasa de atenuación `d=0,25`, con una vida media cercana a un año).

### 3. Las correcciones de los cuidadores mejoran las sugerencias automáticamente
Cuando un cuidador corrige una propuesta no adecuada (por ejemplo: «no, la palabra elegida es *comer*, no *querer*»), el [sistema de captura posterior de auditoría](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) registra la corrección. Tras unas 50 sesiones, el sistema identifica estas situaciones *antes* de volver a mostrar una opción similar. Sin necesidad de etiquetar datos de forma manual ni realizar costosos reentrenamientos — las propias correcciones adaptan el modelo.

**Alcance de precisión:** La tasa de aciertos en la [evaluación Prism de 115 casos](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 herramientas de Prism, 12 categorías, promedio de 3 semillas, junio de 2026) registra: 27b = 100,0 %, 9b = 100,0 %, 4b = 100,0 %, 2b = 99,1 %. Sin nombres de herramientas inventados en ninguno de los modelos ni semillas probadas. El modelo 2B se ejecuta en el dispositivo para responder con rapidez; los modelos 9B y 27B gestionan interacciones complejas o flujos de trabajo profesionales mediante conexión WiFi a un equipo Mac. En la tabla de clasificación general de Berkeley BFCL V4 (con más de 2.000 casos de llamadas a funciones), el modelo 2B obtiene ~59 %, en la línea de otros modelos de tamaño inferior a 2B. El valor de PrismAAC radica en la combinación de estos modelos junto al motor de activación por difusión del sistema.

</details>

---

## Información para desarrolladores

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # +4900 pruebas unitarias
npm run e2e                  # Pruebas automatizadas en Playwright con 11 perfiles de dispositivos
```

### Métricas y seguimiento

| Panel de control | Qué métricas supervisa |
|-----------|---------------|
| [Prism AAC — Análisis de usuario](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | Sesiones, errores registrados, palabras predichas, casillas seleccionadas, eventos de reproducción de voz, idiomas, países de origen, tipos de dispositivo, planes de uso, métricas de seguimiento de cabeza |

Integración con Datadog RUM: consulta `lib/datadog.ts` y `components/DatadogInit.tsx`. Incluye 7 pruebas de rendimiento E2E en `e2e/datadog-integration.spec.ts`.

---

## Licencia

[AGPL-3.0](LICENSE) — código abierto, certificado por la OSI, compatible con proyectos de concesión de subvenciones.

Eres libre de crear derivados y alojar tu propia instancia. La licencia requiere que compartas las modificaciones que realices bajo los términos de AGPL-3.0 — garantizando que los avances en comunicación de CAA permanezcan accesibles para todas las familias.

© 2024–2026 Synalux LLC
