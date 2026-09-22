import Link from 'next/link';
import { ListingGenerator } from '@/components/studio/listing-generator';
import { EmptyState, SectionHeader, Surface, buttonClass } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Estudio de IA' };

export default async function StudioPage() {
  const session = await getSession();
  if (!session) return null;

  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);

  return (
    <>
      <SectionHeader
        title="Estudio de IA"
        description="Introduce los datos del producto y la IA preparará el anuncio. Nada se usa sin que tú lo apruebes."
      />

      {accounts.length === 0 ? (
        <Surface>
          <EmptyState
            title="Primero añade una cuenta"
            description="El estudio genera anuncios para una cuenta concreta. Añade al menos una en la sección «Cuentas» y vuelve aquí."
            action={
              <Link href="/cuentas" className={buttonClass('primary')}>
                Ir a Cuentas
              </Link>
            }
          />
        </Surface>
      ) : (
        <ListingGenerator accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
      )}
    </>
  );
}
