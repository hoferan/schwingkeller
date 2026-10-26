// The two tabs of the accounts panel, and the ids that tie each tab to the view it shows.
export type PanelTab = 'accounts' | 'invitations';

export const PANEL_TABS: readonly PanelTab[] = ['accounts', 'invitations'];

export const tabId = (tab: PanelTab) => `accounts-panel-tab-${tab}`;

export const TAB_PANEL_ID = 'accounts-panel-view';
