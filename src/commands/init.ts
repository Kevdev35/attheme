import * as p from '@clack/prompts'
import { detectEnv } from '../core/detector.js'
import { askInputMode, askFilePath, collectVariables, confirmOutput, askOutputPath, selectVariables } from '../core/prompts.js'
import { writeTheme } from '../core/writer.js'
import { parseTokensFromFile } from '../core/parser.js'
import { logger, intro, outro, outputJson, fail, isTTY } from '../utils/logger.js'
import { AtMosError } from '../utils/errors.js'
import { ensureAgentDocs } from '../core/agent-docs.js'

import { execSync } from 'child_process'

interface InitOptions {
  output?: string
  from?: string
  yes?: boolean
  json?: boolean
  agent?: boolean
}

export async function init(options: InitOptions) {
  const headless = options.yes || options.json || !isTTY

  intro('\x1b[35m@t\x1b[36mmos\x1b[0m — generador de @theme para Tailwind')

  // 1. Detectar entorno
  const env = await detectEnv()

  if (!headless) {
    logger.step(`Package manager: ${env.packageManager}`)
    logger.step(`Framework: ${env.framework}`)
    logger.step(`Tailwind: ${env.tailwindVersion}`)
  }

  // 2. Verificar la instalacion de Tailwind
  if (headless) {
    if (env.tailwindVersion === 'not-installed') {
      logger.warn('Tailwind CSS no está instalado. El @theme generado no funcionará sin él.')
    }
  } else if (env.tailwindVersion === 'not-installed') {
    const install = await p.confirm({
      message: 'Tailwind CSS no está instalado. ¿Quieres instalarlo ahora?',
      initialValue: true,
    })

    if (install) {
      const version = await p.select({
        message: 'Selecciona la versión a instalar:',
        options: [
          { value: 'tailwindcss @tailwindcss/vite', label: 'Tailwind v4.2', hint: 'Recomendado para @theme' },
          { value: 'tailwindcss@3', label: 'Tailwind v3 (Estable)', hint: 'No soporta @theme' },
        ],
      })

      if (p.isCancel(version)) {
        outro('Instalación cancelada.')
        return
      }

      const s = p.spinner()
      s.start(`Instalando ${version} con ${env.packageManager}...`)

      try {
        const installCmd = `${env.packageManager} ${env.packageManager === 'yarn' ? 'add' : 'install'} ${version}`
        execSync(installCmd, { stdio: 'ignore' })
        s.stop('Instalación completada')
        logger.success(`Tailwind CSS instalado con éxito.`)
      } catch (e) {
        s.stop('Error en la instalación')
        logger.error('No se pudo instalar Tailwind. Por favor, hazlo manualmente.')
      }
    } else {
      logger.warn('Continuando sin instalar. El CSS generado podría no funcionar correctamente.')
    }
  } else if (env.tailwindVersion === '3') {
    logger.warn('Tienes Tailwind v3. @theme es exclusivo de v4+.')
    const upgrade = await p.confirm({
      message: '¿Deseas actualizar a la v4?',
      initialValue: false
    })
  }

  // 3. Modo no-interactivo (IAs / CI): sin prompts, flags obligatorios
  if (headless) {
    if (!options.from) {
      fail(new AtMosError(
        'USAGE_MISSING_FROM',
        'Modo no-interactivo requiere --from <archivo>.',
        'Ej: at-mos init --from tokens.json --output app.css --yes'
      ))
    }

    let parsed
    try {
      parsed = await parseTokensFromFile(options.from)
    } catch (err) {
      if (err instanceof AtMosError) fail(err)
      throw err
    }

    const outputPath = options.output ?? env.cssCandidate
    if (!outputPath) {
      fail(new AtMosError(
        'ENV_NO_CSS_CANDIDATE',
        'No se encontró un archivo CSS candidato.',
        'Usa --output <ruta> para indicar dónde escribir el CSS.'
      ))
    }

    await writeTheme(outputPath, parsed)

    // Dejar el rastro para agentes de IA (AGENTS.md). Opt-out con --no-agent.
    const agentResult = options.agent === false ? null : await ensureAgentDocs()

    if (options.json) {
      outputJson({
        ok: true,
        command: 'init',
        output: outputPath,
        variables: parsed.length,
        ...(agentResult
          ? { agentDocs: agentResult.path, ...(agentResult.backup ? { agentDocsBackup: agentResult.backup } : {}) }
          : {}),
      })
    } else {
      logger.success(`CSS generado en ${outputPath} (${parsed.length} variables)`)
      if (agentResult) {
        logger.step(
          agentResult.created
            ? `AGENTS.md creado para agentes de IA`
            : agentResult.updated
              ? `Sección at-mos agregada en ${agentResult.path} (backup: ${agentResult.backup})`
              : `La sección at-mos ya existe en ${agentResult.path}`
        )
      }
    }
    return
  }

  // 4. Flujo interactivo
  let variables: { name: string; value: string }[] = []

  if (options.from) {
    try {
      const spinner = p.spinner()
      spinner.start(`Leyendo variables desde ${options.from}...`)
      const parsed = await parseTokensFromFile(options.from)
      spinner.stop(`${parsed.length} variables encontradas`)

      variables = await selectVariables(parsed)
      logger.success(`${variables.length} variables seleccionadas`)
    } catch (error) {
      if (error instanceof AtMosError) fail(error)
      throw error
    }
  } else {
    const mode = await askInputMode()

    if (mode === 'file') {
      const filePath = await askFilePath()
      try {
        const spinner = p.spinner()
        spinner.start(`Leyendo variables desde ${filePath}...`)
        const parsed = await parseTokensFromFile(filePath)
        spinner.stop(`${parsed.length} variables encontradas`)

        variables = await selectVariables(parsed)
        logger.success(`${variables.length} variables seleccionadas`)
      } catch (error) {
        if (error instanceof AtMosError) fail(error)
        throw error
      }
    } else {
      variables = await collectVariables()
    }
  }

  // 5. Validar que haya variables
  if (variables.length === 0) {
    logger.warn('No se definió ninguna variable. Operación cancelada.')
    outro('Sin cambios.')
    return
  }

  // 6. Resolver ruta de salida
  let outputPath = options.output ?? env.cssCandidate

  if (!outputPath) {
    logger.warn('No se encontró un archivo CSS automáticamente.')
    outputPath = await askOutputPath()
  } else {
    const confirmed = await confirmOutput(outputPath)
    if (!confirmed) outputPath = await askOutputPath()
  }

  // 7. Escribir CSS
  const spinner = p.spinner()
  spinner.start('Generando tu global.css...')
  await writeTheme(outputPath, variables)
  spinner.stop('Listo')

  logger.success(`CSS generado en ${outputPath}`)

  if (options.agent !== false) {
    const writeAgent = await p.confirm({
      message: '¿Dejar instrucciones para agentes de IA en AGENTS.md?',
      initialValue: true,
    })

    if (p.isCancel(writeAgent)) process.exit(0)

    if (writeAgent) {
      const agentResult = await ensureAgentDocs()
      logger.step(
        agentResult.created
          ? `AGENTS.md creado para agentes de IA`
          : agentResult.updated
            ? `Sección at-mos agregada en ${agentResult.path} (backup: ${agentResult.backup})`
            : `La sección at-mos ya existe en ${agentResult.path}`
      )
    }
  }

  outro('¡Tu @theme está listo! Edítalo cuando quieras.')
}
