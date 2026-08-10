# Spec: `--dry-run` para at-mos

## Objetivo

Permitir que `init` y `update` calculen y devuelvan el cambio que **harían** sin tocar el filesystem — ni el archivo destino ni el backup. Es el requisito de confianza mínimo para que un agente de IA (Claude Code, OpenCode, OpenClaw) use at-mos en modo headless sin supervisión humana directa: necesita poder evaluar el impacto de un comando antes de aplicarlo.

## No-goals

- No es un modo de "simulación completa del entorno" (no valida instalación de Tailwind, no corre build).
- No reemplaza el backup automático del modo real — son mecanismos complementarios (uno previene antes, el otro repara después).
- No aplica a comandos de solo lectura (`env`, `list`, `ai`) — ahí `--dry-run` no tiene efecto porque nunca escriben.

## Requisito de arquitectura (el más importante)

El dry-run **no puede ser una rama de código separada**. Debe usar exactamente la misma función de cálculo que el modo real, y la única diferencia debe ser si al final se ejecuta el paso de escritura a disco.

```ts
// core, sin I/O de filesystem de escritura
function computeChange(input: {
  tokens: ParsedTokens;
  targetPath: string;
  currentContent: string | null; // null si el archivo no existe
}): {
  diff: Diff;
  preview: string;   // CSS final completo
  warnings: Warning[];
};

// capa de comando
async function runInit(opts) {
  const result = computeChange(/* ... */);

  if (opts.dryRun) {
    return respond({ ok: true, dryRun: true, ...result });
  }

  await backupIfExists(opts.output);
  await writeFile(opts.output, result.preview);
  return respond({ ok: true, dryRun: false, ...result });
}
```

Si `computeChange` cambia, tanto el dry-run como el run real cambian juntos. Esto evita el peor escenario: que el dry-run diga una cosa y el write real haga otra.

## Flags

- `--dry-run` — activa el modo. Combinable con `--json` (headless) o sin él (output humano legible).
- No requiere `--yes` (dry-run nunca pide confirmación porque no escribe nada).
- Aplica a: `init`, `update` (cualquier variante: `--edit`, `--delete`, etc.)

## Shape del JSON (`--dry-run --json`)

```json
{
  "ok": true,
  "dryRun": true,
  "target": "src/app/globals.css",
  "exists": true,
  "diff": {
    "added": [
      { "name": "--color-accent", "value": "#f97316" }
    ],
    "changed": [
      { "name": "--color-primary", "from": "#7c3aed", "to": "#8b5cf6" }
    ],
    "removed": [
      { "name": "--color-legacy-gray", "value": "#999999" }
    ],
    "unchanged": 74
  },
  "preview": "@theme {\n  --color-primary: #8b5cf6;\n  ...\n}",
  "warnings": []
}
```

### Reglas de cada campo

- `exists`: `false` si `targetPath` no existe todavía. En ese caso `diff.added` cubre todos los tokens y `diff.changed`/`diff.removed` van vacíos.
- `diff.added` / `diff.changed` / `diff.removed`: arrays de objetos, nunca `null`. Vacíos si no aplica.
- `diff.unchanged`: número, no lista (evita payloads gigantes en design systems de cientos de tokens).
- `preview`: el CSS **completo** que resultaría (no solo el bloque `@theme` si el archivo tiene contenido fuera de él — ver warnings).
- `warnings`: array de objetos `{ code: string, message: string }`, nunca strings sueltos. Casos a cubrir como mínimo:
  - `NAME_COLLISION` — dos tokens de origen distinto sanitizan al mismo nombre CSS.
  - `PRESERVED_CONTENT` — el archivo destino tiene contenido fuera del bloque `@theme` que se va a preservar tal cual.
  - `TYPE_MISMATCH` — un token cambia de tipo aparente (ej. de color a string plano) respecto a la versión anterior.

## Error (cuando el dry-run mismo falla)

Mismo contrato que el resto de comandos, pero recomendamos migrar a error estructurado si aún no se ha hecho (ver nota al final):

```json
{ "ok": false, "error": { "code": "TOKEN_PARSE_FAILED", "message": "...", "hint": "..." } }
```

Si el proyecto todavía usa `{"ok":false,"error":"string"}`, el dry-run debe seguir esa misma convención por consistencia — no introducir un formato nuevo solo para este comando.

## Ejemplos de uso

```bash
# Archivo nuevo
at-mos init --from tokens.json --output src/app/globals.css --dry-run --json

# Update de un solo token
at-mos update --edit --name color-primary --value "#4f46e5" --dry-run --json

# Delete
at-mos update --delete --names color-spacing-xs --dry-run --json
```

## Flujo esperado de un agente

```bash
at-mos init --from tokens.json --output src/app/globals.css --dry-run --json
# el agente evalúa diff.removed.length y warnings antes de decidir
at-mos init --from tokens.json --output src/app/globals.css --yes --json
```

Ambos comandos son idénticos salvo el flag final — eso es intencional y debe mantenerse así.

## Checklist de implementación

- [ ] `computeChange` extraído como función pura, sin I/O de escritura, reusada por dry-run y run real.
- [ ] `init --dry-run` no crea backup ni escribe el archivo destino.
- [ ] `update --dry-run` (todas las variantes) no crea backup ni escribe.
- [ ] `exists: false` cuando el destino no existe.
- [ ] `diff.unchanged` es un número.
- [ ] `preview` incluye el archivo completo, no solo el `@theme`.
- [ ] Warnings cubren al menos: colisión de nombres, contenido preservado fuera de `@theme`, cambio de tipo de token.
- [ ] Salida humana (`--dry-run` sin `--json`) muestra el diff en formato legible (colores, +/-), no el JSON crudo.
- [ ] Tests: archivo nuevo, archivo existente con cambios, archivo existente sin cambios, archivo con contenido fuera de `@theme`.

## Nota aparte (no bloqueante para este spec)

Se recomendó por separado migrar el formato de error de `{"ok":false,"error":"string"}` a `{"ok":false,"error":{"code","message","hint"}}` en todos los comandos, para que un agente pueda hacer pattern-matching por código en vez de parsear texto. Es un cambio independiente de este spec, pero si se hace, el dry-run debe nacer ya con el formato estructurado en vez de heredar el viejo.
