import { existsSync } from 'fs'
import { copyFile, readFile, writeFile } from 'fs/promises'

export const AGENT_DOCS_FILE = 'AGENTS.md'

const MARKER_START = '<!-- at-mos:start -->'
const MARKER_END = '<!-- at-mos:end -->'

const SECTION = `${MARKER_START}
## at-mos — generador de @theme para Tailwind v4

Este proyecto usa **at-mos** para generar y mantener el bloque \`@theme\` de Tailwind v4.
Si no está instalado: \`npx @kevdev35/at-mos\` o \`pnpm add -g @kevdev35/at-mos\`.

### Uso en modo headless (recomendado para agentes)

Todos los comandos responden JSON (\`{"ok":true|false,...}\`). Añade \`--json\`.
Para el contrato completo: \`at-mos ai --json\`.

\`\`\`bash
at-mos env --json                                          # reconocer el proyecto
at-mos init --from tokens.json --output <css> --yes --json # generar el @theme
at-mos list --json                                         # listar variables
at-mos update --add --name --color-x --value "#fff" --json # agregar variable
at-mos update --edit --name --color-x --value "#fff" --json # editar variable
at-mos update --delete --names --color-x --json            # eliminar variable
\`\`\`

### Reglas

- \`stdout\` = solo JSON; \`stderr\` = mensajes humanos (usa \`2>/dev/null\` para parsear limpio).
- Errores con categoría para saber si fue culpa del agente o de la herramienta:
  - \`caller\` → el comando/datos fueron incorrectos. Corrige y reintenta.
  - \`environment\` → estado del proyecto (sin CSS, package.json inválido). Adaptate.
  - \`tool\` → bug interno de at-mos. No reintentes; reporta con el stack incluido.
${MARKER_END}`

export interface AgentDocsOptions {
  force?: boolean
}

export interface AgentDocsResult {
  path: string
  created: boolean
  updated: boolean
  backup: string | null
}

/**
 * Asegura que AGENTS.md tenga la sección de at-mos.
 *
 * Reglas:
 *   - Si AGENTS.md no existe → se crea con la sección.
 *   - Si ya tiene la sección y no se pasa force → no toca nada (sin duplicados).
 *   - Si no tiene la sección → hace backup (AGENTS.md.bak) y agrega el bloque
 *     al final, preservando todo el contenido existente.
 *   - Con force → hace backup y reemplaza la sección entre marcadores.
 */
export async function ensureAgentDocs(opts: AgentDocsOptions = {}): Promise<AgentDocsResult> {
  const target = AGENT_DOCS_FILE

  if (!existsSync(target)) {
    await writeFile(target, SECTION + '\n', 'utf-8')
    return { path: target, created: true, updated: false, backup: null }
  }

  const existing = await readFile(target, 'utf-8')
  const hasSection = existing.includes(MARKER_START) && existing.includes(MARKER_END)

  if (hasSection && !opts.force) {
    return { path: target, created: false, updated: false, backup: null }
  }

  let next: string
  if (hasSection && opts.force) {
    // Reemplaza solo el contenido entre marcadores, preservando el resto.
    const before = existing.slice(0, existing.indexOf(MARKER_START))
    const after = existing.slice(existing.indexOf(MARKER_END) + MARKER_END.length)
    next = before + SECTION + '\n' + after.replace(/^\s*\n/, '')
  } else {
    // Append al final, sin perder nada del usuario.
    const sep = existing.length > 0 && !existing.endsWith('\n\n') ? '\n\n' : ''
    next = existing + sep + SECTION + '\n'
  }

  if (next === existing) {
    return { path: target, created: false, updated: false, backup: null }
  }

  // Backup antes de escribir, igual que con global.css.
  const backupPath = `${target}.bak`
  await copyFile(target, backupPath)
  await writeFile(target, next, 'utf-8')

  return { path: target, created: false, updated: true, backup: backupPath }
}
