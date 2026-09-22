import { Notice, Pill, SectionHeader, Surface } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';

export const metadata = { title: 'Ajustes' };

/**
 * Ajustes: estado de la configuración, en modo lectura.
 *
 * Nunca se muestra el valor de una clave, sólo si está definida. Cambiar la
 * configuración se hace con variables de entorno, no desde la interfaz.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const env = getEnv();

  const rows: { label: string; value: string; tone: 'success' | 'info' | 'warning' }[] = [
    {
      label: 'Modo de datos',
      value: env.DATA_MODE === 'demo' ? 'Demo (datos ficticios en memoria)' : 'Supabase',
      tone: env.DATA_MODE === 'demo' ? 'info' : 'success',
    },
    {
      label: 'Proveedor de IA',
      value: env.AI_PROVIDER === 'demo' ? 'Demo (local, coste cero)' : env.AI_PROVIDER,
      tone: env.AI_PROVIDER === 'demo' ? 'info' : 'success',
    },
    {
      label: 'Modelo de IA',
      value: env.AI_PROVIDER === 'demo' ? 'No aplica' : env.ANTHROPIC_MODEL,
      tone: 'info',
    },
    {
      label: 'Proveedor de imágenes',
      value: env.IMAGE_PROVIDER,
      tone: env.IMAGE_PROVIDER === 'demo' ? 'info' : 'success',
    },
    {
      label: 'Integración con Wallapop',
      value: env.WALLAPOP_INTEGRATION_ENABLED ? 'Activada' : 'Desactivada',
      tone: env.WALLAPOP_INTEGRATION_ENABLED ? 'success' : 'warning',
    },
    {
      label: 'Presupuesto diario de IA',
      value:
        env.AI_DAILY_BUDGET_CENTS === 0
          ? 'Sin límite'
          : `${(env.AI_DAILY_BUDGET_CENTS / 100).toFixed(2)} € por usuario y día`,
      tone: env.AI_DAILY_BUDGET_CENTS === 0 ? 'warning' : 'success',
    },
  ];

  return (
    <>
      <SectionHeader
        title="Ajustes"
        description="Configuración activa de esta instancia. Se define con variables de entorno, no desde aquí."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start [&>*]:min-w-0">
        <Surface className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Configuración
          </h2>
          <dl className="divide-y divide-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-sm">{row.label}</dt>
                <dd>
                  <Pill tone={row.tone}>{row.value}</Pill>
                </dd>
              </div>
            ))}
          </dl>
        </Surface>

        <div className="flex flex-col gap-4">
          <Surface className="p-5">
            <h2 className="text-sm font-semibold">Sesión</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Correo</dt>
                <dd className="truncate">{session.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Tipo</dt>
                <dd>{session.isDemo ? 'Demostración' : 'Autenticada'}</dd>
              </div>
            </dl>
          </Surface>

          <Notice tone="warning" title="Sobre tus credenciales">
            Esta aplicación nunca te pedirá la contraseña de Wallapop y no la almacena en ningún
            sitio. Las cuentas se conectan por OAuth, y los tokens resultantes se guardan
            cifrados.
          </Notice>
        </div>
      </div>
    </>
  );
}
