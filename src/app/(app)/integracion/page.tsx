import { Notice, Pill, SectionHeader, Surface } from '@/components/ui/primitives';
import { isWallapopConfigured } from '@/lib/config/env';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  type Capability,
  type CapabilityLevel,
} from '@/lib/wallapop/capabilities';
import type { Tone } from '@/components/ui/primitives';

export const metadata = { title: 'Integración' };

const LEVEL_TONE: Record<CapabilityLevel, Tone> = {
  official: 'success',
  official_requires_pro: 'info',
  assisted_only: 'warning',
  not_permitted: 'danger',
};

const GROUPS: { level: CapabilityLevel; title: string; intro: string }[] = [
  {
    level: 'official',
    title: 'Automatizable con la API oficial',
    intro: 'Operaciones cubiertas por la Wallapop Connect API.',
  },
  {
    level: 'official_requires_pro',
    title: 'Automatizable, pero requiere Wallapop Pro',
    intro: 'Hay endpoint oficial, aunque tu suscripción debe incluirlo.',
  },
  {
    level: 'assisted_only',
    title: 'Sólo asistido: la ejecución es manual',
    intro:
      'Wallapop no publica API para estas operaciones. La aplicación prepara el trabajo, pero lo ejecutas tú.',
  },
  {
    level: 'not_permitted',
    title: 'No implementado por política',
    intro: 'Técnicas que incumplirían las condiciones de Wallapop. No hay código para ellas.',
  },
];

export default function IntegrationPage() {
  const configured = isWallapopConfigured();

  return (
    <>
      <SectionHeader
        title="Integración con Wallapop"
        description="Qué puede automatizar esta aplicación, qué queda en modo asistido y por qué."
      />

      <div className="mb-6 flex flex-col gap-3">
        <Notice
          tone={configured ? 'success' : 'info'}
          title={
            configured
              ? 'Credenciales configuradas'
              : 'Pendiente del alta de integrador'
          }
        >
          {configured
            ? 'La aplicación puede operar contra la Wallapop Connect API con las cuentas conectadas.'
            : 'Ninguna operación sale hacia Wallapop. Hacen falta credenciales de aplicación integradora, que Wallapop concede a vendedores profesionales tras solicitar el alta.'}
        </Notice>

        <Notice tone="warning" title="Verifica antes de conectar cuentas reales">
          La documentación de esta integración se elaboró a partir de las especificaciones OpenAPI
          públicas de Wallapop, no del portal oficial en vivo. Contrasta cada endpoint con
          developers.wallapop.com antes de operar en producción. Wallapop no ofrece entorno de
          pruebas: cualquier llamada real afecta a tu cuenta.
        </Notice>
      </div>

      <div className="flex flex-col gap-8">
        {GROUPS.map((group) => {
          const items = CAPABILITIES.filter((c) => c.level === group.level);
          if (items.length === 0) return null;

          return (
            <section key={group.level}>
              <h2 className="text-base font-semibold">{group.title}</h2>
              <p className="mt-1 max-w-[68ch] text-sm text-muted">{group.intro}</p>

              <div className="mt-4 flex flex-col gap-3">
                {items.map((capability) => (
                  <CapabilityCard key={capability.id} capability={capability} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <Surface as="article" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-medium">{capability.request}</h3>
        <Pill tone={LEVEL_TONE[capability.level]}>{CAPABILITY_LABELS[capability.level]}</Pill>
      </div>

      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted">
        {capability.explanation}
      </p>

      {capability.endpoint && (
        <p className="mt-2.5 font-mono text-2xs break-all text-faint">{capability.endpoint}</p>
      )}

      {capability.alternative && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
            Qué hace la aplicación en su lugar
          </p>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed">{capability.alternative}</p>
        </div>
      )}
    </Surface>
  );
}
