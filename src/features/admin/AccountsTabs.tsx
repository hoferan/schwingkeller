import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { badgeStyle, pendingCountText, visuallyHidden } from './listStyles';
import { PANEL_TABS, PANEL_TITLE_ID, TAB_PANEL_ID, tabId, type PanelTab } from './panelTabs';
import { usePendingCount } from './useAccounts';
import { useInvitations } from './useInvitations';

const tabStyle = (selected: boolean): CSSProperties => ({
  border: 'none', borderBottom: '2px solid ' + (selected ? theme.color.accent : 'transparent'),
  background: 'transparent', color: selected ? theme.color.ink : theme.color.muted, fontWeight: 700,
  fontSize: '13.5px', padding: '0 2px', minHeight: '44px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
});

// Only for editors with accounts below them, so only they ask for the pending count. Moving the
// focus also selects the tab.
export const AccountsTabs = ({ tab, onSelect }: { tab: PanelTab; onSelect: (tab: PanelTab) => void }) => {
  const { t } = useTranslation();
  const { data: pending = 0 } = usePendingCount();
  const invitations = useInvitations();
  const refs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = PANEL_TABS.indexOf(tab);
    const moves: Record<string, PanelTab> = {
      ArrowRight: PANEL_TABS[(i + 1) % PANEL_TABS.length],
      ArrowLeft: PANEL_TABS[(i - 1 + PANEL_TABS.length) % PANEL_TABS.length],
      Home: PANEL_TABS[0],
      End: PANEL_TABS[PANEL_TABS.length - 1],
    };
    const next: PanelTab | undefined = moves[e.key];
    if (!next) return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };

  const label = (which: PanelTab) =>
    which === 'accounts' ? (
      <>
        {t.accountsTitle}
        {pending > 0 && (
          <>
            {' '}<span aria-hidden="true" style={badgeStyle}>{pending}</span>
            <span style={visuallyHidden}>{pendingCountText(t.accountsPendingCount, pending)}</span>
          </>
        )}
      </>
    ) : (
      <>
        {t.invitationsTitle}
        {invitations.data && (
          <>
            {' '}<span aria-hidden="true">·</span>{' '}{invitations.data.length}
          </>
        )}
      </>
    );

  return (
    <div role="tablist" aria-labelledby={PANEL_TITLE_ID} onKeyDown={onKeyDown} style={{ display: 'flex', gap: '18px', alignSelf: 'stretch' }}>
      {PANEL_TABS.map((which) => (
        <button
          key={which}
          ref={(el) => {
            refs.current[which] = el;
          }}
          type="button"
          role="tab"
          id={tabId(which)}
          aria-selected={which === tab}
          aria-controls={TAB_PANEL_ID}
          tabIndex={which === tab ? 0 : -1}
          onClick={() => onSelect(which)}
          style={tabStyle(which === tab)}
        >
          {label(which)}
        </button>
      ))}
    </div>
  );
};
