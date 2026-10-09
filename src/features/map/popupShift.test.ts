import { describe, it, expect } from 'vitest';
import { popupShift, type Box } from './popupShift';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

// A desktop map beside the sidebar, and a phone map under the topbar.
const DESKTOP = box(344, 60, 1024, 768);
const PHONE = box(0, 60, 375, 700);

describe('popupShift', () => {
  it('leaves a popup alone when no control covers it', () => {
    expect(popupShift(box(500, 300, 724, 483), [box(880, 72, 1012, 250)], DESKTOP)).toBeNull();
  });

  it('moves a popup left of the controls in the top right when that is the shorter way', () => {
    // Measured in the browser: the Säntis popup at the country view, under the base switch and legend.
    expect(popupShift(box(787, 65, 1011, 248), [box(880, 72, 1012, 250)], DESKTOP)).toEqual({ dx: -139, dy: 0 });
  });

  it('moves a popup down below a control when that is the shorter way', () => {
    expect(popupShift(box(760, 65, 984, 248), [box(880, 72, 1012, 100)], DESKTOP)).toEqual({ dx: 0, dy: 43 });
  });

  it('moves a popup right of the zoom buttons on the left', () => {
    expect(popupShift(box(350, 80, 574, 263), [box(354, 70, 388, 220)], DESKTOP)).toEqual({ dx: 46, dy: 0 });
  });

  it('moves down instead when moving sideways would push the popup off the map', () => {
    expect(popupShift(box(100, 70, 324, 253), [box(200, 72, 363, 150)], PHONE)).toEqual({ dx: 0, dy: 88 });
  });

  it('moves down instead when moving sideways would run into another control', () => {
    const zoomButtons = box(10, 70, 44, 220);
    const switchAndLegend = box(255, 72, 363, 150);
    expect(popupShift(box(120, 70, 344, 253), [zoomButtons, switchAndLegend], PHONE)).toEqual({ dx: 0, dy: 88 });
  });

  it('pulls a popup that sticks out at the top back into the map', () => {
    expect(popupShift(box(500, 30, 724, 213), [], DESKTOP)).toEqual({ dx: 0, dy: 35 });
  });

  it('pulls a popup that sticks out on the right back into the map', () => {
    expect(popupShift(box(900, 300, 1124, 483), [], DESKTOP)).toEqual({ dx: -105, dy: 0 });
  });

  it('pulls a popup that sticks out on the left back into the map', () => {
    expect(popupShift(box(300, 300, 524, 483), [], DESKTOP)).toEqual({ dx: 49, dy: 0 });
  });

  it('pulls a popup that sticks out at the bottom back into the map', () => {
    expect(popupShift(box(500, 700, 724, 883), [], DESKTOP)).toEqual({ dx: 0, dy: -120 });
  });

  it('keeps the left edge in view when a popup is wider than the map', () => {
    expect(popupShift(box(-20, 100, 400, 283), [], PHONE)).toEqual({ dx: 25, dy: 0 });
  });

  it('moves down when controls cover the popup from both sides', () => {
    const zoomButtons = box(10, 70, 44, 220);
    const switchAndLegend = box(255, 72, 363, 150);
    expect(popupShift(box(20, 70, 360, 253), [zoomButtons, switchAndLegend], PHONE)).toEqual({ dx: 0, dy: 158 });
  });

  it('pulls a popup into the map first and then clear of the controls', () => {
    expect(popupShift(box(787, 39, 1011, 222), [box(880, 72, 1012, 250)], DESKTOP)).toEqual({ dx: -139, dy: 26 });
  });

  it('gives up when no move keeps the popup and its pin on the map', () => {
    expect(popupShift(box(100, 10, 324, 193), [box(200, 0, 375, 200)], box(0, 0, 375, 300))).toBeNull();
  });
});
