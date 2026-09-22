/**
 * Estado compartido de los formularios con server action.
 *
 * Vive fuera de los ficheros `'use server'` porque esos sólo pueden exportar
 * funciones asíncronas: una constante exportada desde ahí rompe la compilación.
 */
export interface FormState {
  error: string | null;
  success: string | null;
}

export const EMPTY_FORM_STATE: FormState = { error: null, success: null };

/** Mensaje de error legible, sin filtrar trazas internas al navegador. */
export function toFormError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Se ha producido un error inesperado.';
}
