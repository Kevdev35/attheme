import { createRequire } from 'module'
import { Command, CommanderError } from 'commander'
import { isTTY, outputJson, logger, wantsJson } from './utils/logger.js'
import { AtMosError, toErrorData } from './utils/errors.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

const program = new Command()

// Commander imprime sus errores a stderr antes de lanzarlos; los suprimimos
// para que pasen por handleError en un formato consistente (texto o JSON).
// Los subcomandos (.command) son instancias propias de Command y NO heredan
// configuración del padre, así que se la aplicamos a todos via createCommand
// ANTES de registrar los comandos de abajo.
const suppressErrors = () => ({ outputError: () => {} })
program.exitOverride()
program.configureOutput(suppressErrors())

const originalCreateCommand = program.createCommand.bind(program)
program.createCommand = (...args) => {
  const cmd = originalCreateCommand(...args)
  cmd.exitOverride()
  cmd.configureOutput(suppressErrors())
  return cmd
}

program
  .name('at-mos')
  .description('CLI para generar global.css con @theme para Tailwind v4')
  .version(version, '-v, --version', 'Muestra la versión de @t-mos')

program
  .command('init')
  .description('Genera tu global.css con @theme')
  .option('-o, --output <path>', 'Ruta personalizada del archivo CSS')
  .option('-f, --from <file>', 'Importar variables desde .json o .css')
  .option('-y, --yes', 'Modo no-interactivo (IAs / CI). Requiere --from')
  .option('--json', 'Salida JSON legible por máquinas')
  .option('--no-agent', 'No escribir instrucciones para agentes de IA en AGENTS.md')
  .action(async (options) => {
    const { init } = await import('./commands/init')
    await init(options)
  })

program
  .command('list')
  .description('Muestra las variables CSS definidas en tu @theme')
  .option('-o, --output <path>', 'Ruta personalizada del archivo CSS')
  .option('--json', 'Salida JSON legible por máquinas')
  .action(async (options) => {
    const { list } = await import('./commands/list')
    await list(options)
  })

program
  .command('update')
  .description('Agrega, modifica o elimina variables en tu @theme')
  .option('-o, --output <path>', 'Ruta personalizada del archivo CSS')
  .option('-y, --yes', 'Modo no-interactivo (IAs / CI)')
  .option('--json', 'Salida JSON legible por máquinas')
  .option('--add', 'Agregar variable (headless). Requiere --name y --value')
  .option('--edit', 'Modificar variable (headless). Requiere --name y --value')
  .option('--delete', 'Eliminar variable(s) (headless). Requiere --names')
  .option('--name <name>', 'Nombre de la variable (para --add / --edit)')
  .option('--names <name>', 'Nombre(s) a eliminar (repetible para --delete)', (value, prev: string[]) => [...prev, value], [])
  .option('--value <value>', 'Valor de la variable (para --add / --edit)')
  .action(async (options) => {
    const { update } = await import('./commands/update')
    await update(options)
  })

program
  .command('env')
  .description('Muestra el entorno detectado (package manager, framework, Tailwind)')
  .option('--json', 'Salida JSON legible por máquinas')
  .action(async (options) => {
    const { env } = await import('./commands/env')
    await env(options)
  })

program
  .command('ai')
  .description('Guía de uso para agentes de IA / modo headless')
  .option('--json', 'Contrato de comandos en JSON (legible por máquinas)')
  .action(async (options) => {
    const { ai } = await import('./commands/ai')
    await ai(options)
  })

program
  .command('agent')
  .description('Crea o actualiza AGENTS.md con instrucciones para agentes de IA')
  .option('--json', 'Salida JSON legible por máquinas')
  .option('-y, --yes', 'Modo no-interactivo')
  .option('--force', 'Reemplaza la sección existente entre marcadores (con backup)')
  .action(async (options) => {
    const { agent } = await import('./commands/agent')
    await agent(options)
  })

function mapCommanderCode(code?: string): string {
  switch (code) {
    case 'commander.unknownOption': return 'USAGE_UNKNOWN_OPTION'
    case 'commander.missingArgument':
    case 'commander.optionMissingArgument':
    case 'commander.requiredOptionMissing':
      return 'USAGE_MISSING_ARGUMENT'
    case 'commander.excessArguments':
      return 'USAGE_TOO_MANY_ARGUMENTS'
    default: return 'USAGE_INVALID_ARGUMENT'
  }
}

function handleError(err: unknown): never {
  // --help / --version: commander los reporta como error exitCode 0
  if (err instanceof CommanderError && err.exitCode === 0) {
    process.exit(0)
  }

  const asJson = wantsJson()

  if (err instanceof CommanderError) {
    const error = new AtMosError(
      mapCommanderCode(err.code),
      err.message.replace(/^error:\s*/, ''),
      'Corrige los flags del comando. Corre "at-mos <comando> --help" para ver las opciones.'
    )
    if (asJson) outputJson({ ok: false, error: toErrorData(error) })
    else {
      logger.error(`${error.code}: ${error.message}`)
      if (error.hint) logger.step(`Hint: ${error.hint}`)
    }
    process.exit(1)
  }

  if (err instanceof AtMosError) {
    if (asJson) outputJson({ ok: false, error: toErrorData(err) })
    else {
      logger.error(`${err.code}: ${err.message}`)
      if (err.hint) logger.step(`Hint: ${err.hint}`)
    }
    process.exit(1)
  }

  // Error inesperado → bug de la herramienta
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  const error = new AtMosError(
    'TOOL_INTERNAL',
    `Error interno de at-mos: ${message}`,
    'No reintentes el mismo comando. Reporta este bug incluyendo el comando completo y este detalle.'
  )

  if (asJson) {
    outputJson({ ok: false, error: { ...toErrorData(error), ...(stack ? { stack } : {}) } })
  } else {
    logger.error(`${error.code}: ${error.message}`)
    if (stack) logger.step(stack)
    if (error.hint) logger.step(`Hint: ${error.hint}`)
  }
  process.exit(1)
}

async function main() {
  try {
    await program.parseAsync()
  } catch (err) {
    handleError(err)
  }
}

if (!isTTY) {
  // En headless, un error no manejado (promesa) también debe ser JSON estructurado.
  process.on('unhandledRejection', (reason) => {
    handleError(reason instanceof Error ? reason : new Error(String(reason)))
  })
}

main()
