import { existsSync } from 'fs'
import { copyFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { AtMosError } from '../utils/errors.js'

export interface ThemeVariable {
  name: string
  value: string
}

export async function writeTheme(
  outputPath: string,
  variables: ThemeVariable[]
): Promise<void> {
  try {
    await ensureDir(outputPath)
    await backup(outputPath)
    const css = generateCss(variables)
    await writeFile(outputPath, css, 'utf-8')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AtMosError(
      'TOOL_WRITE_FAILED',
      `No se pudo escribir el archivo: ${outputPath} — ${msg}`,
      'Verifica los permisos de escritura del directorio.'
    )
  }
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  await mkdir(dir, { recursive: true })
}

async function backup(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await copyFile(filePath, `${filePath}.bak`)
  }
}

function generateCss(variables: ThemeVariable[]): string {
  const vars = variables
    .map(({ name, value }) => `  ${name}: ${value};`)
    .join('\n')

  return `@import 'tailwindcss';\n\n@theme {\n${vars}\n}\n`
}