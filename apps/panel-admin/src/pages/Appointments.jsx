import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Search, Calendar as CalendarIcon, Filter, Plus, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Users } from 'lucide-react';

const MOCK_STATS = {
  pending: 12,
  approved: 45,
  completed: 128,
  failed: 3,
  rejected: 5,
  expectedVisitors: 450,
  present: 320,
};

const MOCK_APPOINTMENTS = [
  { id: 1, created_at: '2026-05-09T08:00:00Z', visitor_name: 'Juan dela Cruz', preferred_time: '09:00 AM - 11:00 AM', status: 'PENDING', visitor_count: 45, updated_at: '2026-05-09T08:00:00Z' },
  { id: 2, created_at: '2026-05-08T14:30:00Z', visitor_name: 'Maria Santos', preferred_time: '01:00 PM - 03:00 PM', status: 'APPROVED', visitor_count: 12, updated_at: '2026-05-08T15:00:00Z' },
  { id: 3, created_at: '2026-05-07T09:15:00Z', visitor_name: 'Pedro Penduko', preferred_time: '10:00 AM - 12:00 PM', status: 'COMPLETED', visitor_count: 30, updated_at: '2026-05-09T12:00:00Z' },
];

export default function Appointments() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [data, setData] = useState(MOCK_APPOINTMENTS);
  const [stats, setStats] = useState(MOCK_STATS);
  const [isLoading, setIsLoading] = useState(false);

  // Status badge styling
  const getStatusStyle = (status) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-500/20';
      case 'APPROVED': return 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200 ring-green-500/20';
      case 'REJECTED': 
      case 'FAILED': return 'bg-red-50 text-red-700 border-red-200 ring-red-500/20';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-200 ring-zinc-500/20';
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'created_at',
      header: 'Date Created',
      cell: info => new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    {
      accessorKey: 'visitor_name',
      header: 'Visitor Name',
      cell: info => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
    },
    {
      accessorKey: 'preferred_time',
      header: 'Preferred Time',
      cell: info => <span className="font-mono text-xs text-zinc-600">{info.getValue()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(info.getValue())}`}>
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'visitor_count',
      header: 'Visitors',
      cell: info => <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-zinc-400"/><span>{info.getValue()}</span></div>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/appointments/${row.original.id}`);
          }}
          className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-[#b3932f] transition-colors"
        >
          View Details
        </button>
      ),
    }
  ], [navigate]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Tab filter
      if (activeTab === 'pending') {
        if (!['PENDING', 'APPROVED'].includes(item.status.toUpperCase())) return false;
      } else if (activeTab === 'forms') {
        if (['PENDING', 'APPROVED'].includes(item.status.toUpperCase())) return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && item.status.toUpperCase() !== statusFilter) return false;
      return true;
    });
  }, [data, activeTab, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
          <Plus className="w-4 h-4" strokeWidth={2.5}/>
          New Walk-in
        </button>
      </div>

      <div className="flex-1 flex gap-6 pt-5 min-h-0">
        {/* Left Sidebar - Stats & Filters */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
          <div className="bg-zinc-950 text-white rounded-sm p-5 relative overflow-hidden border border-zinc-900 shadow-sm">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]"></div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-4">Total Overview</h3>
            <div className="text-4xl font-serif mb-1">{data.length}</div>
            <div className="text-xs text-zinc-500">Total Appointments</div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-500">Summary</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
                { label: 'Approved', value: stats.approved, color: 'text-blue-600' },
                { label: 'Completed', value: stats.completed, color: 'text-green-600' },
                { label: 'Expected Visitors', value: stats.expectedVisitors, color: 'text-zinc-900 font-bold' },
                { label: 'Present', value: stats.present, color: 'text-[#D4AF37] font-bold' },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 text-xs">{stat.label}</span>
                  <span className={stat.color}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Table */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex p-1 bg-zinc-100 rounded-sm">
                {[
                  { id: 'pending', label: 'Active Requests' },
                  { id: 'forms', label: 'History & Forms' },
                  { id: 'visitorRecords', label: 'Visitor Records' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                      activeTab === tab.id ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 text-sm border border-zinc-200 rounded-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all placeholder:text-zinc-400"
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
              </select>
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm shadow-zinc-100/50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-zinc-200 select-none cursor-pointer hover:text-zinc-800 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp className="w-3 h-3 text-[#D4AF37]" />,
                            desc: <ChevronDown className="w-3 h-3 text-[#D4AF37]" />,
                          }[header.column.getIsSorted()] ?? null}
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
                      onClick={() => navigate(`/appointments/${row.original.id}`)}
                      className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 text-sm text-zinc-600">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-zinc-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-8 h-8 text-zinc-300" strokeWidth={1} />
                        <p className="text-sm font-medium">No appointments found</p>
                        <p className="text-xs">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
