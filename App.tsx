
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText, Menu, Search, UserPlus, LogOut, CheckSquare, Heart, AlertTriangle, Moon, Sun, Flag, CalendarClock, Layers, MessageSquare } from 'lucide-react';
import { ScheduleGrid } from './components/ScheduleGrid';
import { StaffingSummary } from './components/StaffingSummary';
import { StatsPanel } from './components/StatsPanel';
import { ConstraintChecker } from './components/ConstraintChecker';
import { LeaveManager } from './components/LeaveManager';
import { TeamManager } from './components/TeamManager';
import { SkillsSettings } from './components/SkillsSettings';
import { ServiceSettings } from './components/ServiceSettings';
import { RoleSettings } from './components/RoleSettings';
import { RuleSettings } from './components/RuleSettings';
import { ShiftCodeSettings } from './components/ShiftCodeSettings';
import { AttractivityPanel } from './components/AttractivityPanel';
import { HazardManager } from './components/HazardManager';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { ScenarioPlanner } from './components/ScenarioPlanner';
import { CycleViewer } from './components/CycleViewer';
import { SatisfactionSurveyModal } from './components/SatisfactionSurveyModal';
import { SurveyResults } from './components/SurveyResults';
import { SHIFT_TYPES } from './constants';
import { Employee, ShiftCode, ViewMode, Skill, Service, LeaveData, ServiceAssignment, LeaveCounters, UserRole, AppNotification, ConstraintViolation, WorkPreference } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';
import { exportScheduleToCSV } from './utils/csvExport';
import { Toast } from './components/Toast';
import { checkConstraints } from './utils/validation';
import * as db from './services/db';
import * as notifications from './utils/notifications';
import { getHolidayName } from './utils/holidays';

