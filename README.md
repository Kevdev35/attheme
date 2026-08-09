# 🌬️ at-mos
---

## ¿Qué es at-mos?

Una CLI interactiva que **genera el `@theme` de Tailwind v4** a partir de tus design tokens — ya sea que vengan de un JSON anidado, un archivo Style Dictionary, un formato W3C, un CSS existente, o directamente escritos a mano con prompts bonitos.

En lugar de abrir `global.css` y escribir 40 variables a mano cada que arrancas un proyecto, corres `at-mos init` y el `@theme` aparece solo.

Pero at-mos **no es solo un generador de CSS**. Es una herramienta de **orquestación de identidad visual** para Tailwind v4. Un puente entre:

```
Diseñadores (Figma / tokens)  →  at-mos  →  Devs (CSS / Tailwind v4)
```

---

## El problema que resuelve

Tailwind v4 movió la configuración del `tailwind.config.js` al CSS nativo con `@theme`. Gran decisión: más simple, más CSS-like, zero config.

Pero con un costo: **no hay tooling alrededor**.

- ¿Tienes un `tokens.json` de 300 variables desde Figma? Lo tienes que convertir a CSS a mano.
- ¿Tu equipo define los colores en Style Dictionary? A copiar y pegar uno por uno.
- ¿Usas tokens con modo claro/oscuro? A duplicar todo.
- ¿Quieres compartir los mismos tokens entre 5 proyectos? Pega y reza.

**at-mos es esa herramienta que faltaba.**

---

## ¿Qué lo hace diferente?

| vs | at-mos |
|----|--------|
| **Copiar y pegar** | `at-mos init --from tokens.json` y listo |
| **Escribir CSS a mano** | Prompts interactivos, selección múltiple, backup automático |
| **Script casero de parsing** | Soporta 3 formatos de tokens (plano, Style Dictionary, W3C) |
| **Tailwind config v3** | Detecta tu framework, package manager, y versión de Tailwind |
| **Nada (no tooling)** | Se actualiza, se expande, acepta plugins |

---

## Nombres y conceptos clave

Entender at-mos es entender su vocabulario:

| Término | Significado |
|---------|-------------|
| **Token** | Una variable de diseño: `--color-primary: #7c3aed` |
| **`@theme`** | El bloque CSS donde Tailwind v4 define su tema |
| **Design System** | El conjunto completo de tokens que definen la identidad visual |
| **Mode** | Variante de un token (light / dark / hover / active) |
| **Namespace** | Grupo jerárquico: `color.surface.light` → `--color-surface-light` |
| **Style Dictionary** | Formato JSON de Amazon con `{ value, type }` |
| **W3C DTCG** | Formato estándar de Design Tokens Consortium con `{ $value, $type }` |
| **Provider** | Modelo de IA configurable (OpenAI, Anthropic, Gemini, Ollama) |
| **Manifest** | El archivo `tokens.json` que describe tu sistema de diseño |

---

## Para quién es

### 🧑‍💻 Dev solitario
Arrancas proyectos seguido. Cansado de escribir el mismo `@theme` una y otra vez. Con `at-mos init` y un `tokens.json` compartido entre proyectos, tu identidad visual viaja con vos.

### 👥 Equipo pequeño
El diseñador define los tokens en Figma, los exporta como JSON, y at-mos los convierte en CSS para todos los proyectos del equipo. Un solo archivo, cero discrepancias.

### 🏢 Organización grande
Múltiples equipos, múltiples productos, un solo Design System. at-mos sincroniza tokens entre proyectos, soporta formatos estándar de la industria (Style Dictionary, W3C), y se integra con Figma y CI/CD.

---

## Cómo funciona

```
                              ┌──────────────────┐
                              │   tokens.json     │
                              │  (anidado / SD /  │
                              │   W3C / plano)    │
                              └────────┬─────────┘
                                       │
    ┌──────────┐          ┌────────────▼──────────┐
    │ Screenshot│          │                      │
    │ (IA)     │───►      │      at-mos init      │
    └──────────┘          │                      │
                          │ 1. Detecta entorno    │
    ┌──────────┐          │ 2. Parsea tokens      │───► ┌──────────────┐
    │ Prompt   │          │ 3. Pregunta / filtra   │     │  global.css  │
    │ (IA)     │───►      │ 4. Genera @theme       │     │  con @theme  │
    └──────────┘          │ 5. Backup automático   │     └──────────────┘
                          └────────────────────────┘
```

