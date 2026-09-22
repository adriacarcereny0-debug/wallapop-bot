import Link from 'next/link';
import { SectionHeader } from '@/components/ui/primitives';
import { ProductForm } from './product-form';

export const metadata = { title: 'Nuevo producto' };

export default function NewProductPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/productos" className="text-xs text-muted hover:text-ink">
          ← Volver al catálogo
        </Link>
      </div>

      <SectionHeader
        title="Nuevo producto"
        description="Rellena lo que sepas. Lo que dejes en blanco, la IA lo señalará como información que falta en lugar de inventarlo."
      />

      <div className="max-w-3xl">
        <ProductForm />
      </div>
    </>
  );
}
