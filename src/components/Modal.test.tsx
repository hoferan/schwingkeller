import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('scrolls the whole card when it has no header or footer', () => {
    render(<Modal onClose={vi.fn()}><p>Body</p></Modal>);
    const scroller = screen.getByText('Body').closest('.sk-scroll');
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveStyle({ overflow: 'auto' });
  });

  it('keeps the header and the footer out of the scrolling area', () => {
    render(
      <Modal onClose={vi.fn()} header={<div>Title</div>} footer={<div>Buttons</div>}>
        <p>Body</p>
      </Modal>,
    );
    const scroller = screen.getByText('Body').closest('.sk-scroll');
    expect(scroller).toHaveStyle({ overflowY: 'auto' });
    expect(scroller).not.toContainElement(screen.getByText('Title'));
    expect(scroller).not.toContainElement(screen.getByText('Buttons'));
    // The card itself doesn't scroll, so its scrollbar can't run past the header and footer.
    expect(scroller?.parentElement).toHaveStyle({ overflow: 'hidden' });
  });
});
