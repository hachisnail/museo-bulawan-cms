import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLocalDateString } from '../utils/scheduleUtils';

export default function MiniCal({
  value,
  onChange,
  allSchedules = [],
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

  const today = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(value);

  const disabledSet = useMemo(
    () => new Set(allSchedules.filter(s => s.isDisabledDay).map(s => s.date)),
    [allSchedules]
  );

  const markedSet = useMemo(
    () => new Set(allSchedules.filter(s => !s.isDisabledDay && s.status !== 'COMPLETED').map(s => s.date)),
    [allSchedules]
  );

  const firstDay = new Date(cursor.y, cursor.m, 1).getDay();
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
      <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
        <button
          onClick={prev}
          className={`rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors ${compact ? 'p-1' : 'p-1.5 rounded-lg'}`}
        >
          <ChevronLeft className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>

        <span className={`${compact ? 'text-[10px] text-zinc-600' : 'text-[11px] text-zinc-700'} font-bold uppercase tracking-[0.2em]`}>
          {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>

        <button
          onClick={next}
          className={`rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors ${compact ? 'p-1' : 'p-1.5 rounded-lg'}`}
        >
          <ChevronRight className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      </div>

      <div className={`grid grid-cols-7 ${compact ? 'gap-y-0.5' : 'gap-y-1'}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className={`text-center font-bold text-zinc-300 ${compact ? 'text-[9px] pb-1.5' : 'text-[9px] pb-1'}`}>
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;

          const dateStr = ds(day);
          const isSel = dateStr === selectedStr;
          const isToday = dateStr === today;
          const isDisabled = disabledSet.has(dateStr);
          const hasEvent = markedSet.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onChange(new Date(cursor.y, cursor.m, day))}
              style={{ color: 'inherit' }}
              className={`relative w-full flex flex-col items-center justify-center font-medium transition-all
                ${compact ? 'h-7 rounded text-xs' : 'h-8 rounded-lg text-xs'}
                ${isSel
                  ? 'bg-[#D4AF37] !text-zinc-900 font-bold shadow-sm'
                  : isToday
                    ? 'bg-zinc-900 !text-white font-bold'
                    : isDisabled
                      ? '!text-rose-500 hover:bg-rose-50'
                      : '!text-zinc-800 hover:bg-zinc-100'}`}
            >
              <span className="leading-none">{day}</span>
              {(hasEvent || isDisabled) && !isSel && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDisabled ? 'bg-rose-500' : 'bg-[#D4AF37]'}`} />
              )}
            </button>
          );
        })}
      </div>

      {showLegend && (
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" /> Has schedule
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block opacity-60" /> Closed
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]/60 border border-[#D4AF37] inline-block" /> Selected
          </div>
        </div>
      )}
    </div>
  );
}