function App() {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<{ role: UserRole, employeeId?: string, name?: string } | null>(null);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState<'planning' | 'stats' | 'team' | 'leaves' | 'settings' | 'dashboard' | 'scenarios' | 'attractivity' | 'cycles' | 'surveys'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [highlightNight, setHighlightNight] = useState(false);
  
  // Highlight Violations State
  const [violationHighlights, setViolationHighlights] = useState<ConstraintViolation[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<ServiceAssignment[]>([]);
  const [preferences, setPreferences] = useState<WorkPreference[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string>('');
  
  const [selectedCell, setSelectedCell] = useState<{empId: string, date: string} | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  // Filter States
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'holiday'>('all');
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState<string>('all');

  // Sidebar Mobile State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Sidebar Desktop Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHazardOpen, setIsHazardOpen] = useState(false);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false); // Survey Modal State
  
  // Notification State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);

  // Generation / Reset Modal State
  const [actionModal, setActionModal] = useState<{ type: 'GENERATE' | 'RESET', isOpen: boolean } | null>(null);
  const [actionMonth, setActionMonth] = useState<number>(new Date().getMonth());
  const [actionYear, setActionYear] = useState<number>(new Date().getFullYear());
  
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

  // Apply Dark Mode Class
  useEffect(() => {
      if (isDarkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // RANDOM SURVEY TRIGGER LOGIC
  useEffect(() => {
      if (currentUser && currentUser.employeeId && currentUser.role !== 'ADMIN' && currentUser.role !== 'DIRECTOR') {
          // 30% chance to show survey on login/load if user is a standard employee
          const shouldShow = Math.random() < 0.3; 
          if (shouldShow) {
              // Optional: Add logic to check if they already answered recently to avoid spam
              // For now, simple random trigger
              setTimeout(() => setIsSurveyOpen(true), 2000); // Delay slightly for better UX
          }
      }
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empData, skillsData, servicesData, assignData, prefsData] = await Promise.all([
          db.fetchEmployeesWithShifts(),
          db.fetchSkills(),
          db.fetchServices(),
          db.fetchServiceAssignments(),
          db.fetchWorkPreferences()
      ]);
      setEmployees(empData);
      setSkillsList(skillsData);
      setServicesList(servicesData);
      setAssignmentsList(assignData);
      setPreferences(prefsData.filter(p => p.status === 'VALIDATED')); // Only active preferences
      
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
      const now = new Date().getTime();
      const filtered = allNotifs.filter(n => {
          const isTarget = n.recipientRole === 'ALL' || 
                           n.recipientRole === currentUser?.role ||
                           (n.recipientId && n.recipientId === currentUser?.employeeId);
          if (!isTarget) return false;
          if (n.isRead) {
              const notifTime = new Date(n.date).getTime();
              const diffHours = (now - notifTime) / (1000 * 60 * 60);
              if (diffHours > 24) return false;
          }
          return true;
      });
      setAppNotifications(filtered);
  };

  const handleLogin = (role: UserRole, employee?: Employee) => {
      let serviceToSelect = activeServiceId;
      // If employee belongs to a service, select it by default
      if (employee) {
          const myAssignment = assignmentsList.find(a => a.employeeId === employee.id);
          if (myAssignment) serviceToSelect = myAssignment.serviceId;
          // If manager/cadre with no assignment, maybe default to first service
          else if (['CADRE', 'CADRE_SUP', 'MANAGER'].includes(role) && servicesList.length > 0) {
              serviceToSelect = servicesList[0].id;
          }
      }
      setActiveServiceId(serviceToSelect);
      setCurrentUser({
          role,
          employeeId: employee?.id,
          name: employee ? employee.name : (role === 'ADMIN' ? 'Administrateur' : 'Directeur / Directrice')
      });
      if (role === 'INFIRMIER' || role === 'AIDE_SOIGNANT') {
          setActiveTab('planning');
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
               const scopeEmployees = activeServiceId ? filteredEmployees : employees;
               const newEmps = await generateMonthlySchedule(scopeEmployees, actionYear, actionMonth, activeService?.config);
               await db.bulkSaveSchedule(newEmps);
               await loadData();
               setToast({ message: `Planning de ${monthName} généré avec succès pour ${scopeEmployees.length} employés.`, type: "success" });
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

  const toggleRoleFilter = (role: string) => {
      setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  // --- Violation Navigation ---
  const handleViewPlanningWithHighlights = (violations: ConstraintViolation[]) => {
      setViolationHighlights(violations);
      setActiveTab('planning');
      setViewMode('month');
      setToast({ message: "Violations mises en évidence.", type: 'warning' });
  };

  // --- Filter Logic ---
  const { start: gridStartDate, days: gridDuration } = useMemo(() => {
      const d = new Date(currentDate);
      if (viewMode === 'day' || viewMode === 'hourly') return { start: d, days: 1 };
      
      if (viewMode === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return { start: monday, days: 7 };
      }
      if (viewMode === 'workweek') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return { start: monday, days: 5 };
      }
      if (viewMode === 'workweek6') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return { start: monday, days: 6 };
      }

      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return { start, days: daysInMonth };
  }, [currentDate, viewMode]);

  const filteredEmployees = useMemo(() => {
      return employees.filter(emp => {
        const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
        const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
        let qualificationMatch = true;
        if (showQualifiedOnly && activeService?.config) {
            const reqSkills = activeService.config.requiredSkills || [];
            if (reqSkills.length > 0) {
                qualificationMatch = emp.skills.some(s => reqSkills.includes(s));
            }
        }
        let assignmentMatch = true;
        if (activeServiceId) {
            const isAssigned = assignmentsList.some(a => a.employeeId === emp.id && a.serviceId === activeServiceId);
            if (!isAssigned) {
                assignmentMatch = false;
            }
        } else {
            assignmentMatch = true;
        }

        let statusMatch = true;
        let absenceTypeMatch = true;
        
        if (statusFilter !== 'all' || absenceTypeFilter !== 'all') {
            let hasWork = false;
            let hasSpecificAbsence = false;
            let hasAnyAbsence = false;
            let hasWorkOnHoliday = false;

            for (let i = 0; i < gridDuration; i++) {
                const d = new Date(gridStartDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const code = emp.shifts[dateStr];
                
                if (getHolidayName(d)) {
                    if (code && SHIFT_TYPES[code]?.isWork) hasWorkOnHoliday = true;
                }

                if (code && code !== 'OFF') {
                    const isWork = SHIFT_TYPES[code]?.isWork;
                    if (isWork) hasWork = true;
                    else hasAnyAbsence = true;

                    if (code === absenceTypeFilter) hasSpecificAbsence = true;
                }
            }
            if (statusFilter === 'present' && !hasWork) statusMatch = false;
            if (statusFilter === 'absent' && !hasAnyAbsence) statusMatch = false; 
            if (statusFilter === 'holiday' && !hasWorkOnHoliday) statusMatch = false;
            
            if (absenceTypeFilter !== 'all' && !hasSpecificAbsence) absenceTypeMatch = false;
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
    } else if (viewMode === 'week' || viewMode.startsWith('workweek')) {
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
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'CADRE_SUP' && currentUser?.role !== 'DIRECTOR') {
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
      setIsEditorOpen(false);
      loadData(); 
    } catch (error: any) {
      setToast({ message: `Erreur: ${error.message}`, type: "error" });
    }
  };

  const handleRangeSelect = async (empId: string, startDate: string, endDate: string, forcedCode?: ShiftCode) => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'CADRE_SUP' && currentUser?.role !== 'DIRECTOR') {
        setToast({ message: "Modification de masse non autorisée.", type: "warning" });
        return;
    }
    if (!forcedCode) return;
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dates: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        await db.bulkUpsertShifts(dates.map(date => ({ employee_id: empId, date, shift_code: forcedCode })));
        setToast({ message: "Plage mise à jour avec succès", type: "success" });
        loadData();
    } catch (e: any) {
        setToast({ message: "Erreur: " + e.message, type: "error" });
    }
  };

  const handleNotificationAction = (notif: AppNotification) => {
      db.markNotificationRead(notif.id).then(() => loadNotifications());
      if (notif.actionType === 'LEAVE_VALIDATION') {
          setActiveTab('leaves');
          setIsNotifOpen(false);
      }
  };

  if (!currentUser) return <LoginScreen employees={employees} onLogin={handleLogin} />;

  const unreadNotifs = appNotifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 font-sans transition-colors duration-300">
      <style>{`@media print { 
        @page { size: landscape; margin: 5mm; } 
        body { 
          background: white; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        } 
        aside, header, .no-print { display: none !important; } 
        .print-container { overflow: visible !important; height: auto !important; } 
        table { width: 100% !important; } 
      }`}</style>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* SATISFACTION SURVEY MODAL */}
      <SatisfactionSurveyModal 
          isOpen={isSurveyOpen} 
          onClose={() => setIsSurveyOpen(false)} 
          employeeId={currentUser.employeeId || ''} 
      />

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

      {/* HEADER ... (rest of header identical) */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-40 no-print">
        {/* ... Header Content ... */}
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="bg-blue-600 p-2 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-lg font-bold text-slate-800 dark:text-white leading-tight hidden sm:block">OptiPlan</h1><p className="text-xs text-slate-500 dark:text-slate-400">{activeService ? activeService.name : 'Vue Globale'}</p></div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           {(activeTab === 'planning' || activeTab === 'dashboard' || activeTab === 'leaves' || activeTab === 'scenarios') && (
               <div className="flex items-center gap-2">
                   <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 capitalize hidden md:block w-40 text-right">{currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
                   <div className="flex items-center bg-slate-50 dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600 relative gap-1">
                     <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded" onClick={() => handleDateNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                     <div className="relative group flex items-center">
                         <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-2 pointer-events-none" />
                         <input type="date" className="pl-8 pr-2 py-1 bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer w-[130px]" onChange={handleDateSelect} value={currentDate.toISOString().split('T')[0]} />
                     </div>
                     <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded" onClick={() => handleDateNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                   </div>
               </div>
           )}
           {/* ... rest of header buttons ... */}
           <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden md:block"></div>
           <div className="flex items-center gap-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-600 dark:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                 {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
             </button>
             
             {/* Notifs etc */}
             <div className="relative">
                 <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                     <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                     {unreadNotifs > 0 && (
                         <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-800 min-w-[18px] text-center flex items-center justify-center h-5">
                             {unreadNotifs}
                         </span>
                     )}
                 </button>
                 {isNotifOpen && (
                     <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 z-50 overflow-hidden">
                         <div className="p-3 bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600 font-semibold text-sm flex justify-between dark:text-white">
                             <span>Notifications</span>
                             {unreadNotifs > 0 && <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs flex items-center">{unreadNotifs}</span>}
                         </div>
                         <div className="max-h-80 overflow-y-auto">
                             {appNotifications.length === 0 ? <div className="p-4 text-slate-400 text-sm text-center">Rien à signaler.</div> : 
                                appNotifications.map(n => (
                                    <div key={n.id} className={`p-3 border-b dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                                        <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{n.title}</div>
                                        <div className="text-slate-600 dark:text-slate-400 mb-2">{n.message}</div>
                                        {n.actionType === 'LEAVE_VALIDATION' && (
                                            <button onClick={() => handleNotificationAction(n)} className="w-full text-center bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-xs py-1.5 rounded hover:bg-blue-50 font-medium">Traiter la demande</button>
                                        )}
                                    </div>
                                ))
                             }
                         </div>
                     </div>
                 )}
             </div>
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 pl-2 pr-4 py-1.5 rounded-full">
                 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">{currentUser.name?.charAt(0)}</div>
                 <div className="text-xs hidden sm:block text-left">
                     <div className="font-bold text-slate-800 dark:text-slate-200">{currentUser.name}</div>
                     <div className="text-slate-500 dark:text-slate-400">{currentUser.role === 'DIRECTOR' ? 'Directeur' : currentUser.role}</div>
                 </div>
             </div>
             <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Déconnexion"><LogOut className="w-5 h-5" /></button>
           </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR ... (identical) */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 text-white border-r border-slate-700 flex flex-col overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72 no-print lg:shadow-none`}>
          {/* ... Sidebar Navigation ... */}
          <div className="hidden lg:flex justify-end p-2 border-b border-slate-800">
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                 {isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}
             </button>
          </div>

          <nav className="p-2 space-y-2 border-b border-slate-700">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'planning' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Planning" : ""}>
                <Calendar className="w-5 h-5 flex-shrink-0" /> 
                {!isSidebarCollapsed && <span>{currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT' ? 'Mon Planning' : 'Planning Global'}</span>}
            </button>
            <button onClick={() => setActiveTab('cycles')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'cycles' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Cycles & Horaires" : ""}>
                <CalendarClock className="w-5 h-5 flex-shrink-0" /> 
                {!isSidebarCollapsed && <span>Cycles & Horaires</span>}
            </button>
            
            {/* ... other tabs ... */}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'CADRE_SUP' || currentUser.role === 'MANAGER') && (
                <>
                <button onClick={() => setActiveTab('scenarios')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'scenarios' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Scénarios" : ""}>
                    <Wand2 className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Scénarios & IA</span>}
                </button>
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Tableau de bord" : ""}>
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Carnet de Bord</span>}
                </button>
                <button onClick={() => setActiveTab('attractivity')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'attractivity' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Attractivité" : ""}>
                    <Heart className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Attractivité & QVT</span>}
                </button>
                <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Statistiques" : ""}>
                    <BarChart3 className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Statistiques</span>}
                </button>
                <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'team' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Équipe" : ""}>
                    <Users className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Équipe</span>}
                </button>
                </>
            )}
            <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'leaves' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Congés" : ""}>
                <Coffee className="w-5 h-5 flex-shrink-0" /> 
                {!isSidebarCollapsed && <span>Gestion des Congés</span>}
            </button>
            {(currentUser.role === 'ADMIN') && (
                <button onClick={() => setActiveTab('surveys')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'surveys' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Résultats QVT" : ""}>
                    <MessageSquare className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Résultats QVT</span>}
                </button>
            )}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'CADRE_SUP') && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Paramètres" : ""}>
                    <Settings className="w-5 h-5 flex-shrink-0" /> 
                    {!isSidebarCollapsed && <span>Paramètres</span>}
                </button>
            )}
          </nav>
          
          {/* ... Sidebar Filters ... (Same as original) */}
          {!isSidebarCollapsed && (
              <div className="p-4 space-y-6 animate-in fade-in duration-300">
                  <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Store className="w-3 h-3" /> Service</h3>
                      
                      {/* NEW SERVICE SELECTOR LIST */}
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          <button 
                              onClick={() => setActiveServiceId('')}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${activeServiceId === '' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}
                          >
                              <div className="font-bold text-sm">Vue Globale</div>
                              <div className="text-xs opacity-70 mt-1">Tous les services</div>
                          </button>

                          {servicesList.map(s => {
                              const empCount = assignmentsList.filter(a => a.serviceId === s.id).length;
                              const skillCount = s.config?.requiredSkills?.length || 0;
                              const isActive = activeServiceId === s.id;

                              return (
                                  <button
                                      key={s.id}
                                      onClick={() => setActiveServiceId(s.id)}
                                      className={`w-full text-left p-3 rounded-lg border transition-all ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}
                                  >
                                      <div className="font-bold text-sm mb-2">{s.name}</div>
                                      <div className="flex gap-3 text-[10px]">
                                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-500' : 'bg-slate-900'}`}>
                                              <Users className="w-3 h-3" /> {empCount}
                                          </div>
                                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-500' : 'bg-slate-900'}`}>
                                              <Tag className="w-3 h-3" /> {skillCount}
                                          </div>
                                      </div>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
                  
                  {/* FILTERS */}
                  <div className="space-y-4">
                      {/* ROLES */}
                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Briefcase className="w-3 h-3" /> Rôles</h3>
                          <div className="space-y-1">
                              {['Infirmier', 'Aide-Soignant', 'Cadre', 'Cadre Supérieur', 'Manager', 'Directeur'].map(role => (
                                  <label key={role} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white">
                                      <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRoleFilter(role)} className="rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600" />
                                      {role}
                                  </label>
                              ))}
                          </div>
                      </div>

                      {/* COMPETENCES */}
                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckSquare className="w-3 h-3" /> Compétences</h3>
                          <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm mb-2 text-slate-200 outline-none">
                              <option value="all">Toutes</option>
                              {skillsList.map(s => <option key={s.id} value={s.code}>{s.code} - {s.label}</option>)}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white">
                              <input type="checkbox" checked={showQualifiedOnly} onChange={(e) => setShowQualifiedOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600" />
                              Qualifiés uniquement
                          </label>
                      </div>

                      {/* STATUT */}
                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Statut (Période)</h3>
                          <div className="flex flex-wrap gap-1">
                              <button onClick={() => setStatusFilter('all')} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                  <Users className="w-3 h-3" /> Tous
                              </button>
                              <button onClick={() => setStatusFilter('present')} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${statusFilter === 'present' ? 'bg-green-600 text-white border-green-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                  <UserCheck className="w-3 h-3" /> Présents
                              </button>
                              <button onClick={() => setStatusFilter('absent')} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${statusFilter === 'absent' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                  <UserX className="w-3 h-3" /> Absents
                              </button>
                              <button onClick={() => setStatusFilter('holiday')} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${statusFilter === 'holiday' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                  <Flag className="w-3 h-3" /> Fériés
                              </button>
                          </div>
                      </div>

                      {/* ABSENCE TYPES */}
                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type d'absence</h3>
                          <div className="flex flex-wrap gap-1">
                              <button onClick={() => setAbsenceTypeFilter('all')} className={`px-2 py-1 rounded-full text-xs border ${absenceTypeFilter === 'all' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>Tous</button>
                              {['CA', 'RTT', 'MAL', 'RH', 'RC', 'HS', 'FO', 'F'].map(code => (
                                  <button key={code} onClick={() => setAbsenceTypeFilter(code)} className={`px-2 py-1 rounded-full text-xs border ${absenceTypeFilter === code ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>{code}</button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50 dark:bg-slate-900/50">
           {activeTab === 'planning' && (
             <>
               {/* Planning specific header and grid */}
               <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2 justify-between flex-wrap no-print">
                  {/* ... (View mode buttons) ... */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                      <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Mois</button>
                      <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Semaine</button>
                      <button onClick={() => setViewMode('workweek')} title="Semaine Ouvrée (5 jours)" className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'workweek' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Ouvré</button>
                      <button onClick={() => setViewMode('workweek6')} title="Semaine Ouvrable (6 jours)" className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'workweek6' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Ouvrable</button>
                      <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Journée</button>
                      <button onClick={() => setViewMode('hourly')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hourly' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Horaires</button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                       <button 
                           onClick={() => setHighlightNight(!highlightNight)}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${highlightNight ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                       >
                           <Moon className="w-3.5 h-3.5" /> Nuit Active
                       </button>

                       {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'CADRE_SUP' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                        <>
                           <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                           <button onClick={handlePrint} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Imprimer"><Printer className="w-4 h-4" /></button>
                           <button onClick={handleExportCSV} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Export CSV"><Download className="w-4 h-4" /></button>
                           <button onClick={handleImportClick} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Import CSV"><Upload className="w-4 h-4" /></button>
                           
                           <button onClick={handleCopyPlanning} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Copier M-1"><Copy className="w-4 h-4" /></button>
                           
                           <button onClick={() => openActionModal('RESET')} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800" title="Réinitialiser"><Trash2 className="w-4 h-4" /></button>

                           <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

                           <button onClick={() => setIsHazardOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 shadow-sm transition-colors">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Gérer Aléa</span>
                           </button>
                           <button onClick={() => openActionModal('GENERATE')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors">
                              <Wand2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Générer Auto</span>
                           </button>
                        </>
                       )}
                  </div>
               </div>

               {/* ... (rest of App.tsx remains the same) ... */}
               <div className="flex-1 overflow-hidden flex flex-col p-4">
                  <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col">
                     <ScheduleGrid 
                        employees={filteredEmployees} 
                        startDate={gridStartDate} 
                        days={gridDuration} 
                        viewMode={viewMode} 
                        onCellClick={handleCellClick} 
                        onRangeSelect={handleRangeSelect}
                        highlightNight={highlightNight} 
                        highlightedViolations={violationHighlights}
                        preferences={preferences} // Pass preferences for visual cues
                     />
                  </div>
                  {(viewMode !== 'hourly' && viewMode !== 'day') && <div className="mt-4"><StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} /></div>}
               </div>

               {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE') && (
                  <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto hidden xl:block p-4">
                      <ConstraintChecker employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} serviceConfig={activeService?.config} />
                  </div>
               )}
             </>
           )}

           {activeTab === 'scenarios' && <ScenarioPlanner employees={filteredEmployees} currentDate={currentDate} service={activeService} onApplySchedule={loadData} />}
           {activeTab === 'dashboard' && <Dashboard employees={filteredEmployees} currentDate={currentDate} serviceConfig={activeService?.config} onNavigateToPlanning={handleViewPlanningWithHighlights} onNavigateToScenarios={() => setActiveTab('scenarios')} onScheduleChange={loadData} />}
           {activeTab === 'cycles' && <CycleViewer employees={filteredEmployees} currentUser={currentUser} />}
           {activeTab === 'attractivity' && <AttractivityPanel />}
           {activeTab === 'stats' && <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />}
           {activeTab === 'team' && <TeamManager employees={employees} allSkills={skillsList} currentUser={currentUser} onReload={loadData} />}
           {activeTab === 'leaves' && <LeaveManager employees={employees} filteredEmployees={filteredEmployees} onReload={loadData} currentUser={currentUser} activeServiceId={activeServiceId} assignmentsList={assignmentsList} serviceConfig={activeService?.config} />}
           {activeTab === 'surveys' && <SurveyResults />}
           {activeTab === 'settings' && (
               <div className="p-6 max-w-6xl mx-auto space-y-8 w-full overflow-y-auto">
                   <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Paramètres Généraux</h2>
                   <div className="flex flex-col gap-6">
                       {/* 1. REGLES METIER */}
                       <RuleSettings />

                       {/* 2. SERVICES */}
                       <ServiceSettings service={activeService} onReload={loadData} />
                       
                       {/* 3. CODES HORAIRES & ABSENCES */}
                       <ShiftCodeSettings />

                       {/* 4. COMPETENCES & HORAIRES */}
                       <SkillsSettings skills={skillsList} onReload={loadData} />

                       {/* 5. ROLES & FONCTIONS */}
                       <RoleSettings />
                   </div>
               </div>
           )}
        </main>
      </div>

      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setIsEditorOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-96 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800 dark:text-white">Modifier le poste</h3>
               <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-slate-500 mb-4 bg-slate-50 dark:bg-slate-700 p-3 rounded border dark:border-slate-600">
                Modification pour <span className="font-semibold text-slate-700 dark:text-white">{employees.find(e => e.id === selectedCell.empId)?.name}</span> le <span className="font-semibold text-slate-700 dark:text-white">{selectedCell.date}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
              {Object.values(SHIFT_TYPES).map((shift) => (
                <button key={shift.code} onClick={() => handleShiftChange(shift.code as ShiftCode)} className={`p-2 rounded border text-xs font-bold transition-all hover:scale-105 ${shift.color} ${shift.textColor} border-transparent hover:shadow-md`} title={shift.description}>{shift.code}</button>
              ))}
              <button onClick={() => handleShiftChange('OFF')} className="p-2 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-600 col-span-4 mt-2">Effacer (Vide)</button>
            </div>
          </div>
        </div>
      )}

      {/* Hazard, Action Modal... (rest of modals same as original) */}
      {isHazardOpen && <HazardManager isOpen={isHazardOpen} onClose={() => setIsHazardOpen(false)} employees={filteredEmployees} currentDate={currentDate} onResolve={() => { loadData(); setToast({message: 'Aléa résolu', type: 'success'})}} />}

      {actionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setActionModal(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 w-[400px] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-6">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${actionModal.type === 'GENERATE' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                          {actionModal.type === 'GENERATE' ? <Wand2 className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">{actionModal.type === 'GENERATE' ? 'Génération Automatique' : 'Réinitialisation'}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Veuillez confirmer la période cible pour cette action.</p>
                  </div>
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mois</label>
                          <select value={actionMonth} onChange={(e) => setActionMonth(parseInt(e.target.value))} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
                              {Array.from({length: 12}, (_, i) => (<option key={i} value={i}>{new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Année</label>
                          <input type="number" value={actionYear} onChange={(e) => setActionYear(parseInt(e.target.value))} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                      </div>
                  </div>
                  {actionModal.type === 'RESET' && activeService && (
                      <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs rounded-lg border border-amber-100 dark:border-amber-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>Attention : Seuls les plannings du service <strong>{activeService.name}</strong> seront effacés.</span>
                      </div>
                  )}
                  <div className="flex gap-3">
                      <button onClick={() => setActionModal(null)} className="flex-1 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Annuler</button>
                      <button onClick={confirmAction} disabled={isLoading} className={`flex-1 py-2.5 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 ${actionModal.type === 'GENERATE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirmer
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
