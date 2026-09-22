import { ListingGenerator } from '@/components/studio/listing-generator';
import { Notice, SectionHeader } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Estudio de IA' };

export default async function StudioPage() {
  const session = await getSession();
  if (!session) return null;

  const env = getEnv();
  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);

  return (
    <>
      <SectionHeader
        title="Estudio de IA"
        description="Introduce los datos del producto y la IA preparará el anuncio. Nada se usa sin que tú lo apruebes."
      />

      {env.AI_PROVIDER === 'demo' && (
        <div className="mb-6">
          <Notice tone="info" title="Proveedor de IA en modo demostración">
            Las respuestas se generan localmente, sin coste y de forma determinista. Configura{' '}
            <code className="font-mono">AI_PROVIDER</code> y la clave correspondiente para usar un
            modelo real.
          </Notice>
        </div>
      )}

      <ListingGenerator accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </>
  );
}
