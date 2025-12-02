import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText, Menu, Search, UserPlus, LogOut, CheckSquare } from 'lucide-react';
import { ScheduleGrid } from './components/ScheduleGrid';
import { StaffingSummary } from './components/StaffingSummary';
import { StatsPanel } from './components/StatsPanel';
import { ConstraintChecker } from './components/ConstraintChecker';
import { LeaveManager } from './components/LeaveManager';
import { TeamManager } from './components/TeamManager';
import { SkillsSettings } from './components/SkillsSettings';
import { ServiceSettings } from './components/ServiceSettings';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { SHIFT_TYPES } from './constants';
import { Employee, ShiftCode, ViewMode, Skill, Service, LeaveData, ServiceAssignment, LeaveCounters, UserRole, AppNotification } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';
import { exportScheduleToCSV } from './utils/csvExport';
import { Toast } from './components/Toast';
import { checkConstraints } from './utils/validation';
import * as db from './services/db';
import * as notifications from './utils/notifications';

function App() {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<{ role: UserRole, employeeId?: string, name?: string } | null>(null);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState<'planning' | 'stats' | 'team' | 'leaves' | 'settings' | 'dashboard'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<ServiceAssignment[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string>('');
  
  const [selectedCell, setSelectedCell] = useState<{empId: string, date: string} | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  // Filter States
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState<string>('all');

  // Sidebar Mobile State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Notification State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Initial Data Load ---
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentUser) {
        const interval = setInterval(loadNotifications, 5000);
        loadNotifications();
        return () => clearInterval(interval);
    }
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empData, skillsData, servicesData, assignData] = await Promise.all([
          db.fetchEmployeesWithShifts(),
          db.fetchSkills(),
          db.fetchServices(),
          db.fetchServiceAssignments()
      ]);
      setEmployees(empData);
      setSkillsList(skillsData);
      setServicesList(servicesData);
      setAssignmentsList(assignData);
      
      if (servicesData.length > 0 && !activeServiceId) {
          setActiveServiceId(servicesData[0].id);
      }
    } catch (error: any) {
      console.error(error);
      setToast({ message: `Erreur: ${error.message || "Problème de connexion"}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
      const allNotifs = await db.fetchNotifications();
      const myNotifs = allNotifs.filter(n => 
          n.recipientRole === 'ALL' || 
          n.recipientRole === currentUser?.role ||
          (n.recipientId && n.recipientId === currentUser?.employeeId)
      );
      setAppNotifications(myNotifs);
  };

  const handleLogin = (role: UserRole, employee?: Employee) => {
      // Logic: If Cadre, auto-select their service if possible (mock logic: pick first service or specific if assigned)
      let serviceToSelect = activeServiceId;
      if (role === 'CADRE') {
          // Check if cadre is assigned to a service
          const myAssignment = assignmentsList.find(a => a.employeeId === employee?.id);
          if (myAssignment) serviceToSelect = myAssignment.serviceId;
          else if (servicesList.length > 0) serviceToSelect = servicesList[0].id;
      }
      
      setActiveServiceId(serviceToSelect);

      setCurrentUser({
          role,
          employeeId: employee?.id,
          name: employee ? employee.name : (role === 'ADMIN' ? 'Administrateur' : 'Directeur / Directrice')
      });
      if (role === 'INFIRMIER' || role === 'AIDE_SOIGNANT') {
          setActiveTab('leaves');
      } else {
          setActiveTab('planning');
      }
      setToast({ message: `Bienvenue, ${employee ? employee.name : role}`, type: "success" });
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setActiveTab('planning');
  };

  const activeService = servicesList.find(s => s.id === activeServiceId) || null;

  // --- ACTIONS ---

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
      exportScheduleToCSV(filteredEmployees, currentDate);
      setToast({ message: "Export CSV généré", type: "success" });
  };

  const handleImportClick = () => {
      if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          if (text) {
              const res = parseScheduleCSV(text, employees);
              if (res.error) {
                  setToast({ message: res.error, type: "error" });
              } else {
                  // Save to DB
                  await db.bulkImportEmployees(res.employees);
                  await loadData();
                  setToast({ message: `Import réussi : ${res.stats?.updated} mis à jour, ${res.stats?.created} créés`, type: "success" });
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleGenerateSchedule = async () => {
      if (!confirm("Générer le planning effacera les postes actuels (hors congés validés) pour ce mois. Continuer ?")) return;
      setIsLoading(true);
      try {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const newEmps = generateMonthlySchedule(employees, year, month, activeService?.config);
          await db.bulkSaveSchedule(newEmps);
          await loadData();
          setToast({ message: "Planning généré avec succès", type: "success" });
      } catch (e: any) {
          setToast({ message: e.message, type: "error" });
      } finally {
          setIsLoading(false);
      }
  };

  const handleResetPlanning = async () => {
      if (!confirm("Voulez-vous vraiment réinitialiser TOUT le planning de ce mois ?")) return;
      setIsLoading(true);
      try {
          await db.clearShiftsInRange(currentDate.getFullYear(), currentDate.getMonth());
          await loadData();
          setToast({ message: "Planning réinitialisé.", type: "success" });
      } catch (e: any) {
          setToast({ message: e.message, type: "error" });
      } finally {
          setIsLoading(false);
      }
  };

  const handleCopyPlanning = async () => {
      if (!confirm("Copier le planning du mois précédent sur le mois en cours ?")) return;
      setIsLoading(true);
      try {
          // Logic simplifiée : récupération shifts M-1 et application M
          // Pour la démo, on simule une copie
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const prevMonth = month === 0 ? 11 : month - 1;
          const prevYear = month === 0 ? year - 1 : year;
          
          // Fetch prev month shifts (would be a specific DB call in real app)
          // Here we just re-generate purely for demo continuity or use existing logic
          // A real copy would fetch shifts from prev month date range and insert them with +1 month date
          setToast({ message: "Fonctionnalité simulée : Planning copié.", type: "success" });
      } catch(e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const toggleRole = (role: string) => {
      setSelectedRoles(prev => 
          prev.includes(role) 
             ? prev.filter(r => r !== role)
             : [...prev, role]
      );
  };

  // --- Filter Logic ---
  const { start: gridStartDate, days: gridDuration } = useMemo(() => {
      if (viewMode === 'day' || viewMode === 'hourly') return { start: currentDate, days: 1 };
      if (viewMode === 'week') {
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(currentDate);
        monday.setDate(diff);
        return { start: monday, days: 7 };
      }
      if (viewMode === 'workweek') {
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(currentDate);
        monday.setDate(diff);
        return { start: monday, days: 5 };
      }
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      return { start, days: daysInMonth };
  }, [currentDate, viewMode]);

  const filteredEmployees = useMemo(() => {
      if (currentUser?.role === 'INFIRMIER' || currentUser?.role === 'AIDE_SOIGNANT') {
          return employees.filter(e => e.id === currentUser.employeeId);
      }

      return employees.filter(emp => {
        // 1. Role & Skill Filter
        const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
        const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
        
        // 2. Service Qualification Filter
        let qualificationMatch = true;
        if (showQualifiedOnly && activeService?.config?.requiredSkills?.length > 0) {
            const reqSkills = activeService.config.requiredSkills;
            const hasSkill = emp.skills.some(s => reqSkills.includes(s));
            qualificationMatch = hasSkill;
        }

        // 3. Service Assignment Filter
        let assignmentMatch = true;
        if (activeServiceId && assignmentsList.length > 0) {
            const viewEnd = new Date(gridStartDate);
            viewEnd.setDate(viewEnd.getDate() + gridDuration);

            const empAssignments = assignmentsList.filter(a => 
                a.employeeId === emp.id && 
                a.serviceId === activeServiceId
            );

            // If Service selected, strict check. If 'All Services', show everyone.
            if (activeServiceId) {
                if (empAssignments.length > 0) {
                     const hasOverlap = empAssignments.some(a => {
                        const aStart = new Date(a.startDate);
                        const aEnd = a.endDate ? new Date(a.endDate) : new Date('2099-12-31');
                        return aStart < viewEnd && aEnd >= gridStartDate;
                    });
                    assignmentMatch = hasOverlap;
                } else {
                    // Check if this employee belongs to ANY other service assignment that overlaps
                    // If assigned to Service B, don't show in Service A view
                    // For demo simplicity, if activeServiceId is set, filter by assignment
                    const anyAssignment = assignmentsList.find(a => a.employeeId === emp.id && a.serviceId !== activeServiceId);
                     // If assigned elsewhere, hide. If not assigned anywhere, show? Usually hide.
                     // Strict mode: Must be assigned to THIS service.
                     assignmentMatch = false; 
                }
            }
        }

        // 4. Status & Absence Type Filter
        let statusMatch = true;
        let absenceTypeMatch = true;
        if (statusFilter !== 'all' || absenceTypeFilter !== 'all') {
            let hasWork = false;
            let hasSpecificAbsence = false;
            for (let i = 0; i < gridDuration; i++) {
                const d = new Date(gridStartDate);
                d.setDate(d.getDate() + i);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const code = emp.shifts[dateStr];
                if (code) {
                    if (SHIFT_TYPES[code]?.isWork) hasWork = true;
                    if (code === absenceTypeFilter) hasSpecificAbsence = true;
                }
            }
            if (statusFilter === 'present') statusMatch = hasWork;
            else if (statusFilter === 'absent') statusMatch = !hasWork; // Strictly absent whole period? Or absent at least once? Usually "Present at least once vs Absent whole period"
            
            if (absenceTypeFilter !== 'all') absenceTypeMatch = hasSpecificAbsence;
        }

        return roleMatch && skillMatch && qualificationMatch && assignmentMatch && statusMatch && absenceTypeMatch;
      });
  }, [employees, selectedRoles, skillFilter, showQualifiedOnly, activeServiceId, assignmentsList, gridStartDate, gridDuration, statusFilter, absenceTypeFilter, activeService, currentUser]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // --- Handlers ---
  
  const handleDateNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week' || viewMode === 'workweek') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };
  
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
      }
  };

  const handleCellClick = (empId: string, date: string) => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'DIRECTOR') {
        setToast({ message: "Modification directe non autorisée.", type: "warning" });
        return;
    }
    setSelectedCell({ empId, date });
    setIsEditorOpen(true);
  };

  const handleShiftChange = async (code: ShiftCode) => {
    if (!selectedCell) return;
    try {
      await db.upsertShift(selectedCell.empId, selectedCell.date, code);
      setToast({ message: "Poste mis à jour", type: "success" });
      loadData(); 
      setIsEditorOpen(false);
    } catch (error: any) {
      setToast({ message: `Erreur: ${error.message}`, type: "error" });
    }
  };

  if (!currentUser) {
      return <LoginScreen employees={employees} onLogin={handleLogin} />;
  }

  const unreadNotifs = appNotifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <style>{`
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            aside, header, .no-print { display: none !important; }
            .print-container { overflow: visible !important; height: auto !important; }
            table { width: 100% !important; border-collapse: collapse; }
        }
      `}</style>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-40 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 rounded hover:bg-slate-100 lg:hidden">
             <Menu className="w-6 h-6" />
          </button>
          <div className="bg-blue-600 p-2 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
          <div>
             <h1 className="text-lg font-bold text-slate-800 leading-tight hidden sm:block">OptiPlan</h1>
             <p className="text-xs text-slate-500">{activeService ? activeService.name : 'Vue Globale'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           {/* Date Nav */}
           {(activeTab === 'planning' || activeTab === 'dashboard') && (
               <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 relative gap-1">
                 <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                 
                 {/* Native Date Picker hidden but clickable or just displayed nicely */}
                 <div className="relative group">
                     <span className="px-2 md:px-3 text-sm font-medium text-slate-700 min-w-[120px] md:min-w-[200px] text-center capitalize cursor-pointer block py-1">
                        {viewMode === 'month' ? currentDate.toLocaleDateString('fr-FR', {month:'long', year:'numeric'}) : 
                         viewMode === 'day' || viewMode === 'hourly' ? currentDate.toLocaleDateString('fr-FR', {weekday: 'long', day:'numeric', month:'long'}) :
                         `Semaine du ${gridStartDate.toLocaleDateString('fr-FR', {day: 'numeric', month: 'numeric'})}`
                        }
                     </span>
                     <input 
                        type="date" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleDateSelect}
                        // Value needs YYYY-MM-DD
                        value={currentDate.toISOString().split('T')[0]}
                     />
                 </div>

                 <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600" /></button>
               </div>
           )}

           <div className="h-6 w-px bg-slate-300 mx-1 hidden md:block"></div>

           {/* User Profile */}
           <div className="flex items-center gap-3">
             <div className="relative">
                 <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 relative rounded-full hover:bg-slate-100">
                     <Bell className="w-5 h-5 text-slate-600" />
                     {unreadNotifs > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                 </button>
                 {isNotifOpen && (
                     <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
                         <div className="p-3 bg-slate-50 border-b font-semibold text-sm">Notifications</div>
                         <div className="max-h-80 overflow-y-auto">
                             {appNotifications.length === 0 ? <div className="p-4 text-slate-400 text-sm text-center">Rien à signaler.</div> : 
                                appNotifications.map(n => (
                                    <div key={n.id} className={`p-3 border-b text-sm hover:bg-slate-50 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                                        <div className="font-bold text-slate-800 mb-1">{n.title}</div>
                                        <div className="text-slate-600">{n.message}</div>
                                    </div>
                                ))
                             }
                         </div>
                     </div>
                 )}
             </div>

             <div className="flex items-center gap-2 bg-slate-100 pl-2 pr-4 py-1.5 rounded-full">
                 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                     {currentUser.name?.charAt(0)}
                 </div>
                 <div className="text-xs hidden sm:block text-left">
                     <div className="font-bold text-slate-800">{currentUser.name}</div>
                     <div className="text-slate-500">{currentUser.role}</div>
                 </div>
             </div>
             
             <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Déconnexion">
                 <LogOut className="w-5 h-5" />
             </button>
           </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={`
            absolute lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            no-print
        `}>
          <nav className="p-4 space-y-2 border-b border-slate-100">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Calendar className="w-5 h-5" /> {currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT' ? 'Mon Planning' : 'Planning Global'}
            </button>
            
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'MANAGER') && (
                <>
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /> Carnet de Bord</button>
                <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'stats' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><BarChart3 className="w-5 h-5" /> Statistiques</button>
                <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'team' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Users className="w-5 h-5" /> Équipe</button>
                </>
            )}
            
            <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <BriefcaseBusiness className="w-5 h-5" /> {currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT' ? 'Mes Congés' : 'Gestion des Congés'}
            </button>
            
            {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR') && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings className="w-5 h-5" /> Paramètres</button>
            )}
          </nav>

          {/* FILTERS SIDEBAR */}
          {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
              <div className="p-4 space-y-6">
                 <div className="flex items-center gap-2 text-slate-400 uppercase text-xs font-bold tracking-wider">
                     <Filter className="w-3 h-3" /> Filtres & Contexte
                 </div>
                 
                 {/* 1. Service Filter with Improved Counts */}
                 <div className="space-y-3">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                            Service
                        </label>
                        <select 
                            value={activeServiceId} 
                            onChange={(e) => setActiveServiceId(e.target.value)} 
                            className="w-full text-sm border border-slate-300 p-2.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        >
                            <option value="">-- Vue Globale --</option>
                            {servicesList.map(s => {
                                // Count people assigned
                                const count = assignmentsList.filter(a => a.serviceId === s.id).length;
                                return <option key={s.id} value={s.id}>{s.name}</option>;
                            })}
                        </select>
                     </div>

                     {activeService ? (
                         <div className="grid grid-cols-2 gap-2">
                             <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg flex flex-col items-center justify-center text-center">
                                 <div className="text-xl font-bold text-blue-700 leading-none">
                                     {assignmentsList.filter(a => a.serviceId === activeService.id).length}
                                 </div>
                                 <div className="text-[10px] text-blue-600 font-medium uppercase mt-1">Affectés</div>
                             </div>
                             <div className="bg-purple-50 border border-purple-100 p-2 rounded-lg flex flex-col items-center justify-center text-center">
                                 <div className="text-xl font-bold text-purple-700 leading-none">
                                     {activeService.config?.requiredSkills?.length || 0}
                                 </div>
                                 <div className="text-[10px] text-purple-600 font-medium uppercase mt-1">Compétences</div>
                             </div>
                         </div>
                     ) : (
                         <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-center text-xs text-slate-400 italic">
                             Sélectionnez un service pour voir les détails.
                         </div>
                     )}
                 </div>

                 {/* 2. Role Filter - CHECKBOXES */}
                 <div className="space-y-2">
                     <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">Rôles</label>
                        {selectedRoles.length > 0 && (
                            <button onClick={() => setSelectedRoles([])} className="text-[10px] text-blue-600 hover:underline">
                                Effacer
                            </button>
                        )}
                     </div>
                     <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                         {['Infirmier', 'Aide-Soignant', 'Cadre', 'Manager', 'Directeur'].map(role => (
                             <label key={role} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 cursor-pointer select-none">
                                 <input 
                                     type="checkbox"
                                     checked={selectedRoles.includes(role)}
                                     onChange={() => toggleRole(role)}
                                     className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                 />
                                 {role}
                             </label>
                         ))}
                     </div>
                 </div>

                 {/* 3. Skills Filter (Dynamic based on selected Service) */}
                 <div className="space-y-2">
                     <label className="text-xs font-semibold text-slate-700">Compétence</label>
                     <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                         <option value="all">Toutes compétences</option>
                         {activeService 
                            ? activeService.config?.requiredSkills.map(code => <option key={code} value={code}>{code}</option>)
                            : skillsList.map(s => <option key={s.id} value={s.code}>{s.label}</option>)
                         }
                     </select>
                 </div>

                 {/* 4. Qualified Only Switch */}
                 {activeService && (
                     <div className="flex items-center justify-between">
                         <label className="text-xs font-semibold text-slate-700">Qualifiés Uniquement</label>
                         <button 
                            onClick={() => setShowQualifiedOnly(!showQualifiedOnly)}
                            className={`w-10 h-5 rounded-full flex items-center transition-colors px-0.5 ${showQualifiedOnly ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                         >
                            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                         </button>
                     </div>
                 )}

                 <hr className="border-slate-100" />

                 {/* 5. Status Filter */}
                 <div className="space-y-2">
                     <label className="text-xs font-semibold text-slate-700">Statut Période</label>
                     <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                         <option value="all">Tous</option>
                         <option value="present">Présents</option>
                         <option value="absent">Absents</option>
                     </select>
                 </div>

                 {/* 6. Absence Type Filter */}
                 <div className="space-y-2">
                     <label className="text-xs font-semibold text-slate-700">Type d'Absence</label>
                     <select value={absenceTypeFilter} onChange={(e) => setAbsenceTypeFilter(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                         <option value="all">Tout type</option>
                         <option value="CA">Congés (CA)</option>
                         <option value="RTT">RTT</option>
                         <option value="NT">Maladie (NT)</option>
                         <option value="RH">Repos Hebdo (RH)</option>
                     </select>
                 </div>
              </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-slate-100">
             {activeTab === 'planning' && (
                <div className="print-container flex-1 p-2 md:p-4 flex flex-col gap-2 overflow-hidden h-full">
                    {/* View & Actions Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2 no-print">
                        <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                            {(['month', 'week', 'workweek', 'day', 'hourly'] as ViewMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${viewMode === mode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : mode === 'workweek' ? 'Ouvré (5j)' : mode === 'day' ? 'Jour' : 'Horaire'}
                                </button>
                            ))}
                        </div>

                        {(currentUser.role !== 'INFIRMIER' && currentUser.role !== 'AIDE_SOIGNANT') && (
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="p-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50" title="Imprimer PDF">
                                    <Printer className="w-4 h-4" />
                                </button>
                                <button onClick={handleExportCSV} className="p-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50" title="Exporter CSV">
                                    <Download className="w-4 h-4" />
                                </button>
                                <button onClick={handleImportClick} className="p-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50" title="Importer Planning CSV">
                                    <Upload className="w-4 h-4" />
                                </button>
                                <div className="w-px h-8 bg-slate-300 mx-1" />
                                <button onClick={handleCopyPlanning} className="p-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50" title="Copier M-1">
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={handleResetPlanning} className="p-2 bg-white border border-slate-300 text-red-600 rounded hover:bg-red-50" title="Réinitialiser Planning">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={handleGenerateSchedule} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium shadow-sm">
                                    <Wand2 className="w-3 h-3" /> Génération Auto
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                        <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                             <ScheduleGrid employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} viewMode={viewMode} onCellClick={handleCellClick} />
                             {viewMode !== 'hourly' && (
                                 <div className="border-t border-slate-200 bg-slate-50">
                                    <StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />
                                 </div>
                             )}
                        </div>
                        {/* Constraints Sidebar */}
                        {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR') && (
                            <div className="w-80 flex-shrink-0 hidden xl:flex flex-col h-full no-print overflow-hidden">
                                <ConstraintChecker employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} serviceConfig={activeService?.config} />
                            </div>
                        )}
                    </div>
                </div>
             )}
             
             {activeTab === 'stats' && <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />}
             
             {activeTab === 'dashboard' && (
                <div className="flex-1 overflow-y-auto h-full">
                    <Dashboard employees={employees} currentDate={currentDate} serviceConfig={activeService?.config} />
                </div>
             )}

             {activeTab === 'team' && (
                 <TeamManager employees={employees} allSkills={skillsList} currentUser={currentUser} onReload={loadData} />
             )}

             {activeTab === 'leaves' && (
                <div className="flex-1 overflow-y-auto h-full">
                    <LeaveManager employees={employees} onReload={loadData} currentUser={currentUser} />
                </div>
             )}
             
             {activeTab === 'settings' && (
                <div className="flex-1 overflow-y-auto h-full p-8 space-y-8">
                     <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Administration</h3>
                        <p className="text-sm text-slate-500 mb-4">Initialiser les données de démonstration.</p>
                        <button onClick={async () => { await db.seedDatabase(); await loadData(); }} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">Recharger Démo</button>
                    </div>
                    <ServiceSettings service={activeService} onReload={loadData} />
                    <SkillsSettings skills={skillsList} onReload={loadData} />
                </div>
             )}
        </main>

        {/* Shift Editor Modal */}
        {isEditorOpen && selectedCell && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                    <h3 className="font-bold mb-4 text-lg">Modifier Poste</h3>
                    <div className="grid grid-cols-4 gap-2">
                         {Object.values(SHIFT_TYPES).map(t => (
                             <button key={t.code} onClick={() => handleShiftChange(t.code as ShiftCode)} className={`p-2 rounded text-xs font-bold ${t.color} ${t.textColor}`}>
                                {t.code}
                             </button>
                         ))}
                    </div>
                    <button onClick={() => setIsEditorOpen(false)} className="mt-6 w-full border border-slate-300 p-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">Annuler</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default App;