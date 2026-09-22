import { Surface } from '@/components/ui/primitives';

/**
 * Guía de conexión que ve el cliente dentro de la aplicación.
 *
 * Existe porque quien usa esto no es quien lo ha montado: el vendedor abre
 * «Cuentas» y necesita saber qué hacer sin llamar a nadie. El texto cambia
 * según haya o no credenciales de integrador, porque los pasos son distintos.
 */
export function ConnectGuide({ configured }: { configured: boolean }) {
  return (
    <Surface as="section" className="p-5">
      <h2 className="text-sm font-semibold">Cómo conectar una cuenta de Wallapop</h2>
      <p className="mt-1.5 max-w-[68ch] text-xs leading-relaxed text-muted">
        Cada cuenta se conecta una sola vez. La conexión usa el sistema de autorización oficial de
        Wallapop, igual que cuando entras en una web «con tu cuenta de Google».
      </p>

      <ol className="mt-5 flex flex-col gap-4">
        <Step
          n={1}
          title="Ten la cuenta creada en Wallapop"
          done={configured}
          alwaysManual
        >
          La cuenta debe existir ya en Wallapop y ser tuya. Esta aplicación{' '}
          <strong>no crea cuentas</strong>: hacerlo automáticamente incumpliría las condiciones de
          uso de Wallapop.
        </Step>

        <Step n={2} title="Añádela aquí con un nombre" done={configured} alwaysManual>
          Pulsa «Añadir cuenta» y ponle un nombre que reconozcas («Tienda principal», «Recambios»).
          Ese nombre es sólo para ti: no se envía a Wallapop.
        </Step>

        <Step n={3} title="Pulsa «Conectar con Wallapop»" done={configured}>
          Se abrirá la página de Wallapop para que inicies sesión{' '}
          <strong>con esa cuenta concreta</strong> y autorices el acceso. Al aceptar, vuelves aquí
          y la cuenta aparece como «Conectada».
        </Step>

        <Step n={4} title="Repite con cada cuenta" done={configured}>
          Puedes conectar todas las cuentas que gestiones. Cada una guarda su propia autorización y
          sus datos nunca se mezclan con los de las demás.
        </Step>
      </ol>

      <div className="mt-5 rounded-md border border-warning/35 bg-warning-soft px-4 py-3">
        <p className="text-xs font-semibold text-warning">Tres cosas que conviene saber</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
          <li>
            <strong>Nunca escribas aquí tu contraseña de Wallapop.</strong> La contraseña se
            introduce únicamente en la web de Wallapop. Esta aplicación no la pide, no la usa y no
            la guarda.
          </li>
          <li>
            Publicar y despublicar anuncios requiere una suscripción{' '}
            <strong>Wallapop Pro</strong> activa en esa cuenta.
          </li>
          <li>
            Wallapop <strong>no ofrece acceso al chat</strong>. Los mensajes de compradores se
            gestionan en modo asistente: la IA redacta la respuesta y tú la envías desde Wallapop.
          </li>
        </ul>
      </div>
    </Surface>
  );
}

function Step({
  n,
  title,
  children,
  done,
  alwaysManual,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  done: boolean;
  /** Pasos que dependen del usuario, no de la configuración del servidor. */
  alwaysManual?: boolean;
}) {
  const available = alwaysManual || done;

  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className={
          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-2xs font-bold ' +
          (available ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-faint')
        }
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className={'text-sm font-medium ' + (available ? '' : 'text-muted')}>{title}</p>
        <p className="mt-0.5 max-w-[68ch] text-xs leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
