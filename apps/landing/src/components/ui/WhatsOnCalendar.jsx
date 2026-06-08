import React, { useState } from 'react';

const HISTORICAL_EVENTS = [
  { month: 1, day: 23, name: 'First Philippine Republic Inaugurated (1899)' },
  { month: 2, day: 25, name: 'EDSA People Power Revolution (1986)' },
  { month: 4, day: 9, name: 'Araw ng Kagitingan / Day of Valor (1942)' },
  { month: 6, day: 12, name: 'Philippine Independence Day (1898)' },
  { month: 8, day: 21, name: 'Ninoy Aquino Day (1983)' },
  { month: 8, day: 26, name: 'Cry of Pugad Lawin (1896)' },
  { month: 10, day: 20, name: 'Leyte Landing (1944)' },
  { month: 12, day: 30, name: 'Rizal Day (1896)' }
];

export const WhatsOnCalendar = ({ cmsEvents = [], publicHolidays = [] }) => {
  const [hoveredDate, setHoveredDate] = useState(null);

  const now = new Date();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0=Sun
  const today = now.getDate();

  // Extract event dates for the current month
  const cmsEventDatesThisMonth = cmsEvents
    .filter((a) => {
      if (!a.publishedAt) return false;
      const d = new Date(a.publishedAt);
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    })
    .map((a) => ({
      day: new Date(a.publishedAt).getDate(),
      name: a.title,
      type: 'cms'
    }));

  const holidayDatesThisMonth = publicHolidays
    .filter((h) => {
      if (!h.date) return false;
      const d = new Date(h.date);
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    })
    .map((h) => ({
      day: new Date(h.date).getDate(),
      name: h.name || h.localName,
      type: 'holiday'
    }));

  const historyDatesThisMonth = HISTORICAL_EVENTS
    .filter((h) => h.month === currentMonthIndex + 1)
    .map((h) => ({
      day: h.day,
      name: h.name,
      type: 'history'
    }));

  const allEventsThisMonth = [...cmsEventDatesThisMonth, ...holidayDatesThisMonth, ...historyDatesThisMonth];

  // Grid calculation
  const prevMonthDays = new Date(currentYear, currentMonthIndex, 0).getDate();
  const prevMonthCells = Array.from({ length: firstDayOfWeek }).map((_, i) => ({
    day: prevMonthDays - firstDayOfWeek + i + 1,
    isCurrentMonth: false,
    hasCms: false,
    hasHoliday: false,
    hasHistory: false,
    events: []
  }));

  const currentMonthCells = Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    const daysEvents = allEventsThisMonth.filter(e => e.day === day);
    return { 
      day, 
      isCurrentMonth: true,
      hasCms: daysEvents.some(e => e.type === 'cms' || e.type === 'history'), // merge history with cms for visual
      hasHoliday: daysEvents.some(e => e.type === 'holiday'),
      events: daysEvents
    };
  });

  const remainingCells = 35 - (prevMonthCells.length + currentMonthCells.length);
  const nextMonthCellsCount = remainingCells < 0 ? 42 - (prevMonthCells.length + currentMonthCells.length) : remainingCells;
  
  const nextMonthCells = Array.from({ length: nextMonthCellsCount }).map((_, i) => ({
    day: i + 1,
    isCurrentMonth: false,
    hasCms: false,
    hasHoliday: false,
    hasHistory: false,
    events: []
  }));

  const allCells = [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];

  return (
    <div className="relative w-full aspect-square max-h-[100%] flex items-center justify-center pt-8 pr-12 lg:pr-8">
      
      {/* Background Shapes */}
      {/* Light beige box, top-left */}
      <div className="absolute top-0 left-0 w-[65%] h-[78%] bg-[#F9F4E6] shadow-sm z-0"></div>
      
      {/* Brown/Tan box, bottom-right */}
      <div className="absolute bottom-0 right-0 w-[65%] h-[78%] bg-[#A8987E] shadow-sm z-0"></div>

      {/* Month Title */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none">
        <h2 className="text-6xl md:text-7xl lg:text-8xl font-serif text-[#2B2B2B] tracking-tight">{currentMonth}</h2>
      </div>

      {/* Calendar White Box */}
      <div className="relative z-10 w-[85%] h-[80%] bg-white shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] flex flex-col p-6 md:p-8 mt-24">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0 mb-4">
          {['Sun','Mon','Tue','Wed','Thur','Fri','Sat'].map((day) => (
            <div key={day} className="text-center text-[11px] md:text-xs font-bold text-black uppercase">{day}</div>
          ))}
        </div>

        {/* Day Numbers Grid */}
        <div className="grid grid-cols-7 grid-rows-5 flex-1 relative gap-[1px]">
          {allCells.map((cell, i) => {
            let bgColorClass = 'bg-transparent';
            let textColorClass = cell.isCurrentMonth ? 'text-[#2B2B2B]' : 'text-gray-300';
            
            if (cell.isCurrentMonth) {
              if (cell.hasHoliday) {
                bgColorClass = 'bg-[#8A8261]';
                textColorClass = 'text-white';
              } else if (cell.hasCms) {
                bgColorClass = 'bg-[#EEDCAE]';
                textColorClass = 'text-[#2B2B2B]';
              }
            }

            return (
              <div
                key={i}
                className={`relative w-full h-full p-2 flex justify-end items-start font-bold text-sm md:text-base ${bgColorClass} ${textColorClass} ${cell.isCurrentMonth && (cell.hasCms || cell.hasHoliday) ? 'shadow-sm z-10' : ''}`}
                onMouseEnter={() => cell.events.length > 0 && setHoveredDate({ ...cell, i })}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <span>{cell.day}</span>
                
                {/* Tooltip */}
                {hoveredDate?.i === i && (
                  <div className="absolute bottom-full mb-2 right-0 z-50 w-max max-w-[200px] bg-gray-900 text-white text-xs p-2 rounded shadow-xl pointer-events-none text-left">
                    <ul className="flex flex-col gap-1">
                      {hoveredDate.events.map((ev, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-tight">
                          <span className="text-[10px] break-words whitespace-normal">{ev.name}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
