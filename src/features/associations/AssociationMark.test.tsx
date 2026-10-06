import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR, type Lang } from '../../i18n/translations';
import { AssociationMark, RegionalBadge } from './AssociationMark';

const inLang = (lang: Lang, children: ReactNode) => (
  <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>{children}</I18nContext.Provider>
);

describe('AssociationMark', () => {
  it("draws a dot in the Teilverband's tint", () => {
    const { container } = render(<AssociationMark id="emmental" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveStyle({ backgroundColor: 'rgb(155, 44, 31)', width: '10px', height: '10px', borderRadius: '50%' });
  });

  it('takes a size', () => {
    const { container } = render(<AssociationMark id="freiburg" size={14} />);
    expect(container.firstElementChild).toHaveStyle({ width: '14px', height: '14px', backgroundColor: 'rgb(138, 90, 18)' });
  });

  it('draws nothing without a tint', () => {
    ['esv', null, 'nowhere'].forEach((id) => {
      const { container, unmount } = render(<AssociationMark id={id} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    });
  });
});

describe('RegionalBadge', () => {
  it('shows the abbreviation in the current language and follows a switch', () => {
    const { rerender } = render(inLang('de', <RegionalBadge id="swsv" />));
    const badge = screen.getByText('SWSV');
    expect(badge).toHaveStyle({ backgroundColor: 'rgb(138, 90, 18)', color: 'rgb(255, 255, 255)' });
    rerender(inLang('fr', <RegionalBadge id="swsv" />));
    expect(screen.getByText('ARLS')).toBeInTheDocument();
    expect(screen.queryByText('SWSV')).toBeNull();
  });
});
