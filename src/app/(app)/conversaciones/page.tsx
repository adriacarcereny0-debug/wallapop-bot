import { Suspense } from 'react';
import { ReplyAssistant } from '@/components/conversations/reply-assistant';
import {
  EmptyState,
  Notice,
  Pill,
  SectionHeader,
  Surface,
  TableSkeleton,
} from '@/components/ui/primitives';
import { readAccountFilter } from '@/lib/account-filter';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatRelative } from '@/lib/format';
import { CONVERSATION_STATUS, PRIORITY } from '@/lib/labels';

export const metadata = { title: 'Conversaciones' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function ConversationsPage({ searchParams }: PageProps) {
  return (
    <>
      <SectionHeader
        title="Conversaciones"
        description="Wallapop no ofrece API de mensajería, así que esta sección funciona en modo asistente: la IA prepara la respuesta y tú la envías desde Wallapop."
      />

      <div className="mb-6">
        <Notice tone="warning" title="Modo asistente: el envío es manual">
          No existe ninguna vía autorizada para leer o enviar mensajes de Wallapop por programa.
          El único evento disponible («CHAT_LEAD_CREATED») avisa de que hay un chat, pero no
          entrega su contenido. La aplicación genera el borrador; copiarlo y enviarlo lo haces tú.
        </Notice>
      </div>

      <Suspense
        fallback={
          <Surface className="overflow-hidden">
            <TableSkeleton rows={4} />
          </Surface>
        }
      >
        <ConversationList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ConversationList({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);
  const filter = readAccountFilter(await searchParams, accounts.map((a) => a.id));

  const [conversations, listings, products] = await Promise.all([
    repo.listConversations(session.userId, filter),
    repo.listListings(session.userId, filter),
    repo.listProducts(session.userId),
  ]);

  if (conversations.length === 0) {
    return (
      <Surface>
        <EmptyState
          title="No hay conversaciones registradas"
          description="Registra aquí las conversaciones que recibas en Wallapop para que la IA pueda analizarlas y proponerte una respuesta."
        />
      </Surface>
    );
  }

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Cuenta';

  return (
    <div className="flex flex-col gap-4">
      {conversations.map((conversation) => {
        const listing = listings.find((l) => l.id === conversation.listingId);
        const product = listing ? products.find((p) => p.id === listing.productId) : undefined;
        const status = CONVERSATION_STATUS[conversation.status];
        const priority = PRIORITY[conversation.priority];
        const lastMessage = conversation.messages.at(-1);

        return (
          <Surface key={conversation.id} as="article" className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-medium">{conversation.buyerAlias}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {accountName(conversation.accountId)}
                  {listing && ` · ${listing.title}`}
                  {listing && ` · ${formatCurrency(listing.priceCents)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pill tone={priority.tone}>Prioridad {priority.label.toLowerCase()}</Pill>
                <Pill tone={status.tone}>{status.label}</Pill>
              </div>
            </div>

            <div className="px-5 py-4">
              <ol className="flex flex-col gap-3">
                {conversation.messages.map((message) => (
                  <li key={message.id} className="text-sm">
                    <p className="text-2xs font-semibold tracking-wide text-faint uppercase">
                      {message.role === 'buyer'
                        ? 'Comprador'
                        : message.role === 'seller'
                          ? 'Tú'
                          : 'Borrador de IA'}
                      {' · '}
                      <span className="font-normal normal-case">
                        {formatRelative(message.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 leading-relaxed">{message.body}</p>
                  </li>
                ))}
              </ol>

              {lastMessage && (
                <div className="mt-5 border-t border-line pt-4">
                  <ReplyAssistant
                    conversationId={conversation.id}
                    lastMessage={lastMessage.body}
                    listingTitle={listing?.title ?? 'Anuncio sin asignar'}
                    priceCents={listing?.priceCents ?? 0}
                    targetPriceCents={product?.targetPriceCents ?? null}
                    minPriceCents={product?.minPriceCents ?? null}
                    features={product?.features ?? {}}
                  />
                </div>
              )}
            </div>
          </Surface>
        );
      })}
    </div>
  );
}
