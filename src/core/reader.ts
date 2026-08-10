import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import type { ThemeVariable } from './writer.js'
import { AtMosError } from '../utils/errors.js'

export async function readTheme(filePath: string): Promise<ThemeVariable[]> {
  if (!existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`)
  }

  const raw = await readFile(filePath, 'utf-8')
  return extractThemeVariables(raw)
}

export async function readThemeSafe(filePath: string): Promise<ThemeVariable[]> {
  try {
    return await readTheme(filePath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Archivo no encontrado')) {
      throw new AtMosError(
        'INPUT_FILE_NOT_FOUND',
        msg,
        `Verifica la ruta. Usa --output <ruta> o corre "at-mos env --json" para ver el CSS candidato.`
      )
    }
    throw new AtMosError(
      'ENV_FILE_UNREADABLE',
      `No se pudo leer el archivo: ${filePath} — ${msg}`,
      'Verifica permisos de lectura y que el archivo exista.'
    )
  }
}

export function extractThemeVariables(css: string): ThemeVariable[] {
  const variables: ThemeVariable[] = []

  const themeBlock = css.match(/@theme\s*\{([^}]*)\}/s)
  if (!themeBlock) return variables

  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g
  let match

  while ((match = regex.exec(themeBlock[1])) !== null) {
    variables.push({
      name: match[1].trim(),
      value: match[2].trim()
    })
  }

  return variables
}