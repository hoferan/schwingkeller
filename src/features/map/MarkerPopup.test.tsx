import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { MarkerPopup } from './MarkerPopup';

const venue: Venue = {
  id: '1',
  name: 'Emmental',
  canton: 'BE',
  address: '3550 Langnau',
  lat: 46.9,
  lng: 7.7,
  indoor: true,
  outdoor: false,
  person: '',
  phone: '',
  website: '',
  photo_url: null,
};

describe('MarkerPopup', () => {
  it('renders the venue name, address, and indoor/outdoor tags', () => {
    render(<MarkerPopup venue={venue} t={STR.de} onDetail={vi.fn()} />);
    expect(screen.getByText('Emmental')).toBeInTheDocument();
    expect(screen.getByText('3550 Langnau')).toBeInTheDocument();
    expect(screen.getByText(STR.de.indoor)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.outdoor)).not.toBeInTheDocument();
  });

  it('calls onDetail when the details button is clicked', () => {
    const onDetail = vi.fn();
    render(<MarkerPopup venue={venue} t={STR.de} onDetail={onDetail} />);
    fireEvent.click(screen.getByRole('button', { name: STR.de.details }));
    expect(onDetail).toHaveBeenCalledTimes(1);
  });
});
