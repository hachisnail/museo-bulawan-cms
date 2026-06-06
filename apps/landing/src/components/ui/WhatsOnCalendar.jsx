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

  return (
    <div className="w-full h-full bg-white border border-gray-100 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.10)] flex flex-col relative">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
        <h3 className="text-3xl md:text-4xl font-serif text-[#2B2B2B] leading-none tracking-wide">
          {currentMonth}
        </h3>
        <span className="text-sm text-gray-400 font-medium tracking-wider">{currentYear}</span>
      </div>
      
      {/* Calendar Grid */}
      <div className="flex-1 px-6 py-4 flex flex-col relative">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
            <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">{day}</div>
          ))}
        </div>
        
        {/* Day Numbers */}
        <div className="grid grid-cols-7 gap-1 flex-1 content-start relative" id="calendarGrid">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}
          
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === today;
            
            const daysEvents = allEventsThisMonth.filter(e => e.day === day);
            const hasCms = daysEvents.some(e => e.type === 'cms');
            const hasHoliday = daysEvents.some(e => e.type === 'holiday');
            const hasHistory = daysEvents.some(e => e.type === 'history');

            return (
              <div
                key={`day-${day}`}
                className={`aspect-square flex flex-col items-center justify-center text-sm relative transition-colors cursor-default
                  ${isToday ? 'bg-[#1C1B19] text-white font-bold' : 'text-gray-700 hover:bg-gray-50'}
                `}
                onMouseEnter={() => daysEvents.length > 0 && setHoveredDate({ day, events: daysEvents })}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <span>{day}</span>
                <div className="absolute bottom-[3px] flex gap-0.5">
                  {hasCms && <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-[#EFBF04]' : 'bg-[#EFBF04]'}`}></span>}
                  {hasHoliday && <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-red-400' : 'bg-red-500'}`}></span>}
                  {hasHistory && <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-blue-400' : 'bg-blue-500'}`}></span>}
                </div>

                {/* Tooltip */}
                {hoveredDate?.day === day && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-max max-w-[200px] bg-gray-900 text-white text-xs p-2 rounded shadow-xl pointer-events-none">
                    <ul className="flex flex-col gap-1 text-left">
                      {hoveredDate.events.map((ev, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-tight">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${
                            ev.type === 'cms' ? 'bg-[#EFBF04]' : 
                            ev.type === 'holiday' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></span>
                          <span className="text-[10px] break-words whitespace-normal">{ev.name}</span>
                        </li>
                      ))}
                    </ul>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Event Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap shrink-0 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EFBF04]"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Exhibitions/News</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Public Holidays</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Historic Events</span>
          </div>
        </div>
      </div>
    </div>
  );
};
