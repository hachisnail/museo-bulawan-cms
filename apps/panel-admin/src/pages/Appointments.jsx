import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import { normalizeStatus } from '../utils/scheduleUtils';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Search, Plus, ChevronDown, ChevronUp,
  Users, Loader2, AlertCircle,
} from 'lucide-react';

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

// ─── Status styling ───────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Appointments() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const { events: sseEvents } = useSSE('*');

  const [allData, setAllData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/appointments');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Ensure it's an array
      setAllData(Array.isArray(data) ? data : (data.appointments ?? []));
      setError(null);
    } catch {
      setError('Failed to load appointments.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // ── SSE ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Appointment' || res === 'AppointmentStatus') fetchAppointments();
  }, [sseEvents, fetchAppointments]);

  // ── Computed Stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const by = (s) => allData.filter(a => getApptStatus(a) === s).length;
    return {
      pending:   by('PENDING'),
      approved:  by('APPROVED'),
      completed: by('COMPLETED'),
      failed:    by('FAILED'),
      rejected:  by('REJECTED'),
      expectedVisitors: allData
        .filter(a => ['APPROVED', 'COMPLETED'].includes(getApptStatus(a)))
        .reduce((sum, a) => sum + (a.population_count || 0), 0),
      present: allData
        .filter(a => getApptStatus(a) === 'COMPLETED')
        .reduce((sum, a) => sum + (a.present_count || 0), 0),
    };
  }, [allData]);

  // ── Table Columns ────────────────────────────────────────────────────────────

  const columns = useMemo(() => [
    {
      id: 'created_at',
      accessorFn: row => row.created_at,
      header: 'Date Submitted',
      cell: info => {
        const v = info.getValue();
        return v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      },
    },
    {
      id: 'visitor_name',
      accessorFn: row => getVisitorName(row),
      header: 'Visitor Name',
      cell: info => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
    },
    {
      id: 'preferred_date',
      accessorFn: row => row.preferred_date?.split('T')[0] ?? '',
      header: 'Preferred Date',
      cell: info => {
        const d = info.getValue();
        return d
          ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—';
      },
    },
    {
      id: 'preferred_time',
      accessorFn: row => getPreferredTime(row),
      header: 'Preferred Time',
      cell: info => <span className="font-mono text-xs text-zinc-600">{info.getValue()}</span>,
    },
    {
      id: 'purpose_of_visit',
      accessorFn: row => row.purpose_of_visit || '—',
      header: 'Purpose',
      cell: info => <span className="text-xs text-zinc-600">{info.getValue()}</span>,
    },
    {
      id: 'status',
      accessorFn: row => getApptStatus(row),
      header: 'Status',
      cell: info => <StatusBadge status={info.getValue()} />,
    },
    {
      id: 'population_count',
      accessorFn: row => row.population_count ?? 0,
      header: 'Visitors',
      cell: info => (
        <div className="flex items-center gap-1.5 text-zinc-700">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span>{info.getValue()}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); navigate(`/appointments/${row.original.appointment_id}`); }}
          className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-[#b3932f] transition-colors"
        >
          View Details
        </button>
      ),
    },
  ], [navigate]);

  // ── Tab + Status filter ───────────────────────────────────────────────────────

  const ACTIVE_STATUSES  = ['PENDING', 'APPROVED'];
  const HISTORY_STATUSES = ['COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'];

  const filteredData = useMemo(() => {
    return allData.filter(item => {
      const s = getApptStatus(item);
      if (activeTab === 'active'   && !ACTIVE_STATUSES.includes(s))  return false;
      if (activeTab === 'history'  && !HISTORY_STATUSES.includes(s)) return false;
      if (statusFilter !== 'ALL'   && s !== statusFilter)            return false;
      return true;
    });
  }, [allData, activeTab, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>

      {/* Page Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-5 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Appointments</h1>
          <p className="text-xs text-zinc-500 mt-1 font-light tracking-wide">Manage visitor requests and walk-ins</p>
        </div>
        <button
          onClick={() => navigate('/appointments/walk-in')}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#D4AF37] hover:text-zinc-900 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Walk-in
        </button>
      </div>

      <div className="flex-1 flex gap-6 pt-5 min-h-0">

        {/* ── Left Sidebar — Stats ─────────────────────────────────────────── */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
          {/* Total card */}
          <div className="bg-zinc-950 text-white rounded-sm p-5 relative overflow-hidden border border-zinc-900 shadow-sm">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-4">Total Appointments</div>
            {isLoading
              ? <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              : <div className="text-4xl font-serif">{allData.length}</div>
            }
          </div>

          {/* Summary card */}
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-500">Summary</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Pending',          value: stats.pending,          color: 'text-yellow-600' },
                { label: 'Approved',         value: stats.approved,         color: 'text-blue-600' },
                { label: 'Completed',        value: stats.completed,        color: 'text-green-600' },
                { label: 'Rejected',         value: stats.rejected,         color: 'text-red-500' },
                { label: 'Failed / No-show', value: stats.failed,           color: 'text-red-400' },
                { label: 'Expected Visitors',value: stats.expectedVisitors,  color: 'text-zinc-900 font-bold' },
                { label: 'Present Recorded', value: stats.present,          color: 'text-[#D4AF37] font-bold' },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 text-xs">{stat.label}</span>
                  <span className={stat.color}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Content — Table ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50 flex-shrink-0 gap-4 flex-wrap">
            {/* Tabs */}
            <div className="flex p-1 bg-zinc-100 rounded-sm">
              {[
                { id: 'active',  label: 'Active Requests' },
                { id: 'history', label: 'History' },
                { id: 'all',     label: 'All' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setStatusFilter('ALL'); }}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 w-56 text-sm border border-zinc-200 rounded-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all placeholder:text-zinc-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-zinc-200 rounded-sm focus:outline-none focus:border-[#D4AF37] bg-white font-medium text-zinc-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="FAILED">Failed / No-show</option>
              </select>
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
                <AlertCircle className="w-8 h-8 text-red-300" />
                <p className="text-sm">{error}</p>
                <button onClick={fetchAppointments} className="text-xs text-[#D4AF37] hover:underline">Retry</button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-zinc-50/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm shadow-zinc-100/50">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-zinc-200 select-none cursor-pointer hover:text-zinc-800 transition-colors whitespace-nowrap"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1.5">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{ asc: <ChevronUp className="w-3 h-3 text-[#D4AF37]" />, desc: <ChevronDown className="w-3 h-3 text-[#D4AF37]" /> }[header.column.getIsSorted()] ?? null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/appointments/${row.original.appointment_id}`)}
                        className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-5 py-4 text-sm text-zinc-600">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
                          <Search className="w-8 h-8 text-zinc-300" strokeWidth={1} />
                          <p className="text-sm font-medium">No appointments found</p>
                          <p className="text-xs">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
