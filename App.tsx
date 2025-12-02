

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText, Menu, Search, UserPlus, LogOut, CheckSquare, Moon } from 'lucide-react';
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
  const [highlightNight, setHighlightNight] = useState(false);

  // Sidebar Mobile State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Notification State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);

  // Generation / Reset Modal State
  const [actionModal, setActionModal] = useState<{ type: 'GENERATE' | 'RESET', isOpen: boolean } | null>(null);
  const [actionMonth, setActionMonth] = useState<number>(new Date().getMonth());
  const [actionYear, setActionYear] = useState<number>(new Date().getFullYear());
  
  // Range Selection State
  const [rangeSelection, setRangeSelection] = useState<{empId: string, start: string, end: string} | null>(null);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

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
      let serviceToSelect = activeServiceId;
      if (role === 'CADRE') {
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
      setToast({ message: "Export CSV généré avec succès.", type: "success" });
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
                  await db.bulkImportEmployees(res.employees);
                  await loadData();
                  setToast({ message: `Import réussi : ${res.stats?.updated} mis à jour, ${res.stats?.created} créés`, type: "success" });
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const openActionModal = (type: 'GENERATE' | 'RESET') => {
      setActionMonth(currentDate.getMonth());
      setActionYear(currentDate.getFullYear());
      setActionModal({ type, isOpen: true });
  };

  const confirmAction = async () => {
      if (!actionModal) return;

      const targetDate = new Date(actionYear, actionMonth, 1);
      const monthName = targetDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      setActionModal(null); 
      setIsLoading(true);

      try {
          if (actionModal.type === 'GENERATE') {
               const newEmps = generateMonthlySchedule(employees, actionYear, actionMonth, activeService?.config);
               await db.bulkSaveSchedule(newEmps);
               await loadData();
               setToast({ message: `Planning de ${monthName} généré avec succès`, type: "success" });
          } else {
               await db.clearShiftsInRange(actionYear, actionMonth, activeServiceId || undefined);
               await loadData();
               setToast({ message: `Planning de ${monthName} réinitialisé ${activeServiceId ? 'pour le service' : 'globalement'}.`, type: "success" });
          }
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
        const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
        const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
        
        let qualificationMatch = true;
        if (showQualifiedOnly && activeService?.config?.requiredSkills?.length > 0) {
            const reqSkills = activeService.config.requiredSkills;
            qualificationMatch = emp.skills.some(s => reqSkills.includes(s));
        }

        let assignmentMatch = true;
        if (activeServiceId && assignmentsList.length > 0) {
            const empAssignments = assignmentsList.filter(a => a.employeeId === emp.id && a.serviceId === activeServiceId);
            if (activeServiceId) {
                if (empAssignments.length === 0) assignmentMatch = false;
            }
        }

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
            else if (statusFilter === 'absent') statusMatch = !hasWork;
            
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

  const handleRangeSelect = async (empId: string, start: string, end: string, forcedCode?: ShiftCode) => {
     if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'DIRECTOR') return;
     
     if (forcedCode) {
         // Smart Drag Extension (No Modal)
         try {
             const startDate = new Date(start);
             const endDate = new Date(end);
             const shiftsToUpdate = [];
             for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                 shiftsToUpdate.push({
                     employee_id: empId,
                     date: d.toISOString().split('T')[0],
                     shift_code: forcedCode
                 });
             }
             await db.bulkUpsertShifts(shiftsToUpdate);
             loadData();
             setToast({ message: "Extension rapide effectuée", type: "success" });
         } catch(e: any) {
             setToast({ message: "Erreur extension: " + e.message, type: "error" });
         }
     } else {
         // Standard Selection (Open Modal)
         setRangeSelection({ empId, start, end });
         setIsRangeModalOpen(true);
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
    try {
      if (isRangeModalOpen && rangeSelection) {
         // BULK UPDATE FOR RANGE
         const start = new Date(rangeSelection.start);
         const end = new Date(rangeSelection.end);
         const shiftsToUpdate = [];
         
         for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            shiftsToUpdate.push({
                employee_id: rangeSelection.empId,
                date: dateStr,
                shift_code: code
            });
         }
         
         await db.bulkUpsertShifts(shiftsToUpdate);
         setToast({ message: "Plage modifiée avec succès", type: "success" });
         setIsRangeModalOpen(false);
         setRangeSelection(null);

      } else if (selectedCell) {
         // SINGLE UPDATE
         await db.upsertShift(selectedCell.empId, selectedCell.date, code);
         setToast({ message: "Poste mis à jour", type: "success" });
         setIsEditorOpen(false);
      }
      
      loadData(); 
    } catch (error: any) {
      setToast({ message: `Erreur: ${error.message}`, type: "error" });
    }
  };

  const handleNotificationAction = (notif: AppNotification) => {
      db.markNotificationRead(notif.id).then(() => {
          loadNotifications();
      });

      if (notif.actionType === 'LEAVE_VALIDATION') {
          setActiveTab('leaves');
          setIsNotifOpen(false);
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
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
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
           {(activeTab === 'planning' || activeTab === 'dashboard' || activeTab === 'leaves') && (
               <div className="flex items-center gap-2">
                   <h2 className="text-lg font-bold text-slate-700 capitalize hidden md:block w-40 text-right">
                       {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                   </h2>
                   
                   <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 relative gap-1">
                     <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                     
                     <div className="relative group flex items-center">
                         <Calendar className="w-4 h-4 text-slate-500 absolute left-2 pointer-events-none" />
                         <input 
                            type="date" 
                            className="pl-8 pr-2 py-1 bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer w-[130px]"
                            onChange={handleDateSelect}
                            value={currentDate.toISOString().split('T')[0]}
                         />
                     </div>

                     <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                   </div>
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
                         <div className="p-3 bg-slate-50 border-b font-semibold text-sm flex justify-between">
                             <span>Notifications</span>
                             {unreadNotifs > 0 && <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs flex items-center">{unreadNotifs}</span>}
                         </div>
                         <div className="max-h-80 overflow-y-auto">
                             {appNotifications.length === 0 ? <div className="p-4 text-slate-400 text-sm text-center">Rien à signaler.</div> : 
                                appNotifications.map(n => (
                                    <div key={n.id} className={`p-3 border-b text-sm hover:bg-slate-50 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                                        <div className="font-bold text-slate-800 mb-1">{n.title}</div>
                                        <div className="text-slate-600 mb-2">{n.message}</div>
                                        {n.actionType === 'LEAVE_VALIDATION' && (
                                            <button 
                                                onClick={() => handleNotificationAction(n)}
                                                className="w-full text-center bg-white border border-blue-200 text-blue-600 text-xs py-1.5 rounded hover:bg-blue-50 font-medium"
                                            >
                                                Traiter la demande
                                            </button>
                                        )}
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
            absolute lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out
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
                <Coffee className="w-5 h-5" /> Gestion des Congés
            </button>
            
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR') && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings className="w-5 h-5" /> Paramètres</button>
            )}
          </nav>

          {/* FILTERS PANEL */}
          <div className="p-4 space-y-6">
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Store className="w-3 h-3" /> Service
                  </h3>
                  <select 
                      value={activeServiceId} 
                      onChange={(e) => setActiveServiceId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      {servicesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      <option value="">Vue Globale (Tous)</option>
                  </select>
                  
                  {activeService && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="bg-blue-50 p-2 rounded border border-blue-100 text-center">
                              <div className="text-xs text-blue-500 font-medium">Effectifs</div>
                              <div className="text-lg font-bold text-blue-700">
                                  {assignmentsList.filter(a => a.serviceId === activeServiceId).length}
                              </div>
                          </div>
                          <div className="bg-purple-50 p-2 rounded border border-purple-100 text-center">
                              <div className="text-xs text-purple-500 font-medium">Compétences</div>
                              <div className="text-lg font-bold text-purple-700">
                                  {activeService.config?.requiredSkills?.length || 0}
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <BriefcaseBusiness className="w-3 h-3" /> Rôles
                  </h3>
                  <div className="space-y-1">
                      {['Infirmier', 'Aide-Soignant', 'Cadre', 'Manager', 'Directeur'].map(role => (
                          <label key={role} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                              <input 
                                  type="checkbox" 
                                  checked={selectedRoles.includes(role)}
                                  onChange={() => toggleRole(role)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                              />
                              {role}
                          </label>
                      ))}
                  </div>
                  {selectedRoles.length > 0 && (
                      <button onClick={() => setSelectedRoles([])} className="text-xs text-blue-600 mt-2 hover:underline">
                          Réinitialiser
                      </button>
                  )}
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <CheckSquare className="w-3 h-3" /> Compétences
                  </h3>
                  <select 
                      value={skillFilter} 
                      onChange={(e) => setSkillFilter(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm mb-2"
                  >
                      <option value="all">Toutes</option>
                      {activeServiceId 
                         ? activeService?.config.requiredSkills.map(code => {
                             const sk = skillsList.find(s => s.code === code);
                             return <option key={code} value={code}>{sk ? sk.label : code}</option>;
                         })
                         : skillsList.map(s => <option key={s.id} value={s.code}>{s.label}</option>)
                      }
                  </select>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input 
                          type="checkbox" 
                          checked={showQualifiedOnly} 
                          onChange={(e) => setShowQualifiedOnly(e.target.checked)}
                          className="rounded text-blue-600"
                      />
                      Qualifiés uniquement
                  </label>
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statut (Période)</h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                          onClick={() => setStatusFilter('all')} 
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'all' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          Tous
                      </button>
                      <button 
                          onClick={() => setStatusFilter('present')} 
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'present' ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <UserCheck className="w-3 h-3 mx-auto" />
                      </button>
                      <button 
                          onClick={() => setStatusFilter('absent')} 
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'absent' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <UserX className="w-3 h-3 mx-auto" />
                      </button>
                  </div>
              </div>

              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Type d'absence</h3>
                  <div className="flex flex-wrap gap-1.5">
                      <button 
                          onClick={() => setAbsenceTypeFilter('all')}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${absenceTypeFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                          Tous
                      </button>
                      {['CA', 'RTT', 'NT', 'RH', 'RC', 'HS', 'FO', 'F'].map(type => (
                          <button
                              key={type}
                              onClick={() => setAbsenceTypeFilter(type)}
                              className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium ${
                                  absenceTypeFilter === type 
                                  ? 'bg-blue-100 text-blue-700 border-blue-200 ring-1 ring-blue-200' 
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>

          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">
           {activeTab === 'planning' && (
             <>
               {/* TOOLBAR */}
               <div className="bg-white border-b border-slate-200 p-2 flex items-center gap-2 justify-between flex-wrap no-print">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Mois</button>
                      <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Semaine</button>
                      <button onClick={() => setViewMode('workweek')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'workweek' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ouvrée</button>
                      <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Jour</button>
                      <button onClick={() => setViewMode('hourly')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hourly' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Horaire</button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                       {/* Night Spotlight Toggle */}
                       <button
                           onClick={() => setHighlightNight(!highlightNight)}
                           className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-medium ${
                               highlightNight 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' 
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                           }`}
                           title="Mettre en évidence les postes de Nuit (S)"
                       >
                           <Moon className="w-3.5 h-3.5" />
                           {!highlightNight ? 'Nuit' : 'Nuit Active'}
                       </button>

                       {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                        <>
                           <div className="h-6 w-px bg-slate-300 mx-1"></div>
                           
                           <button onClick={handlePrint} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200" title="Imprimer"><Printer className="w-4 h-4" /></button>
                           <button onClick={handleExportCSV} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200" title="Exporter CSV"><FileDown className="w-4 h-4" /></button>
                           <button onClick={handleImportClick} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200" title="Importer CSV"><Upload className="w-4 h-4" /></button>
                           <button onClick={() => openActionModal('RESET')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-slate-200" title="Réinitialiser Planning"><Trash2 className="w-4 h-4" /></button>
                           <button onClick={handleCopyPlanning} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200" title="Copier M-1"><Copy className="w-4 h-4" /></button>
                           <button onClick={() => openActionModal('GENERATE')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors">
                              <Wand2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Générer Auto</span>
                           </button>
                        </>
                       )}
                  </div>
               </div>

               {/* MAIN GRID */}
               <div className="flex-1 overflow-hidden flex flex-col p-4">
                  <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                     <ScheduleGrid 
                        employees={filteredEmployees} 
                        startDate={gridStartDate} 
                        days={gridDuration} 
                        viewMode={viewMode}
                        onCellClick={handleCellClick}
                        onRangeSelect={handleRangeSelect}
                        highlightNight={highlightNight}
                     />
                  </div>
                  {/* SUMMARY FOOTER */}
                  {(viewMode !== 'hourly' && viewMode !== 'day') && (
                      <div className="mt-4">
                          <StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />
                      </div>
                  )}
               </div>

               {/* CONSTRAINT PANEL (SIDE SPLIT) */}
               {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE') && (
                  <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto hidden xl:block p-4">
                      <ConstraintChecker 
                          employees={filteredEmployees} 
                          startDate={gridStartDate} 
                          days={gridDuration} 
                          serviceConfig={activeService?.config} 
                      />
                  </div>
               )}
             </>
           )}

           {activeTab === 'dashboard' && <Dashboard employees={employees} currentDate={currentDate} serviceConfig={activeService?.config} />}
           {activeTab === 'stats' && <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />}
           {activeTab === 'team' && <TeamManager employees={employees} allSkills={skillsList} currentUser={currentUser} onReload={loadData} />}
           {activeTab === 'leaves' && <LeaveManager employees={employees} onReload={loadData} currentUser={currentUser} activeServiceId={activeServiceId} assignmentsList={assignmentsList} />}
           {activeTab === 'settings' && (
               <div className="p-6 max-w-6xl mx-auto space-y-6 w-full overflow-y-auto">
                   <h2 className="text-2xl font-bold text-slate-800">Paramètres Généraux</h2>
                   <SkillsSettings skills={skillsList} onReload={loadData} />
                   <ServiceSettings service={activeService} onReload={loadData} />
               </div>
           )}
        </main>
      </div>

      {/* SHIFT EDITOR MODAL (SINGLE CELL) */}
      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setIsEditorOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800">Modifier le poste</h3>
               <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border">
                Modification pour <span className="font-semibold text-slate-700">{employees.find(e => e.id === selectedCell.empId)?.name}</span> le <span className="font-semibold text-slate-700">{selectedCell.date}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
              {Object.values(SHIFT_TYPES).map((shift) => (
                <button
                  key={shift.code}
                  onClick={() => handleShiftChange(shift.code as ShiftCode)}
                  className={`p-2 rounded border text-xs font-bold transition-all hover:scale-105 ${shift.color} ${shift.textColor} border-transparent hover:shadow-md`}
                  title={shift.description}
                >
                  {shift.code}
                </button>
              ))}
              <button
                  onClick={() => handleShiftChange('OFF')}
                  className="p-2 rounded border border-dashed border-slate-300 text-slate-400 text-xs font-bold hover:bg-slate-50 hover:text-slate-600 col-span-4 mt-2"
              >
                  Effacer (Vide)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RANGE EDITOR MODAL */}
      {isRangeModalOpen && rangeSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setIsRangeModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800">Modifier la plage</h3>
               <button onClick={() => setIsRangeModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <div className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border">
                <div className="font-semibold text-slate-700 mb-1">{employees.find(e => e.id === rangeSelection.empId)?.name}</div>
                <div>Du <span className="font-mono text-slate-600">{rangeSelection.start}</span> au <span className="font-mono text-slate-600">{rangeSelection.end}</span></div>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
              {Object.values(SHIFT_TYPES).map((shift) => (
                <button
                  key={shift.code}
                  onClick={() => handleShiftChange(shift.code as ShiftCode)}
                  className={`p-2 rounded border text-xs font-bold transition-all hover:scale-105 ${shift.color} ${shift.textColor} border-transparent hover:shadow-md`}
                  title={shift.description}
                >
                  {shift.code}
                </button>
              ))}
              <button
                  onClick={() => handleShiftChange('OFF')}
                  className="p-2 rounded border border-dashed border-slate-300 text-slate-400 text-xs font-bold hover:bg-slate-50 hover:text-slate-600 col-span-4 mt-2"
              >
                  Effacer la plage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATION / RESET MODAL */}
      {actionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setActionModal(null)}>
              <div className="bg-white rounded-xl shadow-2xl p-8 w-[400px] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-6">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${actionModal.type === 'GENERATE' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                          {actionModal.type === 'GENERATE' ? <Wand2 className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">
                          {actionModal.type === 'GENERATE' ? 'Génération Automatique' : 'Réinitialisation'}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2">
                          Veuillez confirmer la période cible pour cette action.
                      </p>
                  </div>

                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mois</label>
                          <select 
                              value={actionMonth} 
                              onChange={(e) => setActionMonth(parseInt(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              {Array.from({length: 12}, (_, i) => (
                                  <option key={i} value={i}>{new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Année</label>
                          <input 
                              type="number" 
                              value={actionYear} 
                              onChange={(e) => setActionYear(parseInt(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                          />
                      </div>
                  </div>

                  {actionModal.type === 'RESET' && activeService && (
                      <div className="mb-6 p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>Attention : Seuls les plannings du service <strong>{activeService.name}</strong> seront effacés.</span>
                      </div>
                  )}

                  <div className="flex gap-3">
                      <button 
                          onClick={() => setActionModal(null)}
                          className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                      >
                          Annuler
                      </button>
                      <button 
                          onClick={confirmAction}
                          disabled={isLoading}
                          className={`flex-1 py-2.5 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 ${
                              actionModal.type === 'GENERATE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                          }`}
                      >
                          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Confirmer
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;