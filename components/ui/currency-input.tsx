// components/ui/currency-input.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  id?: string;
  name: string;
  defaultValue?: number | string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

function formatThousands(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  // Format with dot separator (Indonesian style)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function CurrencyInput({
  id,
  name,
  defaultValue,
  required,
  className,
  placeholder = '0',
}: CurrencyInputProps) {
  const rawDefault = defaultValue ? String(defaultValue) : '';
  const [display, setDisplay] = useState(() => formatThousands(rawDefault));
  const [rawValue, setRawValue] = useState(() => parseDigits(rawDefault));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep cursor position stable after formatting
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const cursorPos = input.selectionStart ?? 0;
    const prevLen = display.length;

    const digits = parseDigits(input.value);
    const formatted = formatThousands(digits);

    setDisplay(formatted);
    setRawValue(digits);

    // Adjust cursor position based on length difference (dots added/removed)
    requestAnimationFrame(() => {
      const diff = formatted.length - prevLen;
      const newPos = Math.max(0, cursorPos + diff);
      input.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <>
      {/* Hidden input sends raw number to FormData */}
      <input type="hidden" name={name} value={rawValue} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
      />
    </>
  );
}
