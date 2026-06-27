// components/shop/TrackingTimeline.tsx
import { formatDate } from '@/lib/utils';
import { Circle, CheckCircle2, Truck } from 'lucide-react';

interface TrackingEvent {
  id: number;
  status: string;
  note: string | null;
  updatedAt: Date | null;
}

interface Props {
  histories: TrackingEvent[];
  currentStatus: string;
}

const STATUS_ICONS: Record<string, typeof Circle> = {
  delivered: CheckCircle2,
};

export function TrackingTimeline({ histories, currentStatus }: Props) {
  if (histories.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">Belum ada update pengiriman.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />

      <div className="space-y-4">
        {histories.map((event, i) => {
          const isLatest = i === 0;
          const Icon = STATUS_ICONS[event.status] || Circle;

          return (
            <div key={event.id} className="relative flex items-start gap-3">
              <div
                className={`absolute -left-6 mt-0.5 ${
                  isLatest ? 'text-primary' : 'text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isLatest ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {event.status}
                </p>
                {event.note && (
                  <p className="text-xs text-slate-400 mt-0.5">{event.note}</p>
                )}
                {event.updatedAt && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(event.updatedAt)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
