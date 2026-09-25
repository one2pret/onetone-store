import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddToCartButton } from '@/app/(shop)/products/[slug]/AddToCartButton';

const { addToCart } = vi.hoisted(() => ({ addToCart: vi.fn() }));

vi.mock('@/app/actions/cart', () => ({
  addToCart,
  ensureCartItem: vi.fn(),
}));

describe('AddToCartButton', () => {
  it('keeps a stable label element when browser translation changes its text', async () => {
    let completeAdd: ((value: { success: boolean }) => void) | undefined;
    addToCart.mockImplementation(() => new Promise(resolve => { completeAdd = resolve; }));

    render(<AddToCartButton productId={1} basePrice={70_000} variants={[]} initialStock={3} pricingNow="2026-09-25T00:00:00.000Z" />);
    const button = screen.getByRole('button', { name: /keranjang/i });
    const label = button.querySelector('span > span');
    expect(label).not.toBeNull();

    // Translation tools may replace a text node with a wrapper of their own.
    const translated = document.createElement('font');
    translated.textContent = 'Cart';
    label!.replaceChildren(translated);

    fireEvent.click(button);
    await waitFor(() => expect(label).toHaveTextContent('Menambahkan...'));

    await act(async () => { completeAdd?.({ success: true }); });
    await waitFor(() => expect(label).toHaveTextContent('Ditambahkan!'));
    expect(addToCart).toHaveBeenCalledWith(1, 1, undefined);
  });
});
