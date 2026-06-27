// components/shop/PaymentCountdown.tsx
'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  expiresAt: Date | string;
}

export function PaymentCountdown({ expiresAt }: Props) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const update = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('Waktu habis');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`flex items-center gap-2 text-sm font-mono ${
        expired ? 'text-red-500' : 'text-orange-600'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span>{timeLeft}</span>
    </div>
  );
}
