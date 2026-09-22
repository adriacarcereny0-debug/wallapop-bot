import { describe, expect, it } from 'vitest';
import { AIService } from './service';
import { DemoAIProvider } from './providers/demo';

const service = new AIService(new DemoAIProvider());

const product = {
  name: 'iPhone 15 Pro 256 GB',
  brand: 'Apple',
  model: null,
  category: 'Móviles y telefonía',
  condition: 'Muy bueno',
  priceCents: 65_000,
  features: { Batería: '91 %', Accesorios: 'Caja + cable' },
  notes: null,
};

describe('generateListing', () => {
  it('marca como "provided" sólo lo que el vendedor ha facilitado', async () => {
    const { data } = await service.generateListing(product);

    expect(data.provenance.provided.join(' ')).toContain('91 %');
    // El color no se facilitó: no puede aparecer como dato aportado.
    expect(data.provenance.provided.join(' ')).not.toContain('Color');
  });

  it('no inventa características ausentes', async () => {
    const { data } = await service.generateListing(product);
    expect(Object.keys(data.features).sort()).toEqual(['Accesorios', 'Batería']);
  });

  it('señala la información que falta', async () => {
    const { data } = await service.generateListing(product);
    expect(data.provenance.missing.length).toBeGreaterThan(0);
  });
});

describe('negotiate', () => {
  const base = {
    listingTitle: 'iPhone 15 Pro',
    listedPriceCents: 65_000,
    targetPriceCents: 63_000,
    minPriceCents: 60_000,
  };

  it('marca una oferta por debajo del mínimo y no recomienda aceptarla', async () => {
    const { data } = await service.negotiate({ ...base, offerCents: 55_000 });

    expect(data.belowMinimum).toBe(true);
    expect(data.options.some((o) => o.action === 'accept')).toBe(false);
  });

  it('nunca propone una contraoferta por debajo del mínimo', async () => {
    const { data } = await service.negotiate({ ...base, offerCents: 40_000 });

    for (const option of data.options) {
      if (option.action === 'counter' && option.amountCents !== null) {
        expect(option.amountCents).toBeGreaterThanOrEqual(base.minPriceCents);
      }
    }
  });

  it('permite aceptar cuando la oferta respeta el mínimo', async () => {
    const { data } = await service.negotiate({ ...base, offerCents: 62_000 });

    expect(data.belowMinimum).toBe(false);
    expect(data.options.some((o) => o.action === 'accept')).toBe(true);
  });
});

describe('generateImagePrompt', () => {
  it('rechaza ediciones que ocultarían daños', async () => {
    const { data } = await service.generateImagePrompt({
      productName: 'iPhone 15 Pro',
      condition: 'Muy bueno',
      requestedEdit: 'Quita los arañazos de la pantalla',
    });

    expect(data.safe).toBe(false);
    expect(data.refusalReason).toBeTruthy();
    expect(data.prompt).toBe('');
  });

  it('rechaza añadir accesorios que no se incluyen', async () => {
    const { data } = await service.generateImagePrompt({
      productName: 'iPhone 15 Pro',
      condition: 'Muy bueno',
      requestedEdit: 'Añade un accesorio de regalo en la foto',
    });

    expect(data.safe).toBe(false);
  });

  it('acepta mejoras neutras y añade restricciones de veracidad', async () => {
    const { data } = await service.generateImagePrompt({
      productName: 'iPhone 15 Pro',
      condition: 'Muy bueno',
      requestedEdit: 'Fondo neutro y mejor iluminación',
    });

    expect(data.safe).toBe(true);
    expect(data.constraints.length).toBeGreaterThan(0);
  });
});

describe('analyzeConversation', () => {
  it('detecta la oferta económica del comprador', async () => {
    const { data } = await service.analyzeConversation({
      listingTitle: 'iPhone 15 Pro',
      priceCents: 65_000,
      lastMessage: 'Hola, ¿aceptas 300€?',
      history: [],
    });

    expect(data.detectedOfferCents).toBe(30_000);
    expect(data.intent).toBe('offer');
  });

  it('trata como consulta un mensaje sin oferta', async () => {
    const { data } = await service.analyzeConversation({
      listingTitle: 'iPhone 15 Pro',
      priceCents: 65_000,
      lastMessage: '¿Incluye la caja?',
      history: [],
    });

    expect(data.detectedOfferCents).toBeNull();
    expect(data.intent).toBe('question');
  });
});

describe('coste en modo demo', () => {
  it('no genera coste alguno', async () => {
    const { usage } = await service.generateListing(product);
    expect(usage.costCents).toBe(0);
  });
});
