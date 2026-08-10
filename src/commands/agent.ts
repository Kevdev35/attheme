import { ensureAgentDocs } from '../core/agent-docs.js'
import { logger, intro, outro, outputJson, isTTY } from '../utils/logger.js'

interface AgentOptions {
  json?: boolean
  yes?: boolean
  force?: boolean
}

export async function agent(options: AgentOptions) {
  const headless = options.json || options.yes || !isTTY

  intro('at-mos — instrucciones para agentes de IA')

  const result = await ensureAgentDocs({ force: options.force })

  if (headless) {
    outputJson({ ok: true, command: 'agent', ...result })
    return
  }

  if (result.created) {
    logger.success(`AGENTS.md creado en ${result.path}`)
  } else if (result.updated) {
    logger.success(`Sección at-mos actualizada en ${result.path}`)
    if (result.backup) logger.step(`Backup del anterior en ${result.backup}`)
  } else {
    logger.info(`La sección at-mos ya existe en ${result.path}. Nada que hacer.`)
  }

  outro('Cualquier agente de IA que trabaje en este proyecto descubrirá at-mos automáticamente.')
}
