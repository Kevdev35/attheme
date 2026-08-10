import { readFile } from 'fs/promises'
import { extname } from 'path'
import type { ThemeVariable } from './writer.js'
import { AtMosError } from '../utils/errors.js'

// ──────────────────────────────────────────────
// Tipos que puede tener un valor en tokens.json
// ──────────────────────────────────────────────

type TokenValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { $value?: unknown; $type?: string; [key: string]: unknown }
  | { value?: unknown; type?: string; [key: string]: unknown }
  | { [key: string]: unknown }

// ──────────────────────────────────────────────
// Parseo principal (delega según extensión)
// ──────────────────────────────────────────────

export async function parseFromFile(filePath: string): Promise<ThemeVariable[]> {
  const ext = extname(filePath)

  if (ext === '.json') return parseJson(filePath)
  if (ext === '.css') return parseCss(filePath)

  throw new Error(`Formato no soportado: ${ext}. Usa .json o .css`)
}

/**
 * Igual que parseFromFile pero con errores estructurados (AtMosError)
 * para que un agente pueda distinguir el origen del fallo.
 */
export async function parseTokensFromFile(filePath: string): Promise<ThemeVariable[]> {
  try {
    return await parseFromFile(filePath)
  } catch (err) {
    if (err instanceof AtMosError) throw err

    const msg = err instanceof Error ? err.message : String(err)

    if (err instanceof SyntaxError) {
      throw new AtMosError(
        'INPUT_PARSE_FAILED',
        `El archivo ${filePath} no es JSON válido.`,
        'Revisa la sintaxis del JSON y vuelve a intentarlo.'
      )
    }

    if (msg.includes('Formato no soportado')) {
      throw new AtMosError(
        'INPUT_UNSUPPORTED_FORMAT',
        msg,
        'Usa archivos .json o .css.'
      )
    }

    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT' || msg.includes('ENOENT')) {
      throw new AtMosError(
        'INPUT_FILE_NOT_FOUND',
        `No se pudo leer el archivo: ${filePath}`,
        'Verifica la ruta. Puedes correr "at-mos env --json" para ver el directorio de trabajo.'
      )
    }

    throw new AtMosError(
      'INPUT_PARSE_FAILED',
      `No se pudo parsear ${filePath}: ${msg}`,
      'Revisa el contenido del archivo.'
    )
  }
}

// ──────────────────────────────────────────────
// Parseo JSON — plano, anidado, Style Dictionary, W3C
// ──────────────────────────────────────────────

async function parseJson(filePath: string): Promise<ThemeVariable[]> {
  const raw = await readFile(filePath, 'utf-8')
  const data = JSON.parse(raw)
  return flattenTokens(data, '')
}

/**
 * Aplana recursivamente un objeto de tokens.
 *
 * Soporta:
 *   - { "color-primary": "#hex" }              → plano
 *   - { color: { primary: "#hex" } }            → anidado simple
 *   - { color: { primary: { value: "#hex" } } } → Style Dictionary
 *   - { color: { primary: { $value: "#hex" } } }→ W3C DTCG
 *   - { value: { light: "...", dark: "..." } }  → modo (aplanado con sufijo)
 */
function flattenTokens(
  obj: Record<string, TokenValue>,
  prefix: string,
): ThemeVariable[] {
  const result: ThemeVariable[] = []

  for (const [key, value] of Object.entries(obj)) {
    // Saltar keys de metadata que no son tokens
    if (key === '$schema' || key === '$description') continue

    const joinedKey = prefix ? `${prefix}-${key}` : key

    if (value === null || value === undefined) continue

    // ── String / Number → token directo ──
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result.push({
        name: `--${joinedKey}`,
        value: String(value),
      })
      continue
    }

    // ── Object ──
    if (typeof value === 'object' && !Array.isArray(value)) {
      const objValue = value as Record<string, unknown>

      // W3C format: { $value: "...", $type: "..." }
      if ('$value' in objValue) {
        const resolved = resolveValue(objValue.$value, joinedKey)
        if (resolved) result.push(...resolved)
        continue
      }

      // Style Dictionary: { value: "...", type: "..." }
      // `value`/`$value` marca un token, aunque tenga metadata extra
      // (deprecated, description, comment, etc.)
      if ('value' in objValue) {
        const resolved = resolveValue(objValue.value, joinedKey)
        if (resolved) result.push(...resolved)
        continue
      }

      // Namespace → recursión
      result.push(...flattenTokens(objValue as Record<string, TokenValue>, joinedKey))
      continue
    }

    // ── Array → no se puede representar como CSS custom property simple ──
    //   (shadows, fonts compuestos, etc.) — se omiten silenciosamente
    if (Array.isArray(value)) continue
  }

  return result
}

/**
 * Resuelve el "value" de un token, que puede ser:
 *   - string         → token normal
 *   - { light, dark } → token por modo (se aplana con sufijo)
 */
function resolveValue(
  raw: unknown,
  prefix: string,
): ThemeVariable[] | null {
  if (raw === null || raw === undefined) return null

  // Valor directo
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return [{ name: `--${prefix}`, value: String(raw) }]
  }

  // Array → no podemos representarlo en CSS plano, omitimos
  if (Array.isArray(raw)) return null

  // Objeto → probablemente tokens por modo (light/dark/hover/etc.)
  if (typeof raw === 'object') {
    const modeObj = raw as Record<string, unknown>
    const entries = Object.entries(modeObj)

    // Si está vacío → omitir
    if (entries.length === 0) return null

    // Si es single-entry → usar directamente
    if (entries.length === 1) {
      const [, val] = entries[0]
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return [{ name: `--${prefix}`, value: String(val) }]
      }
      return null
    }

    // Múltiples modos → aplanar con sufijo: --color-surface-light, --color-surface-dark
    const resolved: ThemeVariable[] = []
    for (const [mode, val] of entries) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        resolved.push({
          name: `--${prefix}-${mode}`,
          value: String(val),
        })
      }
    }
    return resolved.length > 0 ? resolved : null
  }

  return null
}

// ──────────────────────────────────────────────
// Parseo CSS existente
// ──────────────────────────────────────────────

async function parseCss(filePath: string): Promise<ThemeVariable[]> {
  const raw = await readFile(filePath, 'utf-8')
  const variables: ThemeVariable[] = []

  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g
  let match

  while ((match = regex.exec(raw)) !== null) {
    variables.push({
      name: match[1].trim(),
      value: match[2].trim(),
    })
  }

  return variables
}
