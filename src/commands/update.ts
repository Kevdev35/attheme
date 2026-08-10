import * as p from '@clack/prompts'
import { detectEnv } from '../core/detector.js'
import { askOutputPath } from '../core/prompts.js'
import { readThemeSafe } from '../core/reader.js'
import { writeTheme } from '../core/writer.js'
import { logger, intro, outro, outputJson, fail, isTTY } from '../utils/logger.js'
import { AtMosError } from '../utils/errors.js'
import type { ThemeVariable } from '../core/writer.js'

interface UpdateOptions {
  output?: string
  yes?: boolean
  json?: boolean
  add?: boolean
  edit?: boolean
  delete?: boolean
  name?: string
  names?: string[]
  value?: string
}

type UpdateAction = 'add' | 'edit' | 'delete'

export async function update(options: UpdateOptions) {
  const headless = options.yes || options.json || !isTTY

  intro('at-mos — actualizar @theme')

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

  // leer variables actuales
  let variables: ThemeVariable[]
  try {
    variables = await readThemeSafe(cssPath)
  } catch (err) {
    if (err instanceof AtMosError) fail(err)
    throw err
  }

  // ── Modo no-interactivo (IAs / CI) ──
  if (headless) {
    let updated: ThemeVariable[]
    let action: UpdateAction

    if (options.add) {
      action = 'add'
      if (!options.name || !options.value) {
        fail(new AtMosError(
          'USAGE_MISSING_ARGUMENT',
          '--add requiere --name <nombre> y --value <valor>.',
          'Ej: at-mos update --add --name --color-x --value "#f00" --json'
        ))
      }
      if (variables.some(v => v.name === options.name)) {
        fail(new AtMosError(
          'INPUT_DUPLICATE_VARIABLE',
          `La variable ya existe: ${options.name}`,
          'Usa --edit para modificarla o elige otro nombre.'
        ))
      }
      updated = [...variables, { name: options.name!, value: options.value! }]
    } else if (options.edit) {
      action = 'edit'
      if (!options.name || !options.value) {
        fail(new AtMosError(
          'USAGE_MISSING_ARGUMENT',
          '--edit requiere --name <nombre> y --value <valor>.',
          'Ej: at-mos update --edit --name --color-primary --value "#4f46e5" --json'
        ))
      }
      if (!variables.some(v => v.name === options.name)) {
        fail(new AtMosError(
          'INPUT_VARIABLE_NOT_FOUND',
          `La variable no existe: ${options.name}`,
          'Corre "at-mos list --json" para ver las variables disponibles.'
        ))
      }
      updated = variables.map(v =>
        v.name === options.name ? { ...v, value: options.value! } : v
      )
    } else if (options.delete) {
      action = 'delete'
      const names = options.names ?? []
      if (names.length === 0) {
        fail(new AtMosError(
          'USAGE_MISSING_ARGUMENT',
          '--delete requiere --names <nombre> (repetible).',
          'Ej: at-mos update --delete --names --color-x --names --color-y --json'
        ))
      }
      updated = variables.filter(v => !names.includes(v.name))
    } else {
      fail(new AtMosError(
        'USAGE_MISSING_ACTION',
        'Modo no-interactivo requiere --add, --edit o --delete.',
        'Ej: at-mos update --edit --name --color-primary --value "#4f46e5" --json'
      ))
    }

    await writeTheme(cssPath, updated)

    if (options.json) {
      outputJson({ ok: true, command: 'update', action, output: cssPath, variables: updated.length })
    } else {
      logger.success(`@theme actualizado en ${cssPath} (${updated.length} variables)`)
    }
    return
  }

  // ── Modo interactivo ──
  if (variables.length > 0) {
    p.log.step('Variables actuales:')
    for (const { name, value } of variables) {
      p.log.info(`${name}: ${value}`)
    }
  }

  // elegir acción
  const action = await p.select<UpdateAction>({
    message: '¿Qué quieres hacer?',
    options: [
      { value: 'add',    label: 'Agregar una variable nueva' },
      { value: 'edit',   label: 'Modificar una variable existente', hint: variables.length === 0 ? 'no hay variables aún' : '' },
      { value: 'delete', label: 'Eliminar una variable',            hint: variables.length === 0 ? 'no hay variables aún' : '' },
    ]
  })

  if (p.isCancel(action)) process.exit(0)

  let updated: ThemeVariable[] = [...variables]

  if (action === 'add') {
    updated = await handleAdd(variables)
  } else if (action === 'edit') {
    if (variables.length === 0) {
      logger.warn('No hay variables para modificar.')
      outro('Sin cambios.')
      return
    }
    updated = await handleEdit(variables)
  } else if (action === 'delete') {
    if (variables.length === 0) {
      logger.warn('No hay variables para eliminar.')
      outro('Sin cambios.')
      return
    }
    updated = await handleDelete(variables)
  }

  // escribir cambios
  const spinner = p.spinner()
  spinner.start('Guardando cambios...')
  await writeTheme(cssPath, updated)
  spinner.stop('Listo')

  logger.success(`@theme actualizado en ${cssPath}`)
  outro('Cambios guardados.')
}

async function handleAdd(variables: ThemeVariable[]): Promise<ThemeVariable[]> {
  const name = await p.text({
    message: 'Nombre de la variable',
    placeholder: '--color-accent',
    validate: (val) => {
      if (!val) return 'El nombre no puede estar vacío'
      if (!val.startsWith('--')) return 'Debe empezar con --'
      if (variables.some(v => v.name === val)) return 'Esa variable ya existe, usa "Modificar"'
    }
  })

  if (p.isCancel(name)) process.exit(0)

  const value = await p.text({
    message: `Valor para ${name}`,
    placeholder: '#ff0000',
    validate: (val) => {
      if (!val) return 'El valor no puede estar vacío'
    }
  })

  if (p.isCancel(value)) process.exit(0)

  return [...variables, { name: name as string, value: value as string }]
}

async function handleEdit(variables: ThemeVariable[]): Promise<ThemeVariable[]> {
  const selected = await p.select({
    message: '¿Cuál variable quieres modificar?',
    options: variables.map(v => ({
      value: v.name,
      label: v.name,
      hint: v.value
    }))
  })

  if (p.isCancel(selected)) process.exit(0)

  const current = variables.find(v => v.name === selected)!

  const newValue = await p.text({
    message: `Nuevo valor para ${selected}`,
    placeholder: current.value,
    validate: (val) => {
      if (!val) return 'El valor no puede estar vacío'
    }
  })

  if (p.isCancel(newValue)) process.exit(0)

  return variables.map(v =>
    v.name === selected ? { ...v, value: newValue as string } : v
  )
}

async function handleDelete(variables: ThemeVariable[]): Promise<ThemeVariable[]> {
  const selected = await p.multiselect({
    message: '¿Cuáles variables quieres eliminar?',
    options: variables.map(v => ({
      value: v.name,
      label: v.name,
      hint: v.value
    })),
    required: true
  })

  if (p.isCancel(selected)) process.exit(0)

  const toDelete = selected as string[]

  const confirmed = await p.confirm({
    message: `¿Eliminar ${toDelete.length} variable(s)? Esta acción no se puede deshacer.`,
    initialValue: false
  })

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn('Operación cancelada.')
    return variables
  }

  return variables.filter(v => !toDelete.includes(v.name))
}
