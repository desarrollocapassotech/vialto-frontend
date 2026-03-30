/**
 * Estilos compartidos para controles de Clerk en la barra lateral oscura.
 */
export const orgSwitcherSidebarAppearance = {
  elements: {
    rootBox: 'w-full',
    organizationSwitcherTrigger:
      'w-full justify-start rounded-md border border-white/15 bg-white/5 px-2.5 py-2 hover:bg-white/10 transition-colors',
    organizationSwitcherTriggerIcon: 'text-white/70',
    organizationPreviewTextContainer: 'text-left',
    organizationPreviewMainIdentifier: 'text-white text-sm font-medium',
    organizationPreviewSecondaryIdentifier: 'text-white/50 text-xs',
    organizationSwitcherPopoverCard: 'bg-vialto-graphite border border-white/10',
    organizationSwitcherPopoverActionButton: 'text-white/90',
    organizationSwitcherPopoverFooter: 'border-t border-white/10',
  },
} as const;

export const userButtonSidebarAppearance = {
  elements: {
    rootBox: 'w-full flex justify-start',
    userButtonTrigger:
      'w-full justify-start rounded-md border border-white/15 bg-white/5 px-2.5 py-2 hover:bg-white/10 transition-colors',
    userButtonAvatarBox: 'ring-2 ring-white/20',
    userButtonPopoverCard: 'bg-vialto-graphite border border-white/10',
    userButtonPopoverActionButton: 'text-white/90',
  },
} as const;
