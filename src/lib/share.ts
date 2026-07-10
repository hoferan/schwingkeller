export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

export interface ShareVenueDeps {
  share?: (data: { title: string; url: string }) => Promise<void>;
  copy: (text: string) => Promise<void>;
}

// Shares `url` via the Web Share API when available, falling back to a
// clipboard copy. A user-cancelled share sheet resolves as 'cancelled'
// rather than throwing; any other failure (share or clipboard) rethrows for
// the caller to report.
export async function shareVenueUrl(title: string, url: string, deps: ShareVenueDeps): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share({ title, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }
  await deps.copy(url);
  return 'copied';
}
