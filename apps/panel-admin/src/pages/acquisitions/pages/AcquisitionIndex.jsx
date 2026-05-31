import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DataTable, SidebarDashboard } from '../../../components';


// --- MOCK DATA & COLUMNS ---
const mockData = [
  { 
    id: 1, date: '02-19-2024', title: 'Perlas ng silanganan', visitor: 'Olivia Harper', status: 'Posted', updated: '02-19-2024', transferStatus: 'Acquired',
    donations: [{ id: 101, title: 'Perlas ng silanganan', status: 'Posted', transferStatus: 'Acquired', date: '02-19-2024' }]
  },
  { 
    id: 2, date: '02-19-2024', title: 'kutsara', visitor: 'Ethan Bennett', status: 'Posted', updated: '02-19-2024', transferStatus: 'Acquired',
    donations: [{ id: 102, title: 'kutsara', status: 'Posted', transferStatus: 'Acquired', date: '02-19-2024' }]
  },
  { 
    id: 3, date: '02-19-2024', title: '160 years old filipiniana', visitor: 'Sophia Clarke', status: 'Pending', updated: '02-19-2024', transferStatus: 'In Progress',
    donations: [{ id: 103, title: '160 years old filipiniana', status: 'Pending', transferStatus: 'In Progress', date: '02-19-2024' }]
  },
  { 
    id: 4, date: '02-19-2024', title: 'Barong', visitor: 'Liam Anderson', status: 'Pending', updated: '02-19-2024', transferStatus: 'Mixed',
    donations: [
      { id: 104, title: 'Barong Top', status: 'Pending', transferStatus: 'Rejected', date: '02-19-2024' },
      { id: 105, title: 'Barong Pants', status: 'Posted', transferStatus: 'Acquired', date: '02-19-2024' }
    ]
  },
  { 
    id: 5, date: '02-19-2024', title: 'statue of the past mayor', visitor: 'Ava Mitchell', status: 'Posted', updated: '02-19-2024', transferStatus: 'Acquired',
    donations: [{ id: 106, title: 'statue of the past mayor', status: 'Posted', transferStatus: 'Acquired', date: '02-19-2024' }]
  },
  { id: 6, date: '02-19-2024', title: 'Statue of a Great Grandfather', visitor: 'Noah Collins', status: 'Posted', updated: '02-19-2024', transferStatus: 'Failed', donations: [] },
  { id: 7, date: '02-19-2024', title: 'Statue', visitor: 'Isabella Reed', status: 'Ongoing', updated: '02-19-2024', transferStatus: 'In Progress', donations: [] },
  { id: 8, date: '02-20-2024', title: 'Old Coins', visitor: 'James Wilson', status: 'Pending', updated: '02-20-2024', transferStatus: 'In Progress', donations: [] },
  { id: 9, date: '02-20-2024', title: 'Vintage Map', visitor: 'Mia Thomas', status: 'Posted', updated: '02-20-2024', transferStatus: 'Acquired', donations: [] },
  { id: 10, date: '02-21-2024', title: 'Ceramic Vase', visitor: 'Lucas White', status: 'Ongoing', updated: '02-21-2024', transferStatus: 'In Progress', donations: [] },
  { id: 11, date: '02-21-2024', title: 'Wooden Chair', visitor: 'Emma Harris', status: 'Pending', updated: '02-21-2024', transferStatus: 'In Progress', donations: [] },
  { id: 12, date: '02-22-2024', title: 'Silver Plate', visitor: 'Oliver Martin', status: 'Posted', updated: '02-22-2024', transferStatus: 'Acquired', donations: [] },
];

const getBadgeStyles = (status) => {
  switch (status) {
    case 'Posted': return 'bg-[#a37f5b] text-white'; 
    case 'Pending': return 'bg-[#4a3b2c] text-white'; 
    case 'Ongoing': return 'bg-[#5c4a3d] text-white'; 
    case 'Acquired': return 'bg-[#E5D3B3] text-[#6D4C41] border border-[#D7CCC8]'; 
    case 'In Progress': return 'bg-[#8D6E63] text-white'; 
    case 'Rejected': 
    case 'Failed': return 'bg-[#3E2723] text-white'; 
    default: return 'bg-gray-200 text-gray-800';
  }
};

const standardColumns = [
  { key: 'date', label: 'Date' },
  { key: 'title', label: 'Title', isBold: true },
  { key: 'visitor', label: 'Visitor Name' },
  { 
    key: 'status', label: 'Display Status',
    render: (val) => <span className={`${getBadgeStyles(val)} text-xs px-3 py-1 rounded-sm`}>{val}</span>
  },
  { key: 'updated', label: 'Updated' },
];

