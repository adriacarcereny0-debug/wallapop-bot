import type { z } from 'zod';
import type { AIResult } from './types';

/**
 * Contrato mínimo que debe cumplir un proveedor de IA.
 *
 * La aplicación **nunca** llama a un SDK concreto: siempre pasa por aquí. Cambiar
 * de proveedor es implementar esta interfaz y cambiar `AI_PROVIDER`. Ver
 * `docs/AI_PROVIDERS.md`.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Genera una respuesta estructurada validada contra `schema`.
   * El proveedor es responsable de reintentar o fallar; nunca devuelve datos
   * sin validar.
   */
  complete<T>(request: CompletionRequest<T>): Promise<AIResult<T>>;
}

export interface CompletionRequest<T> {
  /** Instrucciones de sistema: rol, reglas y límites. */
  system: string;
  /** Contenido concreto de la petición. */
  prompt: string;
  /** Esquema Zod que la salida debe cumplir. */
  schema: z.ZodType<T>;
  /** Nombre de la función de negocio, para trazas y control de coste. */
  fn: string;
  maxTokens?: number;
  /**
   * Profundidad de razonamiento. `low` basta para redactar y recorta el gasto;
   * súbelo sólo donde la calidad lo justifique. Los proveedores que no lo
   * admitan deben ignorarlo.
   */
  effort?: 'low' | 'medium' | 'high';
}
