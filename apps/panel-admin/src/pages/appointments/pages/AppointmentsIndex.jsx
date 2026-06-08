import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import { normalizeStatus } from '../../../utils/scheduleUtils';
import { DataTable, SidebarDashboard } from '../../../components';
import { Users, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getVisitorName(a) {
  if (a.Visitor?.first_name || a.Visitor?.last_name) {
    return `${a.Visitor.first_name || ''} ${a.Visitor.last_name || ''}`.trim();
  }
  return a.visitor_name || 'Unknown Visitor';
}

function getApptStatus(a) {
  return normalizeStatus(a.AppointmentStatus?.status || a.status || '');
}

function getPreferredTime(a) {
  if (a.preferred_time) return a.preferred_time;
  if (a.start_time && a.end_time) {
    const fmt = (t) => {
      const [h, m] = t.substring(0, 5).split(':').map(Number);
      const p = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
    };
    return `${fmt(a.start_time)} – ${fmt(a.end_time)}`;
  }
  return 'Flexible';
}

const STATUS_STYLE = {
  PENDING:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED:  'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED:  'bg-red-50 text-red-700 border-red-200',
  FAILED:    'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-zinc-50 text-zinc-600 border-zinc-200',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200';
  const label = status === 'REJECTED' ? 'Declined' : status === 'FAILED' ? 'Cancelled' : status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Columns ────────────────────────────────────────────────────────────
const columns = [
  {
    key: 'created_at',
    label: 'Date Submitted',
    render: (val) => val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  },
  {
    key: 'visitor_name',
    label: 'Visitor Name',
    isBold: true,
  },
  {
    key: 'preferred_date',
    label: 'Preferred Date',
    render: (val) => val ? new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  },
  {
    key: 'preferred_time',
    label: 'Preferred Time',
    render: (val) => <span className="font-mono text-xs text-zinc-600">{val}</span>,
  },
  {
    key: 'purpose_of_visit',
    label: 'Purpose',
    render: (val) => <span className="text-xs text-zinc-600">{val || '—'}</span>,
  },
  {
    key: 'status_label',
    label: 'Status',
    render: (val) => <StatusBadge status={val} />,
  },
  {
    key: 'population_count',
    label: 'Visitors',
    render: (val) => (
      <div className="flex items-center gap-1.5 text-zinc-700">
        <Users className="w-3.5 h-3.5 text-zinc-400" />
        <span>{val}</span>
      </div>
    ),
  }
];

export default function AppointmentsIndex() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const { events: sseEvents } = useSSE('*');

  const myTabs = ['Active Requests', 'History', 'All', 'Visitor Records'];

  const [allData, setAllData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(myTabs[0]);

  // ── Visitor Records state ────────────────────────────────────────────────────
  const [visitorRecords, setVisitorRecords] = useState([]);
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorError, setVisitorError] = useState(null);
  const [expandedVisitor, setExpandedVisitor] = useState(null);
  const [visitorPage, setVisitorPage] = useState(1);
  const VISITOR_PER_PAGE = 10;
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [tableFilters, setTableFilters] = useState({ search: '', date: '' });

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/appointments');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const parsed = (Array.isArray(data) ? data : (data.appointments ?? [])).map(item => ({
        ...item,
        visitor_name: getVisitorName(item),
        preferred_date: item.preferred_date?.split('T')[0] ?? '',
        preferred_time: getPreferredTime(item),
        status_label: getApptStatus(item),
        population_count: item.population_count ?? 0
      }));

      setAllData(parsed);
      setError(null);
    } catch {
      setError('Failed to load appointments.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // ── Visitor Records fetch ─────────────────────────────────────────────────────
  const fetchVisitorRecords = useCallback(async () => {
    setVisitorLoading(true);
    setVisitorError(null);
    try {
      const res = await apiFetch('/api/v1/appointments/visitor-records');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVisitorRecords(Array.isArray(data) ? data : []);
    } catch {
      setVisitorError('Failed to load visitor records.');
    } finally {
      setVisitorLoading(false);
    }
  }, [apiFetch]);

  // Load visitor records when tab is selected
  useEffect(() => {
    if (activeTab === 'Visitor Records') {
      fetchVisitorRecords();
      setVisitorPage(1);
      setExpandedVisitor(null);
    }
  }, [activeTab, fetchVisitorRecords]);

  // ── SSE ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Appointment' || res === 'AppointmentStatus') {
      fetchAppointments();
      if (activeTab === 'Visitor Records') fetchVisitorRecords();
    }
  }, [sseEvents, fetchAppointments, fetchVisitorRecords, activeTab]);

  // Reset page to 1 on tab, sort, or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortConfig, tableFilters]);

  // ── Computed Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const by = (s) => allData.filter(a => a.status_label === s).length;
    const expectedVisitors = allData
        .filter(a => ['APPROVED', 'COMPLETED'].includes(a.status_label))
        .reduce((sum, a) => sum + (a.population_count || 0), 0);
    const present = allData
        .filter(a => a.status_label === 'COMPLETED')
        .reduce((sum, a) => sum + (a.present_count || 0), 0);

    return [
      { label: 'Pending', count: by('PENDING'), bgClass: 'bg-yellow-50', badgeClass: 'bg-yellow-100 text-yellow-800' },
      { label: 'Approved', count: by('APPROVED'), bgClass: 'bg-blue-50', badgeClass: 'bg-blue-100 text-blue-800' },
      { label: 'Completed', count: by('COMPLETED'), bgClass: 'bg-green-50', badgeClass: 'bg-green-100 text-green-800' },
      { label: 'Rejected', count: by('REJECTED'), bgClass: 'bg-red-50', badgeClass: 'bg-red-100 text-red-800' },
      { label: 'Failed / No-show', count: by('FAILED'), bgClass: 'bg-red-50', badgeClass: 'bg-red-100 text-red-800' },
      { label: 'Expected Visitors', count: expectedVisitors, bgClass: 'bg-gray-50', badgeClass: 'bg-gray-200 text-black' },
      { label: 'Present Recorded', count: present, bgClass: 'bg-zinc-50', badgeClass: 'bg-zinc-800 text-white' },
    ];
  }, [allData]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const ACTIVE_STATUSES  = ['PENDING', 'APPROVED'];
  const HISTORY_STATUSES = ['COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'];

  const filteredData = useMemo(() => {
    let result = [...allData];

    // 1. Tab Filter
    if (activeTab === 'Active Requests') {
      result = result.filter(item => ACTIVE_STATUSES.includes(item.status_label));
    } else if (activeTab === 'History') {
      result = result.filter(item => HISTORY_STATUSES.includes(item.status_label));
    }

    // 2. Search Filter
    if (tableFilters.search) {
      const lowerSearch = tableFilters.search.toLowerCase();
      result = result.filter(item => 
        (item.visitor_name && item.visitor_name.toLowerCase().includes(lowerSearch)) ||
        (item.purpose_of_visit && item.purpose_of_visit.toLowerCase().includes(lowerSearch))
      );
    }

    // 3. Date Filter
    if (tableFilters.date) {
      const dateStr = tableFilters.date; // YYYY-MM-DD
      result = result.filter(item => item.preferred_date === dateStr);
    }

    return result;
  }, [allData, activeTab, tableFilters]);

  // ── Sorting ──────────────────────────────────────────────────────────────────
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

  // ── Pagination ───────────────────────────────────────────────────────────────
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

  const handleRowClick = (row) => {
    navigate(`/appointments/${row.appointment_id}`);
  };

  // ── Visitor Records pagination ────────────────────────────────────────────────
  const visitorTotalPages = Math.ceil(visitorRecords.length / VISITOR_PER_PAGE);
  const paginatedVisitors = visitorRecords.slice(
    (visitorPage - 1) * VISITOR_PER_PAGE,
    visitorPage * VISITOR_PER_PAGE
  );

  // ── Visitor Records renderer ─────────────────────────────────────────────────
  const VisitorRecordsTable = () => {
    if (visitorLoading) return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
    if (visitorError) return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
        <AlertCircle className="w-6 h-6 text-red-300" />
        <p className="text-sm">{visitorError}</p>
        <button onClick={fetchVisitorRecords} className="text-xs text-zinc-600 hover:underline">Retry</button>
      </div>
    );
    if (!paginatedVisitors.length) return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
        <Users className="w-8 h-8 opacity-30" />
        <p className="text-sm">No visitor records found.</p>
      </div>
    );
    return (
      <div className="space-y-3">
        {paginatedVisitors.map((v, idx) => {
          const key = v.visitor_email || v.visitor_name;
          const isOpen = expandedVisitor === key;
          return (
            <div key={idx} className="border border-zinc-200 rounded-sm overflow-hidden bg-white shadow-sm">
              {/* Visitor summary row */}
              <button
                type="button"
                onClick={() => setExpandedVisitor(isOpen ? null : key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{v.visitor_name || '—'}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{v.visitor_email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  {v.organization && (
                    <span className="text-[11px] text-zinc-400 hidden sm:block truncate max-w-[160px]">{v.organization}</span>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-900">{v.visit_count}</p>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-400">Visit{v.visit_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-xs font-medium text-zinc-700">
                      {v.last_visit_date ? new Date(v.last_visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-400">Last Visit</p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
                </div>
              </button>

              {/* Expanded: appointment history */}
              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Visit History</p>
                  <div className="space-y-2">
                    {(v.appointments || []).map((appt, ai) => (
                      <div
                        key={ai}
                        className="flex items-center justify-between py-2 px-3 bg-white border border-zinc-100 rounded-sm cursor-pointer hover:border-zinc-300 transition-colors"
                        onClick={() => navigate(`/appointments/${appt.appointment_id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/appointments/${appt.appointment_id}`)}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-900 truncate">{appt.purpose || '—'}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {appt.date ? new Date(appt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <Users className="w-3 h-3" />
                            <span>{appt.population_count ?? '—'}</span>
                          </div>
                          <span className={`border px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[appt.status] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
                            {appt.status === 'REJECTED' ? 'Declined' : appt.status === 'FAILED' ? 'No-show' : appt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Pagination */}
        {visitorTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setVisitorPage(p => Math.max(1, p - 1))}
              disabled={visitorPage === 1}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-zinc-200 rounded-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-[10px] text-zinc-500">{visitorPage} / {visitorTotalPages}</span>
            <button
              onClick={() => setVisitorPage(p => Math.min(visitorTotalPages, p + 1))}
              disabled={visitorPage === visitorTotalPages}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-zinc-200 rounded-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
        <AlertCircle className="w-8 h-8 text-red-300" />
        <p className="text-sm">{error}</p>
        <button onClick={fetchAppointments} className="text-xs text-zinc-600 hover:text-zinc-900 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-y-6 bg-white pb-12 px-4 sm:px-6 lg:px-8 pt-8">
      <section className="flex">
        <h1 className="text-3xl font-bold text-black tracking-tight">Appointments</h1>
      </section>      

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-2 flex-1 min-h-0">
        <SidebarDashboard
          tabs={myTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showAddButton={true}
          addButtonText="Register Walk-in"
          onAddClick={() => navigate('/appointments/walk-in')}
          statsTitle="Total Appointments"
          statsCount={allData.length}
          stats={stats}
          isLoading={isLoading}
        />

        <div className="flex-1 w-full min-w-0 min-h-0">
          {activeTab === 'Visitor Records' ? (
            <VisitorRecordsTable />
          ) : (
            <DataTable
              columns={columns}
              data={paginatedData}
              onQueryChange={handleQueryChange}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              showExtraActions={false}
              sortConfig={sortConfig}
              onSort={requestSort}
              isLoading={isLoading}
              onRowClick={handleRowClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
