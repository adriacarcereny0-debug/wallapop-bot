import { Notice, Pill, SectionHeader, Surface } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getEnv, isImageEnhancementConfigured, isWallapopConfigured } from '@/lib/config/env';

export const metadata = { title: 'Ajustes' };

/**
 * Ajustes: estado de la configuración, en modo lectura.
 *
 * Nunca se muestra el valor de una clave, sólo si está definida. La
 * configuración se cambia con variables de entorno, no desde la interfaz.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const env = getEnv();

  const rows: { label: string; value: string; tone: 'success' | 'info' | 'warning' }[] = [
    { label: 'Base de datos', value: 'Supabase (PostgreSQL)', tone: 'success' },
    { label: 'Modelo de IA principal', value: env.ANTHROPIC_MODEL, tone: 'success' },
    { label: 'Modelo de IA económico', value: env.ANTHROPIC_MODEL_FAST, tone: 'success' },
    {
      label: 'Mejora de imágenes',
      value: isImageEnhancementConfigured()
        ? `Activada (${env.IMAGE_PROVIDER})`
        : 'Sin configurar: se suben fotos, pero no se mejoran',
      tone: isImageEnhancementConfigured() ? 'success' : 'warning',
    },
    {
      label: 'Credenciales de Wallapop',
      value: isWallapopConfigured() ? 'Configuradas' : 'Pendientes de alta',
      tone: isWallapopConfigured() ? 'success' : 'warning',
    },
    {
      label: 'Tope diario de IA',
      value:
        env.AI_DAILY_BUDGET_CENTS === 0
          ? 'Sin límite'
          : `${(env.AI_DAILY_BUDGET_CENTS / 100).toFixed(2)} $ por usuario y día`,
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
              <div
                key={row.label}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
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
            <h2 className="text-sm font-semibold">Tu sesión</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Correo</dt>
                <dd className="truncate">{session.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nombre</dt>
                <dd className="truncate">{session.displayName}</dd>
              </div>
            </dl>
          </Surface>

          <Notice tone="warning" title="Sobre tus credenciales">
            Esta aplicación nunca te pedirá la contraseña de Wallapop y no la almacena en ningún
            sitio. Las cuentas se conectan por OAuth y los tokens resultantes se guardan cifrados
            con AES-256-GCM.
          </Notice>
        </div>
      </div>
    </>
  );
}
