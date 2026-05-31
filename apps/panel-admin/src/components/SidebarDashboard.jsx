import { useState, useEffect } from 'react';

export default function SidebarDashboard({ 
  tabs = [], 
  activeTab, 
  onTabChange, 
  showAddButton = true,
  statsTitle,
  statsCount,
  addButtonText = 'Add new Article',
  onAddClick,
  stats = [],
  dateText,
  isLoading = false
}) {
  const displayDateText = dateText || new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // Committed display state — only updates when not loading.
  // This retains the previous tab's values while the next tab's data is being fetched,
  // then snaps to the new values instantly once ready. No flicker, no animation needed.
  const [committed, setCommitted] = useState({
    statsTitle,
    statsCount,
    stats,
    showAddButton,
    addButtonText,
  });

  useEffect(() => {
    if (!isLoading) {
      setCommitted({ statsTitle, statsCount, stats, showAddButton, addButtonText });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return (
    <div className="w-full lg:w-[300px] flex flex-col gap-6 shrink-0">

      {/* Tab buttons — always live so the click highlight is instant */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-150 ${
              activeTab === tab 
                ? 'bg-black text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats header — shows committed (stable) values */}
      <div className="bg-[#1a1a1a] text-white flex justify-between items-center px-4 py-3 rounded">
        <span className="text-sm font-medium">
          {committed.statsTitle || (activeTab === tabs[0] ? 'Total Articles' : activeTab)}
        </span>
        <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded">
          {committed.statsCount !== undefined ? committed.statsCount : 0}
        </span>
      </div>

      {/* Stats list — shows committed (stable) values */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-500 font-medium mb-1">{displayDateText}</p>
        <div className="flex flex-col gap-2 min-h-[124px]">
          {committed.stats.length > 0 ? (
            committed.stats.map((stat, idx) => (
              <div key={idx} className={`flex justify-between items-center px-3 py-2 rounded ${stat.bgClass || 'bg-gray-50'}`}>
                <span className="text-sm text-gray-700">{stat.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${stat.badgeClass || 'bg-blue-100 text-blue-800'}`}>
                  {stat.count}
                </span>
              </div>
            ))
          ) : (
            <>
              
            </>
          )}
        </div>
      </div>

      {/* Add button — also committed so it doesn't pop in/out during tab loading */}
      {committed.showAddButton && (
        <button 
          onClick={onAddClick}
          className="w-full bg-[#1a1a1a] hover:bg-black text-white flex justify-between items-center px-4 py-4 rounded-xl shadow-md transition-colors mt-2"
        >
          <span className="font-semibold">{committed.addButtonText}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}