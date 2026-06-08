import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLocalDateString } from '../utils/scheduleUtils';

const GOLD = '#D4AF37';

export default function MiniCal({
  value,
  onChange,
  allSchedules = [],
  allAppointments = [],
  className = '',
  compact = false,
  showLegend = false,
}) {
  const [cursor, setCursor] = useState({ m: value.getMonth(), y: value.getFullYear() });

  useEffect(() => {
    setCursor({ m: value.getMonth(), y: value.getFullYear() });
  }, [value.getFullYear(), value.getMonth()]);

  const prev = () => setCursor(c => (c.m === 0 ? { m: 11, y: c.y - 1 } : { m: c.m - 1, y: c.y }));
  const next = () => setCursor(c => (c.m === 11 ? { m: 0, y: c.y + 1 } : { m: c.m + 1, y: c.y }));

  const today       = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(value);

  // Closed days (exclusive all-day block)
  const disabledSet = useMemo(
    () => new Set(allSchedules.filter(s => s.isDisabledDay).map(s => s.date)),
    [allSchedules]
  );

  // Count of events per day: active schedules + approved appointments
  const countMap = useMemo(() => {
    const map = {};
    for (const s of allSchedules) {
      if (!s.isDisabledDay && s.status !== 'COMPLETED') {
        map[s.date] = (map[s.date] || 0) + 1;
      }
    }
    for (const a of allAppointments) {
      if (a.status === 'APPROVED') {
        map[a.date] = (map[a.date] || 0) + 1;
      }
    }
    return map;
  }, [allSchedules, allAppointments]);

  const firstDay    = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ds = (d) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className={`select-none ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${compact ? 'mb-2.5' : 'mb-4'}`}>
        <button
          onClick={prev}
          className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ChevronLeft className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>

        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
          {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>

        <button
          onClick={next}
          className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ChevronRight className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      </div>

      {/* Day of week labels */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[8px] font-black text-zinc-300 uppercase tracking-wider pb-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className={`grid grid-cols-7 ${compact ? 'gap-y-0.5' : 'gap-y-1'}`}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;

          const dateStr    = ds(day);
          const isSel      = dateStr === selectedStr;
          const isToday    = dateStr === today;
          const isDisabled = disabledSet.has(dateStr);
          const count      = countMap[dateStr] || 0;

          return (
            <button
              key={dateStr}
              onClick={() => onChange(new Date(cursor.y, cursor.m, day))}
              style={
                isSel
                  ? { backgroundColor: GOLD, color: 'white' }
                  : isToday
                    ? { outline: `2px solid ${GOLD}`, outlineOffset: '-2px' }
                    : undefined
              }
              className={`relative w-full flex flex-col items-center justify-center font-semibold transition-all
                ${compact ? 'h-8 rounded-md text-xs' : 'h-9 rounded-md text-xs'}
                ${isSel
                  ? 'shadow-sm'
                  : isToday
                    ? 'text-zinc-900 font-black'
                    : isDisabled
                      ? 'text-rose-400 hover:bg-rose-50'
                      : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              {/* Day number */}
              <span className="leading-none text-[11px]">{day}</span>

              {/* Top-right notification badge */}
              {!isSel && isDisabled && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-400" />
              )}
              {!isSel && !isDisabled && count > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 min-w-[13px] h-[13px] rounded-full flex items-center justify-center px-[3px] text-[7px] font-black tabular-nums leading-none text-white"
                  style={{ backgroundColor: GOLD }}
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-100 flex-wrap">
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-bold">
            <span className="min-w-[13px] h-[13px] rounded-full flex items-center justify-center px-[3px] text-[7px] font-black text-white" style={{ backgroundColor: GOLD }}>3</span>
            Event count
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-bold">
            <span className="w-[13px] h-[13px] rounded-full bg-rose-400 inline-flex items-center justify-center opacity-80" />
            Closed
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-md inline-block" style={{ backgroundColor: GOLD }} />
            Selected
          </div>
        </div>
      )}
    </div>
  );
}
