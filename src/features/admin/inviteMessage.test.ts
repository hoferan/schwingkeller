import { describe, expect, it } from 'vitest';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { inviteMessage, mailtoHref } from './inviteMessage';

const L = 'https://example.ch/#invite=abc';
const paragraph = (lang: 'de' | 'fr' | 'it') =>
  STR[lang].inviteMailBody.replace('{node}', associationsFor(lang).nameOf('emmental'));

describe('inviteMessage', () => {
  it('writes the first language first, then the others in app order, and the link once at the end', () => {
    const { body } = inviteMessage('fr', 'emmental', L);
    expect(body).toBe(`${paragraph('fr')}\n\n${paragraph('de')}\n\n${paragraph('it')}\n\n${L}`);
    expect(body.split(L)).toHaveLength(2);
  });

  it('names the node in each paragraph in its own language', () => {
    const { body } = inviteMessage('de', 'emmental', L);
    for (const lang of ['de', 'fr', 'it'] as const) {
      expect(body).toContain(associationsFor(lang).nameOf('emmental'));
    }
  });

  it('joins the three subjects in the same order', () => {
    expect(inviteMessage('it', 'emmental', L).subject).toBe(
      'Invito · Einladung · Invitation — Schwingkeller',
    );
  });
});

describe('mailtoHref', () => {
  it('encodes spaces as %20 and line breaks as %0A, and survives & and ?', () => {
    expect(mailtoHref('a@b.ch', { subject: 'A B', body: 'x\ny & z?' })).toBe(
      'mailto:a%40b.ch?subject=A%20B&body=x%0Ay%20%26%20z%3F',
    );
  });
});
