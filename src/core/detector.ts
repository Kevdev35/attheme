import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { readdirSync } from 'fs'
import { join } from 'path'
import { AtMosError } from '../utils/errors.js'

export type PackageManager = 'npm' | 'pnpm' | 'bun' | 'yarn'
export type Framework = 'nextjs' | 'sveltekit' | 'astro' | 'vue' | 'unknown'
export type TailwindVersion = '4' | '3' | 'not-installed'

export interface DetectedEnv {
  packageManager: PackageManager
  framework: Framework
  tailwindVersion: TailwindVersion
  cssCandidate: string | null
}

export async function detectEnv(): Promise<DetectedEnv> {
  const packageManager = detectPackageManager()
  const framework = await detectFramework()
  const tailwindVersion = await detectTailwind()
  const cssCandidate = detectCssCandidate(framework)

  return { packageManager, framework, tailwindVersion, cssCandidate }
}

function detectPackageManager(): PackageManager {
  if (existsSync('pnpm-lock.yaml')) return 'pnpm'
  if (existsSync('bun.lockb')) return 'bun'
  if (existsSync('yarn.lock')) return 'yarn'
  return 'npm'
}

async function readPackageJson(): Promise<Record<string, unknown>> {
  if (!existsSync('package.json')) return {}
  try {
    return JSON.parse(await readFile('package.json', 'utf-8'))
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new AtMosError(
        'ENV_PACKAGE_JSON_INVALID',
        'package.json no es JSON válido.',
        'Revisa la sintaxis de package.json antes de continuar.'
      )
    }
    throw err
  }
}

async function detectFramework(): Promise<Framework> {
  const pkg = await readPackageJson()
  if (Object.keys(pkg).length === 0) return 'unknown'

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {})
  }

  if (deps['next']) return 'nextjs'
  if (deps['@sveltejs/kit']) return 'sveltekit'
  if (deps['astro']) return 'astro'
  if (deps['vue']) return 'vue'
  return 'unknown'
}

async function detectTailwind(): Promise<TailwindVersion> {
  const pkg = await readPackageJson()
  if (Object.keys(pkg).length === 0) return 'not-installed'

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {})
  }

  const version: string | undefined = deps['tailwindcss'] as string | undefined
  if (!version) return 'not-installed'
  if (version.startsWith('4') || version.startsWith('^4')) return '4'
  return '3'
}

function detectCssCandidate(framework: Framework): string | null {
  const candidates: Record<Framework, string[]> = {
    nextjs: ['src/app/globals.css', 'app/globals.css'],
    sveltekit: ['src/app.css', 'src/styles/app.css'],
    astro: ['src/styles/global.css', 'src/global.css'],
    vue: ['src/assets/main.css', 'src/style.css'],
    unknown: [
      'src/styles/global.css',
      'src/global.css',
      'global.css',
      'src/app.css',
      'src/index.css',
      'src/style.css',
      'src/styles/main.css',
    ]
  }

  for (const candidate of candidates[framework]) {
    if (existsSync(candidate)) return candidate
  }

  // Si no encontró nada, escanea src/ buscando cualquier .css
  return scanForCss('src')
}

function scanForCss(dir: string): string | null {
  if (!existsSync(dir)) return null

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.css')) return fullPath
    if (entry.isDirectory()) {
      const found = scanForCss(fullPath)
      if (found) return found
    }
  }

  return null
}