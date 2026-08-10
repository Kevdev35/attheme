import { detectEnv } from '../core/detector.js'
import { logger, intro, outro, outputJson, isTTY } from '../utils/logger.js'

interface EnvOptions {
  json?: boolean
}

export async function env(options: EnvOptions) {
  const headless = options.json || !isTTY

  const env = await detectEnv()

  if (headless) {
    outputJson({ ok: true, command: 'env', ...env })
    return
  }

  intro('at-mos — entorno detectado')
  logger.step(`Package manager: ${env.packageManager}`)
  logger.step(`Framework: ${env.framework}`)
  logger.step(`Tailwind: ${env.tailwindVersion}`)
  logger.step(`CSS candidato: ${env.cssCandidate ?? 'ninguno'}`)
  outro('Entorno listo para generar tu @theme.')
}