const groupedColumns = [
  { key: 'date', label: 'Date' },
  { key: 'visitor', label: 'Name of donator /lender' },
  { 
    key: 'donations', label: 'Donations',
    render: (val) => <span>{val?.length || 0}</span>
  }
];

// --- 1. SIDEBAR DASHBOARD ---


// --- 2. DATA TABLE ---


// --- 3. PAGE WRAPPER ---
function AcquisitionIndex() {
  const myTabs = [ 'Pending', 'Posted', 'Grouped'];
  const myFilters = ['Filter..', 'By Date', 'By Visitor', 'By Status'];
  const myActions = ['All Actions', 'Export to CSV', 'Delete Selected', 'Mark as Read'];

  const [activeTab, setActiveTab] = useState(myTabs[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [tableFilters, setTableFilters] = useState({ search: '', date: '' });
  const canAddArticle = true; 

  const [initialLoad, setInitialLoad] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setInitialLoad(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialLoad) return;
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 600);
    return () => clearTimeout(timer);
  }, [activeTab, currentPage, sortConfig, tableFilters, initialLoad]);

  // Reset page to 1 on tab, sort, or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortConfig, tableFilters]);

  const activeColumns = activeTab === 'Grouped' ? groupedColumns : standardColumns;

  // Helper to reformat native YYYY-MM-DD input to MM-DD-YYYY for mock data comparison
  const formatFilterDate = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${m}-${d}-${y}`;
  };

  // 1. Apply All Filters (Tab, Search, Date)
  const filteredData = useMemo(() => {
    let result = [...mockData];

    // Filter by Tab
    if (activeTab === 'Pending') result = result.filter(item => item.status === 'Pending');
    else if (activeTab === 'Posted') result = result.filter(item => item.status === 'Posted');
    else if (activeTab === 'Archived') result = []; 

    // Filter by Search Query
    if (tableFilters.search) {
      const lowerSearch = tableFilters.search.toLowerCase();
      result = result.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerSearch)) || 
        (item.visitor && item.visitor.toLowerCase().includes(lowerSearch))
      );
    }

    // Filter by Date Selector
    if (tableFilters.date) {
      const formattedDate = formatFilterDate(tableFilters.date);
      result = result.filter(item => {
        // Matches main row date OR matches any nested donation date
        if (item.date === formattedDate) return true;
        if (item.donations && item.donations.some(d => d.date === formattedDate)) return true;
        return false;
      });
    }

    return result;
  }, [activeTab, tableFilters]);

  // 2. Apply Sorting Logic
  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
        const valB = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  // 3. Apply Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const handleQueryChange = useCallback((filters) => {
    setTableFilters(prev => {
      if (prev.search === filters.search && prev.date === filters.date) {
        return prev;
      }
      return filters;
    });
  }, []);


  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null; 
      key = null; 
    }
    setSortConfig({ key, direction });
  };

  const renderNestedTable = (row) => {
    if (!row.donations || row.donations.length === 0) {
      return <div className="p-4 text-sm text-gray-500 text-center">No grouped items found.</div>;
    }
    return (
      <div className="bg-white border border-gray-200 shadow-md rounded-lg p-2 ml-auto w-[85%] lg:w-[75%] relative overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-900">
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Transfer Status</th>
              <th className="py-2 px-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {row.donations.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-3 text-gray-700">{item.title}</td>
                <td className="py-2 px-3">
                   <span className={`text-[10px] px-2 py-0.5 rounded shadow-sm ${getBadgeStyles(item.status)}`}>{item.status}</span>
                </td>
                <td className="py-2 px-3">
                   <span className={`text-[10px] px-2 py-0.5 rounded shadow-sm ${getBadgeStyles(item.transferStatus)}`}>{item.transferStatus}</span>
                </td>
                <td className="py-2 px-3 text-gray-600">{item.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-6 bg-white ">
      <section className="flex">
        <h1 className="text-3xl font-bold text-black tracking-tight">Acquisitions</h1>
      </section>      

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-2 items-start">
        <SidebarDashboard 
          tabs={myTabs}
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          showAddButton={canAddArticle} 
        />
        
        <div className="flex-1 w-full min-w-0">
          <DataTable 
            columns={activeColumns} 
            data={paginatedData} 
            onQueryChange={handleQueryChange} 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            showExtraActions={true}
            filterOptions={myFilters}
            actionOptions={myActions}
            sortConfig={sortConfig}
            onSort={requestSort}
            isExpandable={activeTab === 'Grouped'} 
            renderExpandedRow={renderNestedTable}
            isLoading={initialLoad}
            isUpdating={isUpdating}
          />
        </div>
      </div>
    </div>
  );
}

export default AcquisitionIndex;