import { Surface } from '@/components/ui/primitives';
import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-md bg-accent text-xs font-bold text-on-accent"
          >
            WA
          </span>
          <span className="font-semibold tracking-tight">Wallapop Assistant</span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Entrar en el panel</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Herramienta privada de gestión. El acceso está restringido a las cuentas autorizadas.
        </p>

        <Surface className="mt-6 p-5">
          <LoginForm />

          <p className="mt-5 border-t border-line pt-4 text-2xs leading-relaxed text-faint">
            Esta aplicación nunca te pedirá tu contraseña de Wallapop y no la almacena en ningún
            sitio. Las cuentas de Wallapop se conectan por autorización OAuth desde la sección
            «Cuentas».
          </p>
        </Surface>
      </div>
    </main>
  );
}
