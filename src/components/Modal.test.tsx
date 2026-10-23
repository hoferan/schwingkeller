import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  // A long list on a phone needs the whole screen, edge to edge.
  it('fills the screen when asked to', () => {
    render(
      <Modal onClose={vi.fn()} header={<div>Title</div>} fullScreen>
        <p>Body</p>
      </Modal>,
    );
    const card = screen.getByText('Body').closest('.sk-scroll')?.parentElement;
    expect(card).toHaveStyle({ width: '100%', borderRadius: '0px' });
    expect(card?.parentElement).toHaveStyle({ padding: '0px' });
  });

  it('is a modal dialog named by its title', () => {
    render(
      <Modal onClose={vi.fn()} labelledBy="t">
        <h2 id="t">Konto löschen?</h2>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Konto löschen?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape, like a click on the backdrop', async () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose}><button>OK</button></Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the topmost dialog on Escape', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal onClose={outer}>
        <Modal onClose={inner}><button>OK</button></Modal>
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog and keeps a focused child where it is', () => {
    render(
      <Modal onClose={vi.fn()}>
        <button>A</button>
        <input aria-label="field" autoFocus />
      </Modal>,
    );
    expect(screen.getByLabelText('field')).toHaveFocus();
  });

  it('focuses the dialog itself when no child takes focus', () => {
    render(<Modal onClose={vi.fn()}><p>Body</p></Modal>);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    render(
      <>
        <button>behind</button>
        <Modal onClose={vi.fn()}>
          <button>first</button>
          <button>last</button>
        </Modal>
      </>,
    );
    screen.getByText('last').focus();
    await userEvent.tab();
    expect(screen.getByText('first')).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('gives focus back to what had it before it opened', async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <Modal onClose={() => setOpen(false)}><button>inside</button></Modal>}
        </>
      );
    };
    render(<Host />);
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('open')).toHaveFocus();
  });
});
