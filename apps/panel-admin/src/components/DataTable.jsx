import React, { useState, useEffect, useRef } from 'react';



export default function DataTable({ 
  columns, 
  data, 
  onQueryChange, 
  currentPage, 
  totalPages, 
  onPageChange, 
  showExtraActions = true,
  filterOptions = ['Filter..'],
  actionOptions = ['All Actions'],
  sortConfig,    
  onSort,        
  isExpandable = false,
  renderExpandedRow,
  isLoading = false,
  isUpdating = false,
  onRowClick,
  onRowOptionsClick
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const hasOptions = typeof onRowOptionsClick === 'function';
  
  // --- NEW: Calendar State & Ref ---
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const calendarRef = useRef(null);

  // Close calendar popover if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dispatch filter changes whenever search or date changes
  useEffect(() => {
    if (onQueryChange) {
      onQueryChange({ search: searchTerm, date: selectedDate });
    }
  }, [searchTerm, selectedDate, onQueryChange]);

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  return (
    <div className="flex flex-col w-full h-full justify-between">
      <div className="flex flex-col w-full">
        
        {/* Header Controls */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          
          {/* --- NEW: Calendar Popover Container --- */}
          <div className="relative" ref={calendarRef}>
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`p-2 border rounded transition-colors relative ${selectedDate ? 'border-[#a37f5b] text-[#a37f5b] bg-[#a37f5b]/5' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {/* Indicator dot if date is selected */}
              {selectedDate && <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a37f5b] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#a37f5b]"></span></span>}
            </button>

            {/* Calendar Popover */}
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[240px] animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Filter by Date</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#a37f5b] focus:ring-1 focus:ring-[#a37f5b] transition-all"
                />
                <div className="flex justify-between mt-4">
                   <button 
                     onClick={() => { setSelectedDate(''); setShowDatePicker(false); }} 
                     className="text-xs font-medium text-gray-500 hover:text-black transition-colors px-2 py-1"
                   >
                     Clear Filter
                   </button>
                   <button 
                     onClick={() => setShowDatePicker(false)} 
                     className="text-xs font-bold bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
                   >
                     Apply
                   </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search Title or Visitor" 
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {showExtraActions && (
            <div className="flex gap-3 hidden sm:flex">
              <div className="relative w-32 md:w-40">
                <select className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm appearance-none text-gray-500 focus:outline-none bg-white">
                  {filterOptions.map((opt, index) => (
                    <option key={index} value={opt}>{opt}</option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">+</span>
              </div>

              <div className="relative w-36 md:w-40">
                <select className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm appearance-none text-gray-600 focus:outline-none bg-white">
                  {actionOptions.map((opt, index) => (
                    <option key={index} value={opt}>{opt}</option>
                  ))}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-[400px] flex flex-col relative w-full">
          
          {isUpdating && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#a37f5b] rounded-full animate-spin"></div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto w-full">
            <table 
              className="w-full text-left border-collapse"
              style={isExpandable ? { borderCollapse: 'separate', borderSpacing: '0 8px' } : {}} 
            >
              <thead>
                <tr className="text-gray-500 text-sm border-b border-gray-300">
                  {columns.map((col, idx) => (
                    <th 
                      key={idx} 
                      onClick={() => !isLoading && onSort(col.key)}
                      className={`py-3 font-semibold pr-4 whitespace-nowrap select-none group ${isLoading ? 'cursor-default opacity-50' : 'cursor-pointer hover:text-gray-800 transition-colors'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.label}
                        <div className="flex flex-col text-[9px] leading-[0.6] opacity-30 group-hover:opacity-100 transition-opacity">
                          <span className={sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'text-black font-extrabold opacity-100' : ''}>▲</span>
                          <span className={sortConfig?.key === col.key && sortConfig.direction === 'desc' ? 'text-black font-extrabold opacity-100 mt-[1px]' : 'mt-[1px]'}>▼</span>
                        </div>
                      </div>
                    </th>
                  ))}
                  {hasOptions && <th className="py-3 w-10"></th>}
                  {isExpandable && <th className="px-4 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className={`animate-pulse ${isExpandable ? 'bg-white shadow-sm border border-gray-100' : 'border-b border-gray-100'}`}>
                      {columns.map((_, colIdx) => (
                        <td key={colIdx} className={`py-5 pr-4 ${isExpandable ? 'px-4' : ''}`}>
                          <div className="h-3.5 bg-gray-200 rounded w-2/3"></div>
                        </td>
                      ))}
                      {hasOptions && <td className="py-5 px-2 text-right"><div className="h-3.5 w-5 bg-gray-200 rounded inline-block"></div></td>}
                      {isExpandable && <td className="py-5 px-4 text-right"><div className="h-3.5 w-3.5 bg-gray-200 rounded inline-block"></div></td>}
                    </tr>
                  ))
                ) : data.length > 0 ? (
                  data.map((row) => {
                    const isExpanded = expandedRows.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr 
                          onClick={() => {
                            if (isExpandable) {
                              toggleRow(row.id);
                            } else if (onRowClick) {
                              onRowClick(row);
                            }
                          }}
                          className={`
                            text-sm hover:bg-gray-50/50 transition-all
                            ${(isExpandable || onRowClick) ? 'cursor-pointer' : ''}
                            ${isExpandable ? 'bg-white shadow-sm border border-gray-200' : 'border-b border-gray-200'}
                          `}
                        >
                          {columns.map((col, colIndex) => (
                            <td 
                              key={colIndex} 
                              className={`
                                py-4 pr-4 
                                ${isExpandable ? 'px-4 border-y border-gray-200' : ''}
                                ${isExpandable && colIndex === 0 ? 'border-l rounded-l-lg' : ''}
                                ${isExpandable && colIndex === columns.length - 1 && !isExpandable ? 'border-r rounded-r-lg' : ''}
                                ${col.isBold ? 'font-bold text-gray-900' : 'text-gray-700'}
                              `}
                            >
                              {col.render ? col.render(row[col.key], row) : row[col.key]}
                            </td>
                          ))}
                          
                          {hasOptions && (
                            <td className={`py-3 px-2 text-right ${isExpandable ? 'border-y border-gray-200' : 'border-b border-gray-200'}`}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowOptionsClick(row);
                                }}
                                className="text-gray-400 hover:text-black p-1.5 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center ml-auto"
                                title="Options"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                            </td>
                          )}

                          {isExpandable && (
                            <td className="py-3 px-4 border-y border-r border-gray-200 rounded-r-lg text-right text-gray-500">
                              <span className="text-[10px] transform transition-transform">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </td>
                          )}
                        </tr>

                        {isExpandable && isExpanded && renderExpandedRow && (
                          <tr>
                            <td colSpan={columns.length + (hasOptions ? 1 : 0) + (isExpandable ? 1 : 0)} className="pb-4 pt-1 px-4">
                              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                {renderExpandedRow(row)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={columns.length + (isExpandable ? 1 : 0)} className="py-8 text-center text-gray-500">
                      No data found for your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="flex flex-col gap-4 lg:hidden w-full mt-2">
             {isLoading ? (
               [...Array(4)].map((_, i) => (
                 <div key={i} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex flex-col gap-4 animate-pulse">
                   {columns.map((_, colIdx) => (
                     <div key={colIdx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                       <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                       <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                     </div>
                   ))}
                 </div>
               ))
             ) : data.length > 0 ? (
              data.map((row, rowIndex) => (
                <div 
                  key={rowIndex} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex flex-col gap-2 relative pr-10 ${onRowClick ? 'cursor-pointer hover:bg-gray-50/50 transition-all' : ''}`}
                >
                  {hasOptions && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowOptionsClick(row);
                      }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-black p-1.5 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
                      title="Options"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  )}
                  {columns.map((col, colIndex) => (
                    <div key={colIndex} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500 font-medium">{col.label}:</span>
                      <span className={`text-right text-gray-800 ${col.isBold ? 'font-bold' : ''}`}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-500 border border-gray-200 rounded-lg">No data found for your filters.</div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 0 && !isLoading && (
        <div className="flex items-center justify-between border-t border-gray-200 mt-6 pt-4">
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isUpdating}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isUpdating}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}