### Flujo típico

```bash
# 1. En tu proyecto, corres
at-mos init

# 2. at-mos detecta tu framework y package manager
#    ─────────────────────────────────────────────
#    Package manager: pnpm
#    Framework:       Next.js
#    Tailwind:        v4
#
# 3. Te pregunta cómo quieres definir las variables
#    ─────────────────────────────────────────────
#    ¿Cómo quieres definir tus variables?
#    ● Importar desde archivo (.json / .css)
#    ○ Escribirlas una por una
#
# 4. Cargas tu tokens.json
#    ─────────────────────────────────────────────
#    ✅ 78 variables encontradas en tokens.json
#    Selecciona cuáles incluir (Enter para continuar):
#    ☑ --color-primary: #7c3aed
#    ☑ --color-secondary: #06b6d4
#    ☑ --color-surface-light: #ffffff
#    ☑ --color-surface-dark: #0f172a
#    ☐ --debug-outline: 1px solid red
#
# 5. Se genera el CSS con backup automático
#    ─────────────────────────────────────────────
#    ✅ Backup guardado → src/app.css.bak
#    ✅ CSS generado en src/app.css
#    ¡Tu @theme está listo!
```

---

## Formatos de tokens soportados

### 📄 Plano (backward compatible)
```json
{
  "color-primary": "#7c3aed",
  "spacing-base": "0.5rem"
}
```

### 🌳 Anidado (recomendado)
```json
{
  "color": {
    "primary": "#7c3aed",
    "surface": {
      "light": "#ffffff",
      "dark": "#0f172a"
    }
  }
}
```
→ `--color-primary`, `--color-surface-light`, `--color-surface-dark`

### 🎨 Style Dictionary (Amazon / Tokens Studio)
```json
{
  "color": {
    "primary": { "value": "#7c3aed", "type": "color" }
  }
}
```

### 🌐 W3C Design Tokens (estándar emergente)
```json
{
  "color": {
    "primary": { "$value": "#7c3aed", "$type": "color" }
  }
}
```

---

## ¿Qué sigue?

at-mos está en **v1.2** y recién está despegando.

### Ahora (v1.5 — Core mejorado)
- ✅ Parser de tokens anidados, Style Dictionary y W3C
- ⬜ Más frameworks detectados (Nuxt, Remix, Solid, Laravel…)
- ⬜ Modo non-interactive para CI/CD
- ⬜ Preview y diff del CSS antes de escribir

### Siguiente (v2.0 — IA)
- 🧠 Extraer tokens desde screenshots y mockups
- 🧠 Generar temas con descripciones en lenguaje natural
- 🧠 Extraer tokens desde URLs de sitios web
- 🧠 Trae tu propio modelo (OpenAI, Anthropic, Gemini, Ollama)

### Después (v2.5+ — Ecosistema)
- 🎨 Integración con Figma (pull / push)
- 💻 Extensión para VS Code
- 🌐 Landing page con playground online
- 🤝 Colaboración en equipo y sync de tokens

---

## Filosofía

**at-mos no opina.** No impone nombres de variables, no te fuerza a usar una convención, no te obliga a nada. Detecta lo que tienes, pregunta lo que falta, y escribe lo correcto. Nada más.

**at-mos es transparente.** El output es CSS 100% Tailwind v4 estándar. No runtime, no dependencias ocultas, no magia. Si mañana dejas de usar at-mos, tu `@theme` sigue funcionando.

**at-mos es extensible.** Plugins, providers de IA, formatos de importación — todo está diseñado para que cualquiera pueda agregar lo que necesita sin tocar el core.

**El archivo se llama `gobal.css` por un typo y se queda.** 🥚

---

## Quick start

```bash
# Sin instalar (recomendado para probar)
npx @kevdev35/at-mos init

# Instalado globalmente
pnpm add -g @kevdev35/at-mos
at-mos init

# Desde un archivo de tokens
at-mos init --from tokens.json --output src/app.css
```

> **Requiere Node.js 18+**

---

## Proyecto

```bash
git clone https://github.com/Kevdev35/at-mos
cd at-mos
pnpm install
pnpm dev
```

MIT © [KevDev35](https://github.com/Kevdev35)
Hecho con 🧠 y 😤 — porque los design tokens no deberían ser un dolor de huevos.
