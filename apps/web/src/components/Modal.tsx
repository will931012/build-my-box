import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

/** Diálogo accesible (foco atrapado, Escape para cerrar) basado en Radix. */
export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-stone-900/40" />
        <Dialog.Content className="fixed inset-x-2 top-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:inset-x-4">
          <div className="flex items-start justify-between gap-2 border-b border-stone-200 px-4 py-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-sm text-stone-600">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Cerrar">
              ✕
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
