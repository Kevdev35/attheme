import { isTTY, outputJson } from '../utils/logger.js'

interface AiOptions {
  json?: boolean
}

const AI_COMMANDS = [
  {
    command: 'env',
    usage: 'at-mos env --json',
    description: 'Detecta el entorno del proyecto (package manager, framework, versión de Tailwind, CSS candidato).',
  },
  {
    command: 'init',
    usage: 'at-mos init --from tokens.json --output src/app/globals.css --yes --json',
    description: 'Genera el @theme desde un archivo de tokens (JSON anidado, Style Dictionary o W3C). Importa todas las variables, sin prompts.',
  },
  {
    command: 'list',
    usage: 'at-mos list --json',
    description: 'Lista las variables definidas en el @theme.',
  },
  {
    command: 'update',
    usage: 'at-mos update --add --name --color-x --value "#f00" --json',
    description: 'Agrega una variable.',
  },
  {
    command: 'update',
    usage: 'at-mos update --edit --name --color-x --value "#0f0" --json',
    description: 'Modifica una variable existente.',
  },
  {
    command: 'update',
    usage: 'at-mos update --delete --names --color-x --names --color-y --json',
    description: 'Elimina una o varias variables.',
  },
  {
    command: 'agent',
    usage: 'at-mos agent',
    description: 'Crea o actualiza AGENTS.md para que cualquier agente descubra at-mos en el proyecto.',
  },
]

const RULES = [
  'Modo no-interactivo: stdin no-TTY, --yes o --json activan headless automáticamente.',
  'stdout = solo datos (JSON). stderr = mensajes humanos. Redirige stderr (2>/dev/null) para parsear limpio.',
  'exit 0 = éxito, exit 1 = error.',
  'Respuestas: {"ok":true,...} en éxito, {"ok":false,"error":{...}} en error.',
  'Valores que empiezan con - o # deben citarse con comillas en la shell.',
]

const ERROR_CATEGORIES = [
  {
    category: 'caller',
    meaning: 'La invocación o los datos fueron incorrectos (flag faltante, archivo inexistente, variable duplicada o inexistente, JSON inválido). El agente debe corregir su comando y reintentar.',
    codes: 'USAGE_*, INPUT_*',
  },
  {
    category: 'environment',
    meaning: 'Estado del proyecto: no hay CSS candidato, archivo ilegible. El agente debe adaptarse (ej. crear el archivo o pasar --output).',
    codes: 'ENV_*',
  },
  {
    category: 'tool',
    meaning: 'Bug interno de at-mos. NO reintentar el mismo comando; reportar con el stack incluido.',
    codes: 'TOOL_*',
  },
]

function renderText(): string {
  const lines: string[] = []

  lines.push('at-mos — Modo IA / Headless')
  lines.push('')
  lines.push('Diseñado para que agentes de IA (OpenCode, Claude Code, etc.) y pipelines')
  lines.push('CI/CD generen y actualicen el @theme de Tailwind v4 sin interacción.')
  lines.push('')
  lines.push('Reglas:')
  for (const rule of RULES) {
    lines.push(`  • ${rule}`)
  }
  lines.push('')
  lines.push('Errores (categorías — para saber si fue culpa del agente o de la herramienta):')
  for (const c of ERROR_CATEGORIES) {
    lines.push(`  • ${c.category} [${c.codes}]: ${c.meaning}`)
  }
  lines.push('')
  lines.push('Comandos:')
  for (const c of AI_COMMANDS) {
    lines.push(`  ${c.usage}`)
    lines.push(`      ${c.description}`)
  }
  lines.push('')
  lines.push('Para el contrato en JSON (legible por máquinas): at-mos ai --json')

  return lines.join('\n')
}

export async function ai(options: AiOptions) {
  if (options.json || !isTTY) {
    outputJson({ ok: true, command: 'ai', mode: 'headless', rules: RULES, errors: ERROR_CATEGORIES, commands: AI_COMMANDS })
    return
  }

  console.log(renderText())
}
