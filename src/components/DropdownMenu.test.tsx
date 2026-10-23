import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

const item = (label: string, tone: MenuItem['tone'] = 'default'): MenuItem => ({
  id: label.toLowerCase(),
  label,
  tone,
  onSelect: vi.fn(),
});

const renderMenu = () => {
  const a = item('A');
  const b = item('B');
  const c = item('C', 'danger');
  render(
    <div>
      <span>outside</span>
      <DropdownMenu
        label="Konto"
        button={<span>icon</span>}
        buttonStyle={{}}
        header={<div>me@example.ch</div>}
        sections={[[a, b], [c]]}
      />
    </div>,
  );
  return { a, b, c, trigger: screen.getByRole('button', { name: 'Konto' }) };
};

describe('DropdownMenu', () => {
  it('is closed until the button is pressed', () => {
    const { trigger } = renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('opens with the header, the items in order and a separator', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('me@example.ch')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['A', 'B', 'C']);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('describes the menu with its header, so screen readers announce it', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toHaveAccessibleDescription('me@example.ch');
  });

  it('focuses the first item and moves with the arrow keys, wrapping', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    const focused = () => document.activeElement?.textContent;
    expect(focused()).toBe('A');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(focused()).toBe('A');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused()).toBe('C');
    await userEvent.keyboard('{Home}');
    expect(focused()).toBe('A');
    await userEvent.keyboard('{End}');
    expect(focused()).toBe('C');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on Tab', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on a click outside', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles closed when the button is pressed again', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes and runs the action when an item is chosen', async () => {
    const { b, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'B' }));
    expect(b.onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs the focused item with Enter', async () => {
    const { a, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Enter}');
    expect(a.onSelect).toHaveBeenCalledTimes(1);
  });
});
