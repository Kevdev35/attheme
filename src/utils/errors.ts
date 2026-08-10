export type ErrorCategory = 'caller' | 'environment' | 'tool'

export interface AtMosErrorData {
  code: string
  message: string
  hint?: string
  category: ErrorCategory
}

export class AtMosError extends Error {
  readonly code: string
  readonly hint?: string
  readonly category: ErrorCategory

  constructor(code: string, message: string, hint?: string) {
    super(message)
    this.name = 'AtMosError'
    this.code = code
    this.hint = hint
    this.category = categoryOf(code)
  }
}

export function categoryOf(code: string): ErrorCategory {
  if (code.startsWith('USAGE_') || code.startsWith('INPUT_')) return 'caller'
  if (code.startsWith('ENV_')) return 'environment'
  return 'tool'
}

export function toErrorData(err: AtMosError): AtMosErrorData {
  return {
    code: err.code,
    message: err.message,
    ...(err.hint ? { hint: err.hint } : {}),
    category: err.category,
  }
}
