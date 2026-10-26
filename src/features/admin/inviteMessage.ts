import { LANGS, STR, type Lang } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';

export type InviteMessage = { subject: string; body: string };

// One paragraph per language, the inviter's own first, and the link once at the end.
export const inviteMessage = (first: Lang, scope: string, link: string): InviteMessage => {
  const langs = [first, ...LANGS.filter((lang) => lang !== first)];
  const paragraphs = langs.map((lang) =>
    STR[lang].inviteMailBody.replace('{node}', associationsFor(lang).nameOf(scope)),
  );
  const subjects = langs.map((lang) => STR[lang].inviteMailSubject);
  return {
    subject: `${subjects.join(' · ')} — Schwingkeller`,
    body: `${paragraphs.join('\n\n')}\n\n${link}`,
  };
};

// encodeURIComponent, not URLSearchParams: that writes spaces as "+", which mail programs show as is.
export const mailtoHref = (to: string, { subject, body }: InviteMessage): string =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
