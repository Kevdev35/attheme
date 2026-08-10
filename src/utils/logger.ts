import * as p from '@clack/prompts'
import { AtMosError, toErrorData } from './errors.js'

export const isTTY = process.stdin.isTTY === true

// En modo headless, stdout queda reservado para la salida de datos (JSON).
// Todo mensaje humano va a stderr para no contaminar el stream parseable.
const line = (msg: string) => console.error(msg)

export const logger = {
  info: (msg: string) => (isTTY ? p.log.info(msg) : line(msg)),
  success: (msg: string) => (isTTY ? p.log.success(msg) : line(msg)),
  warn: (msg: string) => (isTTY ? p.log.warn(msg) : line(msg)),
  error: (msg: string) => (isTTY ? p.log.error(msg) : console.error(msg)),
  step: (msg: string) => (isTTY ? p.log.step(msg) : line(msg)),
}

export function intro(msg: string): void {
  if (isTTY) p.intro(msg)
}

export function outro(msg: string): void {
  if (isTTY) p.outro(msg)
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data))
}

// Cuando el agente pidió explícitamente JSON, todo error debe ser JSON.
export const wantsJson = () => !isTTY || process.argv.includes('--json')

export function fail(error: AtMosError): never {
  if (wantsJson()) {
    outputJson({ ok: false, error: toErrorData(error) })
  } else {
    logger.error(`${error.code}: ${error.message}`)
    if (error.hint) logger.step(`Hint: ${error.hint}`)
  }
  process.exit(1)
}
