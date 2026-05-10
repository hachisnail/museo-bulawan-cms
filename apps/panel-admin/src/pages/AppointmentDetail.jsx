import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { ArrowLeft, Mail, Phone, MapPin, Building2, Calendar, Clock, Users, FileText, CheckCircle2, XCircle } from 'lucide-react';

const MOCK_DETAIL = {
  id: 1,
  visitor_name: 'Juan dela Cruz',
  email: 'juan.delacruz@example.com',
  phone: '09123456789',
  address: '123 Main St, Brgy. San Jose, Daet, Camarines Norte',
  organization: 'Bulawan Historical Society',
  purpose: 'School Field Trip',
  population_count: 45,
  preferred_date: '2026-05-15',
  preferred_time: '09:00 AM - 11:00 AM',
  notes: 'We will arrive via 2 school buses. Please prepare 2 tour guides if possible.',
  status: 'PENDING',
  created_at: '2026-05-09T08:00:00Z'
};

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  
  const [appointment, setAppointment] = useState(MOCK_DETAIL);
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState(null); // 'approve', 'decline', 'arrive', 'cancel'
  const [message, setMessage] = useState('');
  const [presentCount, setPresentCount] = useState('');

  const isPending = appointment.status === 'PENDING';
  const isApproved = appointment.status === 'APPROVED';

  const handleAction = () => {
    if (!action) return;
    // Mock API call
    console.log('Action:', action, 'Message:', message, 'Present:', presentCount);
    // Simulate success
    if (action === 'approve') setAppointment({ ...appointment, status: 'APPROVED' });
    if (action === 'decline') setAppointment({ ...appointment, status: 'REJECTED' });
    if (action === 'arrive') setAppointment({ ...appointment, status: 'COMPLETED' });
    if (action === 'cancel') setAppointment({ ...appointment, status: 'FAILED' });
    setAction(null);
    setMessage('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest">Pending Review</span>;
      case 'APPROVED': return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest">Approved / Upcoming</span>;
      case 'COMPLETED': return <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest">Completed</span>;
      case 'REJECTED': return <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest">Declined</span>;
      case 'FAILED': return <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Page Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-5 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/appointments')}
            className="p-2 border border-zinc-200 rounded-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Appointment Details</h1>
            <p className="text-xs text-zinc-500 mt-1 font-light tracking-wide">ID: {id?.padStart(4, '0') || '0000'}</p>
          </div>
        </div>
        <div>
          {getStatusBadge(appointment.status)}
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-6 flex gap-6">
        {/* Left Column - Details */}
        <div className="flex-1 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm p-6">
            <h2 className="text-3xl font-serif text-zinc-900 mb-6">{appointment.visitor_name}</h2>
            
            <div className="grid grid-cols-2 gap-8">
              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2 mb-4">Contact Information</h3>
                <div className="flex gap-3 items-start">
                  <Mail className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email Address</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.email}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Phone className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Phone Number</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.phone}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Address</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.address}</div>
                  </div>
                </div>
                {appointment.organization && (
                  <div className="flex gap-3 items-start">
                    <Building2 className="w-4 h-4 text-zinc-400 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Organization</div>
                      <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.organization}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Visit Details */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2 mb-4">Visit Details</h3>
                <div className="flex gap-3 items-start">
                  <Calendar className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Preferred Date</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">
                      {new Date(appointment.preferred_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Clock className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Preferred Time</div>
                    <div className="text-sm font-mono text-zinc-900 mt-0.5">{appointment.preferred_time}</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Users className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Population Count</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.population_count} Visitors</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <FileText className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Purpose</div>
                    <div className="text-sm font-medium text-zinc-900 mt-0.5">{appointment.purpose}</div>
                  </div>
                </div>
              </div>
            </div>

            {appointment.notes && (
              <div className="mt-8 pt-6 border-t border-zinc-100">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Additional Notes</div>
                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-sm text-sm text-zinc-700 leading-relaxed italic">
                  "{appointment.notes}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="w-[400px] flex-shrink-0 flex flex-col gap-6">
          {(isPending || isApproved) && (
            <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 bg-zinc-950 text-white border-b border-zinc-900 relative">
                <div className="absolute left-0 top-0 w-1 h-full bg-[#D4AF37]"></div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Administrator Actions</h3>
              </div>
              <div className="p-5 flex-1 flex flex-col bg-zinc-50/50">
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {isPending && (
                    <>
                      <button 
                        onClick={() => setAction('approve')}
                        className={`py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all ${action === 'approve' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'}`}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => setAction('decline')}
                        className={`py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all ${action === 'decline' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-400 hover:text-red-600'}`}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <>
                      <button 
                        onClick={() => setAction('arrive')}
                        className={`py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all ${action === 'arrive' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'}`}
                      >
                        Visitor Arrived
                      </button>
                      <button 
                        onClick={() => setAction('cancel')}
                        className={`py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all ${action === 'cancel' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-400 hover:text-red-600'}`}
                      >
                        Cancel Visit
                      </button>
                    </>
                  )}
                </div>

                {/* Form Elements depending on action */}
                {action && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 flex-1 flex flex-col">
                    
                    {action === 'arrive' && (
                      <div className="p-4 bg-white border border-zinc-200 rounded-sm mb-2 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">Attendance Verification</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Expected</div>
                            <div className="text-xl font-bold text-zinc-900">{appointment.population_count}</div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-1 block">Actually Present *</label>
                            <input 
                              type="number" 
                              min="1"
                              value={presentCount}
                              onChange={e => setPresentCount(e.target.value)}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50"
                              placeholder="Count"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => setPresentCount(appointment.population_count.toString())}
                          className="mt-3 w-full py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200 rounded-sm hover:bg-zinc-100 transition-colors"
                        >
                          Mark All Present
                        </button>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-1.5 block">
                        Message to Visitor (Optional)
                      </label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className="w-full flex-1 min-h-[120px] bg-white border border-zinc-200 rounded-sm p-3 text-sm resize-none focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50"
                        placeholder="Add a message to be sent via email..."
                      />
                    </div>
                    
                    <button 
                      onClick={handleAction}
                      disabled={(action === 'arrive' && !presentCount)}
                      className={`w-full py-3 mt-4 text-[11px] font-bold uppercase tracking-widest rounded-sm transition-all shadow-sm ${
                        action === 'decline' || action === 'cancel' 
                          ? 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50' 
                          : 'bg-[#D4AF37] hover:bg-[#b3932f] text-zinc-900 disabled:opacity-50'
                      }`}
                    >
                      Confirm Action
                    </button>
                  </div>
                )}
                {!action && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 p-6 border-2 border-dashed border-zinc-200 rounded-sm">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-widest">Select an action above to proceed</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Request Letter View */}
          {appointment.purpose === 'School Field Trip' && (
            <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 flex-shrink-0 bg-zinc-50/50">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Attached Documents</h3>
              </div>
              <div className="p-5 flex-1 flex flex-col items-center justify-center bg-zinc-50 border-2 border-dashed border-zinc-200 m-4 rounded-sm">
                <FileText className="w-12 h-12 text-zinc-300 mb-3" />
                <p className="text-sm font-medium text-zinc-700">RequestLetter.pdf</p>
                <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">Click to view document</p>
                <button className="mt-4 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#D4AF37] hover:text-zinc-900 transition-colors">
                  View File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
