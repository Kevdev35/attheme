import * as p from '@clack/prompts'
import { detectEnv } from '../core/detector.js'
import { askOutputPath } from '../core/prompts.js'
import { readThemeSafe } from '../core/reader.js'
import { logger, intro, outro, outputJson, fail, isTTY } from '../utils/logger.js'
import { AtMosError } from '../utils/errors.js'

interface ListOptions {
  output?: string
  json?: boolean
}

export async function list(options: ListOptions) {
  const headless = options.json || !isTTY

  intro('at-mos — variables en tu @theme')

  const env = await detectEnv()

  let cssPath = options.output ?? env.cssCandidate

  if (!cssPath) {
    if (headless) {
      fail(new AtMosError(
        'ENV_NO_CSS_CANDIDATE',
        'No se encontró un archivo CSS.',
        'Usa --output <ruta> para indicar el archivo, o crea el CSS primero con at-mos init.'
      ))
    }
    logger.warn('No se encontró un archivo CSS automáticamente.')
    cssPath = await askOutputPath()
  }

  let variables
  try {
    variables = await readThemeSafe(cssPath)
  } catch (err) {
    if (err instanceof AtMosError) fail(err)
    throw err
  }

  if (headless) {
    outputJson({ ok: true, command: 'list', output: cssPath, variables })
    return
  }

  logger.step(`Variables en ${cssPath}`)
  logger.step(`${variables.length} variables encontradas`)

  if (variables.length === 0) {
    logger.warn('No se encontraron variables @theme en ese archivo.')
    outro('Sin variables.')
    return
  }

  for (const { name, value } of variables) {
    p.log.info(`${name}: ${value}`)
  }

  outro(`${variables.length} variables listadas.`)
}
