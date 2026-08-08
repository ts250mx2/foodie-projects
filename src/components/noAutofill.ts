/**
 * Atributos que apagan el autocompletado del navegador en un campo de texto.
 *
 * Sin esto el navegador ofrece un menú con lo que se escribió antes en ese
 * campo. En una tablet compartida de cocina eso además filtra los nombres de
 * quienes capturaron antes.
 *
 * Por qué son varios y no solo `autocomplete="off"`:
 *  - Chrome IGNORA `off` en campos que su heurística reconoce como parte de un
 *    perfil (nombre, teléfono, dirección). Un campo etiquetado "¿Quién pide?"
 *    cae justo ahí, por eso también se le da un `name` sin significado.
 *  - `data-lpignore` / `data-1p-ignore` / `data-form-type` frenan las burbujas
 *    de LastPass, 1Password y Dashlane, que son gestores, no el navegador.
 *  - `spellCheck` y `autoCorrect` quitan el subrayado y la autocorrección, que
 *    en móvil estorban al capturar códigos y nombres de insumos.
 *
 * Lo que NO se puede apagar desde la web: la tira de sugerencias del teclado
 * (Gboard, teclado de iOS). Eso se controla en los ajustes del dispositivo.
 */
export const NO_AUTOFILL = {
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    'data-lpignore': 'true',
    'data-1p-ignore': '',
    'data-form-type': 'other',
} as const;
