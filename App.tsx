import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText, Menu, Search, UserPlus, LogOut, CheckSquare, Heart, AlertTriangle, Moon, Sun, Flag, CalendarClock, Layers, MessageSquare, Eraser, BriefcaseIcon, Umbrella, Undo2 } from 'lucide-react';
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
import { Employee, ShiftCode, ViewMode, Skill, Service, LeaveData, ServiceAssignment, LeaveCounters, UserRole, AppNotification, ConstraintViolation, WorkPreference, ShiftDefinition } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';
import { exportScheduleToCSV } from './utils/csvExport';
import { Toast } from './components/Toast';
import { checkConstraints } from './utils/validation';
import * as db from './services/db';
import * as notifications from './utils/notifications';
import { getHolidayName } from './utils/holidays';

export default function App() {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<{ role: UserRole, employeeId?: string, name?: string } | null>(null);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState<'planning' | 'stats' | 'team' | 'leaves' | 'settings' | 'dashboard' | 'scenarios' | 'attractivity' | 'cycles' | 'surveys'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [highlightNight, setHighlightNight] = useState(false);
  
  // Undo / History State
  const [undoStack, setUndoStack] = useState<Employee[][]>([]);
  
  // Highlight Violations State
  const [violationHighlights, setViolationHighlights] = useState<ConstraintViolation[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [dbShiftCodes, setDbShiftCodes] = useState<ShiftDefinition[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<ServiceAssignment[]>([]);
  const [preferences, setPreferences] = useState<WorkPreference[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string>('');
  
  const [selectedCell, setSelectedCell] = useState<{empId: string, date: string} | null>(null);
  const [shiftEditorFilter, setShiftEditorFilter] = useState<'all' | 'work' | 'absence'>('all');
  const [editorServiceId, setEditorServiceId] = useState<string>('');

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
  const [isSurveyOpen, setIsSurveyOpen] = useState(false); 
  
  // Notification State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);

  // Generation / Reset Modal State
  const [actionModal, setActionModal] = useState<{ type: 'GENERATE' | 'RESET' | 'RESET_LEAVES', isOpen: boolean } | null>(null);
  const [actionMonth, setActionMonth] = useState<number>(new Date().getMonth());
  const [actionYear, setActionYear] = useState<number>(new Date().getFullYear());
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- SCOPE & SECURITY MEMOS ---
  
  const myServiceIds = useMemo(() => {
      if (!currentUser?.employeeId) return [];
      return assignmentsList
          .filter(a => a.employeeId === currentUser.employeeId)
          .map(a => a.serviceId);
  }, [currentUser, assignmentsList]);

  const isGlobalViewer = useMemo(() => {
      if (!currentUser) return false;
      return ['ADMIN', 'DIRECTOR', 'CADRE_SUP'].includes(currentUser.role);
  }, [currentUser]);

  // --- Dynamic Year Selection ---
  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    const startYear = 2024;
    const endYear = current + 5; 
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // --- Dynamic Shift Definitions ---
  const allBaseShifts = useMemo(() => {
    const definitions: Map<string, ShiftDefinition> = new Map();
    
    // 1. Base default shifts from constants
    Object.values(SHIFT_TYPES).forEach(s => {
        if (s.code !== 'OFF') definitions.set(s.code, s);
    });

    // 2. Add DB defined shifts (overrides defaults or adds new ones)
    dbShiftCodes.forEach(dc => {
        definitions.set(dc.code, dc);
    });

    return Array.from(definitions.values());
  }, [dbShiftCodes]);

  const shiftDefinitionsMap = useMemo(() => {
      const map: Record<string, ShiftDefinition> = { ...SHIFT_TYPES };
      dbShiftCodes.forEach(dc => {
          map[dc.code] = dc;
      });
      return map;
  }, [dbShiftCodes]);

  const filteredShifts = useMemo(() => {
    return allBaseShifts.filter(shift => {
      // 1. Filter by Service
      if (editorServiceId && shift.serviceId && shift.serviceId !== editorServiceId) return false;

      // 2. Filter by Type
      if (shiftEditorFilter === 'all') return true;
      if (shiftEditorFilter === 'work') return shift.isWork;
      if (shiftEditorFilter === 'absence') return !shift.isWork && shift.code !== 'OFF';
      return true;
    });
  }, [shiftEditorFilter, allBaseShifts, editorServiceId]);

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
  }, [currentUser, assignmentsList, employees]);

  useEffect(() => {
      if (isDarkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empData, skillsData, servicesData, assignData, prefsData, dbCodes] = await Promise.all([
          db.fetchEmployeesWithShifts(),
          db.fetchSkills(),
          db.fetchServices(),
          db.fetchServiceAssignments(),
          db.fetchWorkPreferences(),
          db.fetchShiftDefinitions()
      ]);
      setEmployees(empData);
      setSkillsList(skillsData);
      setServicesList(servicesData);
      setAssignmentsList(assignData);
      setPreferences(prefsData.filter(p => p.status === 'VALIDATED')); 
      setDbShiftCodes(dbCodes);
    } catch (error: any) {
      console.error(error);
      setToast({ message: `Erreur: ${error.message || "Problème de connexion"}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const pushToUndoStack = () => {
      const snapshot = JSON.parse(JSON.stringify(employees));
      setUndoStack(prev => [snapshot, ...prev].slice(0, 20));
  };

  const handleUndo = async () => {
      if (undoStack.length === 0) return;
      const previousState = undoStack[0];
      const remainingStack = undoStack.slice(1);
      setIsSaving(true);
      try {
          await db.bulkSaveSchedule(previousState);
          setEmployees(previousState);
          setUndoStack(remainingStack);
          setToast({ message: "Dernière modification annulée", type: "success" });
      } catch (e: any) {
          setToast({ message: "Erreur lors de l'annulation : " + e.message, type: "error" });
      } finally {
          setIsSaving(false);
      }
  };

  const loadNotifications = async () => {
      if (!currentUser) return;
      const allNotifs = await db.fetchNotifications();
      const now = new Date().getTime();
      const myTeamNames = new Set<string>();
      if (!isGlobalViewer && ['CADRE', 'MANAGER'].includes(currentUser.role)) {
          const relevantAssignments = assignmentsList.filter(a => myServiceIds.includes(a.serviceId));
          const relevantEmpIds = relevantAssignments.map(a => a.employee_id);
          employees.filter(e => relevantEmpIds.includes(e.id)).forEach(e => myTeamNames.add(e.name));
      }
      const filtered = allNotifs.filter(n => {
          if (n.isRead) {
              const notifTime = new Date(n.date).getTime();
              const diffHours = (now - notifTime) / (1000 * 60 * 60);
              if (diffHours > 24) return false;
          }
          if (n.recipientId) return n.recipientId === currentUser.employeeId;
          const isRoleMatch = n.recipientRole === 'ALL' || n.recipientRole === currentUser.role;
          if (!isRoleMatch) return false;
          if (!isGlobalViewer && ['CADRE', 'MANAGER'].includes(currentUser.role)) {
              if (myServiceIds.length === 0) return false;
              if (n.actionType === 'LEAVE_VALIDATION' || n.type === 'info' || n.type === 'warning') {
                  const relatesToTeam = Array.from(myTeamNames).some(name => n.message.startsWith(name) || n.title.includes(name));
                  return relatesToTeam;
              }
          }
          return true;
      });
      setAppNotifications(filtered);
  };

  const handleLogin = (role: UserRole, employee?: Employee) => {
      let serviceToSelect = activeServiceId;
      if (employee) {
          const myAssignment = assignmentsList.find(a => a.employeeId === employee.id);
          if (myAssignment) serviceToSelect = myAssignment.serviceId;
      }
      setActiveServiceId(serviceToSelect);
      setCurrentUser({
          role,
          employeeId: employee?.id,
          name: employee ? employee.name : (role === 'ADMIN' ? 'Administrateur' : 'Directeur / Directrice')
      });
      setActiveTab('planning');
      setToast({ message: `Bienvenue, ${employee ? employee.name : role}`, type: "success" });
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setActiveTab('planning');
  };

  const activeService = servicesList.find(s => s.id === activeServiceId) || null;

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
                  pushToUndoStack();
                  await db.bulkImportEmployees(res.employees);
                  await loadData();
                  setToast({ message: `Import réussi : ${res.stats?.updated} mis à jour, ${res.stats?.created} créés`, type: "success" });
              }
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const openActionModal = (type: 'GENERATE' | 'RESET' | 'RESET_LEAVES') => {
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
               pushToUndoStack();
               const scopeEmployees = activeServiceId ? filteredEmployees : employees;
               const newEmps = await generateMonthlySchedule(scopeEmployees, actionYear, actionMonth, activeService?.config);
               await db.bulkSaveSchedule(newEmps);
               await loadData();
               setToast({ message: `Planning de ${monthName} généré avec succès pour ${scopeEmployees.length} employés.`, type: "success" });
          } else if (actionModal.type === 'RESET') {
               pushToUndoStack();
               await db.clearShiftsInRange(actionYear, actionMonth, activeServiceId || undefined);
               await loadData();
               setToast({ message: `Planning de ${monthName} réinitialisé ${activeServiceId ? 'pour le service' : 'globalement'}.`, type: "success" });
          } else if (actionModal.type === 'RESET_LEAVES') {
               await db.clearLeavesAndNotificationsInRange(actionYear, actionMonth);
               await loadData();
               setToast({ message: `Toutes les absences et notifications de ${monthName} ont été supprimées.`, type: "success" });
          }
      } catch (e: any) {
          setToast({ message: e.message, type: "error" });
      } finally {
          setIsLoading(false);
      }
  };

  const handleCopyPlanning = async () => {
      if (!confirm("Copier le planning du mois précédent sur le mois en cours ?")) return;
      pushToUndoStack();
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

  const handleViewPlanningWithHighlights = (violations: ConstraintViolation[]) => {
      setViolationHighlights(violations);
      setActiveTab('planning');
      setViewMode('month');
      setToast({ message: "Violations mises en évidence.", type: 'warning' });
  };

  const { start: gridStartDate, days: gridDuration } = useMemo(() => {
      const d = new Date(currentDate);
      if (viewMode === 'day' || viewMode === 'hourly') return { start: d, days: 1 };
      if (viewMode === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d); monday.setDate(diff);
        return { start: monday, days: 7 };
      }
      if (viewMode === 'workweek') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d); monday.setDate(diff);
        return { start: monday, days: 5 };
      }
      if (viewMode === 'workweek6') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d); monday.setDate(diff);
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
            if (reqSkills.length > 0) qualificationMatch = emp.skills.some(s => reqSkills.includes(s));
        }
        let assignmentMatch = true;
        if (activeServiceId) {
            const isAssigned = assignmentsList.some(a => a.employeeId === emp.id && a.serviceId === activeServiceId);
            if (!isAssigned) assignmentMatch = false;
            if (!isGlobalViewer && !myServiceIds.includes(activeServiceId)) assignmentMatch = false;
        } else {
            if (!isGlobalViewer) {
                const empAssignments = assignmentsList.filter(a => a.employeeId === emp.id);
                const empServiceIds = empAssignments.map(a => a.serviceId);
                const hasCommonService = empServiceIds.some(id => myServiceIds.includes(id));
                if (emp.id === currentUser?.employeeId) assignmentMatch = true;
                else assignmentMatch = hasCommonService;
            }
        }
        let statusMatch = true;
        let absenceTypeMatch = true;
        if (statusFilter !== 'all' || absenceTypeFilter !== 'all') {
            let hasWork = false; let hasSpecificAbsence = false; let hasAnyAbsence = false; let hasWorkOnHoliday = false;
            for (let i = 0; i < gridDuration; i++) {
                const d = new Date(gridStartDate); d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const code = emp.shifts[dateStr];
                if (getHolidayName(d) && code && SHIFT_TYPES[code]?.isWork) hasWorkOnHoliday = true;
                if (code && code !== 'OFF') {
                    const isWork = SHIFT_TYPES[code]?.isWork;
                    if (isWork) hasWork = true; else hasAnyAbsence = true;
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
  }, [employees, selectedRoles, skillFilter, showQualifiedOnly, activeServiceId, assignmentsList, gridStartDate, gridDuration, statusFilter, absenceTypeFilter, activeService, currentUser, isGlobalViewer, myServiceIds]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const handleDateNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    else if (viewMode === 'week' || viewMode.startsWith('workweek')) newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };
  
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.value) setCurrentDate(new Date(e.target.value)); };

  const handleCellClick = (empId: string, date: string) => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'CADRE_SUP' && currentUser?.role !== 'DIRECTOR') {
        setToast({ message: "Modification directe non autorisée.", type: "warning" });
        return;
    }
    setShiftEditorFilter('all');
    setEditorServiceId(activeServiceId);
    setSelectedCell({ empId, date });
    setIsEditorOpen(true);
  };

  const handleShiftChange = async (code: ShiftCode) => {
    if (!selectedCell) return;
    setIsSaving(true);
    pushToUndoStack();
    try {
      await db.upsertShift(selectedCell.empId, selectedCell.date, code);
      setIsEditorOpen(false);
      await loadData(); 
      setToast({ message: "Brouillon mis à jour", type: "success" });
    } catch (error: any) {
      setToast({ message: `Erreur: ${error.message}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRangeSelect = async (empId: string, startDate: string, endDate: string, forcedCode?: ShiftCode) => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'CADRE' && currentUser?.role !== 'CADRE_SUP' && currentUser?.role !== 'DIRECTOR') {
        setToast({ message: "Modification de masse non autorisée.", type: "warning" });
        return;
    }
    if (!forcedCode) return;
    setIsSaving(true);
    pushToUndoStack();
    try {
        const start = new Date(startDate); const end = new Date(endDate); const dates: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { dates.push(d.toISOString().split('T')[0]); }
        await db.bulkUpsertShifts(dates.map(date => ({ employee_id: empId, date, shift_code: forcedCode })));
        await loadData();
        setToast({ message: "Plage sauvegardée dans le brouillon", type: "success" });
    } catch (e: any) { setToast({ message: "Erreur: " + e.message, type: "error" }); }
    finally { setIsSaving(false); }
  };

  const handleNotificationAction = (notif: AppNotification) => {
      db.markNotificationRead(notif.id).then(() => loadNotifications());
      if (notif.actionType === 'LEAVE_VALIDATION') { setActiveTab('leaves'); setIsNotifOpen(false); }
  };

  if (!currentUser) return <LoginScreen employees={employees} onLogin={handleLogin} />;

  const unreadNotifs = appNotifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 font-sans transition-colors duration-300">
      <style>{`@media print { @page { size: landscape; margin: 5mm; } body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } aside, header, .no-print { display: none !important; } .print-container { overflow: visible !important; height: auto !important; } table { width: 100% !important; } }`}</style>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SatisfactionSurveyModal isOpen={isSurveyOpen} onClose={() => setIsSurveyOpen(false)} employeeId={currentUser.employeeId || ''} />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-40 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="bg-blue-600 p-2 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-lg font-bold text-slate-800 dark:text-white leading-tight hidden sm:block">OptiPlan</h1><p className="text-xs text-slate-500 dark:text-slate-400">{activeService ? activeService.name : (isGlobalViewer ? 'Vue Globale' : 'Mes Services')}</p></div>
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
           <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden md:block"></div>
           <div className="flex items-center gap-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-600 dark:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">{isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
             <div className="relative">
                 <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                     <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                     {unreadNotifs > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-800 min-w-[18px] text-center flex items-center justify-center h-5">{unreadNotifs}</span>}
                 </button>
                 {isNotifOpen && (
                     <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 z-50 overflow-hidden">
                         <div className="p-3 bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600 font-semibold text-sm flex justify-between dark:text-white"><span>Notifications</span>{unreadNotifs > 0 && <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs flex items-center">{unreadNotifs}</span>}</div>
                         <div className="max-h-80 overflow-y-auto">{appNotifications.length === 0 ? <div className="p-4 text-slate-400 text-sm text-center">Rien à signaler.</div> : appNotifications.map(n => (<div key={n.id} className={`p-3 border-b dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}><div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{n.title}</div><div className="text-slate-600 dark:text-slate-400 mb-2">{n.message}</div>{n.actionType === 'LEAVE_VALIDATION' && (<button onClick={() => handleNotificationAction(n)} className="w-full text-center bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-xs py-1.5 rounded hover:bg-blue-50 font-medium">Traiter la demande</button>)}</div>))}</div>
                     </div>
                 )}
             </div>
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 pl-2 pr-4 py-1.5 rounded-full"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">{currentUser.name?.charAt(0)}</div><div className="text-xs hidden sm:block text-left"><div className="font-bold text-slate-800 dark:text-slate-200">{currentUser.name}</div><div className="text-slate-500 dark:text-slate-400">{currentUser.role === 'DIRECTOR' ? 'Directeur' : currentUser.role}</div></div></div>
             <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Déconnexion"><LogOut className="w-5 h-5" /></button>
           </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 text-white border-r border-slate-700 flex flex-col overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72 no-print lg:shadow-none`}>
          <div className="hidden lg:flex justify-end p-2 border-b border-slate-800"><button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">{isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}</button></div>
          <nav className="p-2 space-y-2 border-b border-slate-700">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'planning' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Planning" : ""}><Calendar className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>{currentUser.role === 'INFIRMIER' || currentUser.role === 'AIDE_SOIGNANT' ? 'Mon Planning' : 'Planning Global'}</span>}</button>
            <button onClick={() => setActiveTab('cycles')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'cycles' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Cycles & Horaires" : ""}><CalendarClock className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Cycles & Horaires</span>}</button>
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'MANAGER' || currentUser.role === 'CADRE_SUP') && (
                <><button onClick={() => setActiveTab('scenarios')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'scenarios' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Scénarios" : ""}><Wand2 className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Scénarios & IA</span>}</button>
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Tableau de bord" : ""}><LayoutDashboard className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Carnet de Bord</span>}</button>
                <button onClick={() => setActiveTab('attractivity')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'attractivity' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Attractivité" : ""}><Heart className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Attractivité & QVT</span>}</button>
                <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Statistiques" : ""}><BarChart3 className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Statistiques</span>}</button>
                <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'team' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Équipe" : ""}><Users className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Équipe</span>}</button></>
            )}
            <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'leaves' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Congés" : ""}><Coffee className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Gestion des Congés</span>}</button>
            {(currentUser.role === 'ADMIN') && (<button onClick={() => setActiveTab('surveys')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'surveys' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Résultats QVT" : ""}><MessageSquare className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Résultats QVT</span>}</button>)}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR' || currentUser.role === 'CADRE' || currentUser.role === 'CADRE_SUP') && (<button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center px-2' : 'px-3'}`} title={isSidebarCollapsed ? "Paramètres" : ""}><Settings className="w-5 h-5 flex-shrink-0" /> {!isSidebarCollapsed && <span>Paramètres</span>}</button>)}
          </nav>
          {!isSidebarCollapsed && (
            <div className="p-4 space-y-6 animate-in fade-in duration-300">
                <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Store className="w-3 h-3" /> Service</h3><div className="space-y-2 max-h-60 overflow-y-auto pr-1">{isGlobalViewer && (<button onClick={() => setActiveServiceId('')} className={`w-full text-left p-3 rounded-lg border transition-all ${activeServiceId === '' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}><div className="font-bold text-sm">Vue Globale</div><div className="text-xs opacity-70 mt-1">Tous les services</div></button>)}{servicesList.map(s => { if (!isGlobalViewer && !myServiceIds.includes(s.id)) return null; const empCount = assignmentsList.filter(a => a.serviceId === s.id).length; const skillCount = s.config?.requiredSkills?.length || 0; const isActive = activeServiceId === s.id; return (<button key={s.id} onClick={() => setActiveServiceId(s.id)} className={`w-full text-left p-3 rounded-lg border transition-all ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}><div className="font-bold text-sm mb-2">{s.name}</div><div className="flex gap-3 text-[10px]"><div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-white text-blue-900 font-bold shadow-sm' : 'bg-slate-900'}`}><Users className="w-3 h-3" /> {empCount}</div><div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-white text-blue-900 font-bold shadow-sm' : 'bg-slate-900'}`}><Tag className="w-3 h-3" /> {skillCount}</div></div></button>); })}</div></div>
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Statut (Période)</h3>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'all', label: 'Tous', icon: <Users className="w-3.5 h-3.5" /> },
                            { id: 'present', label: 'Présents', icon: <UserCheck className="w-3.5 h-3.5" /> },
                            { id: 'absent', label: 'Absents', icon: <UserX className="w-3.5 h-3.5" /> },
                            { id: 'holiday', label: 'Fériés', icon: <Flag className="w-3.5 h-3.5" /> }
                        ].map(stat => (
                            <button key={stat.id} onClick={() => setStatusFilter(stat.id as any)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${statusFilter === stat.id ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>{stat.icon}{stat.label}</button>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Type d'absence</h3>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setAbsenceTypeFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${absenceTypeFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>Tous</button>
                        {['CA', 'RTT', 'MAL', 'RH', 'RC', 'HS', 'FO', 'F'].map(code => (<button key={code} onClick={() => setAbsenceTypeFilter(code)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${absenceTypeFilter === code ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>{code}</button>))}
                    </div>
                </div>
                <div className="space-y-4"><div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Briefcase className="w-3 h-3" /> Rôles</h3><div className="space-y-1">{['Infirmier', 'Aide-Soignant', 'Cadre', 'Cadre Supérieur', 'Manager', 'Directeur', 'Médecin', 'Secrétaire', 'Sage-Femme'].map(role => (<label key={role} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white"><input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRoleFilter(role)} className="rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600" />{role}</label>))}</div></div><div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckSquare className="w-3 h-3" /> Compétences</h3><select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm mb-2 text-slate-200 outline-none"><option value="all">Toutes</option>{skillsList.map(s => <option key={s.id} value={s.code}>{s.code} - {s.label}</option>)}</select><label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white"><input type="checkbox" checked={showQualifiedOnly} onChange={(e) => setShowQualifiedOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-600" />Qualifiés uniquement</label></div></div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50 dark:bg-slate-900/50">
           {activeTab === 'planning' && (
             <>
               <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-3 no-print">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5">
                               {isSaving ? (
                                   <div className="flex items-center gap-1.5 text-[10px] text-blue-600 animate-pulse">
                                       <Database className="w-3 h-3" /> Sauvegarde...
                                   </div>
                               ) : (
                                   <div className="flex items-center gap-1.5 text-[10px] text-green-600">
                                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div>
                                       Brouillon synchronisé
                                   </div>
                               )}
                           </div>
                           <button onClick={() => setHighlightNight(!highlightNight)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${highlightNight ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}><Moon className="w-3.5 h-3.5" /> Nuit Active</button>
                      </div>
                      <div className="flex items-center gap-2">
                           {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE' || currentUser.role === 'CADRE_SUP' || currentUser.role === 'DIRECTOR' || currentUser.role === 'MANAGER') && (
                            <>
                            <button onClick={handleUndo} disabled={undoStack.length === 0 || isSaving} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${undoStack.length > 0 ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'}`} title="Annuler la dernière modification"><Undo2 className="w-4 h-4" /> Annuler</button>
                            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button onClick={handlePrint} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Imprimer"><Printer className="w-4 h-4" /></button>
                            <button onClick={handleExportCSV} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Export CSV"><Download className="w-4 h-4" /></button>
                            <button onClick={handleImportClick} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Import CSV"><Upload className="w-4 h-4" /></button>
                            <button onClick={handleCopyPlanning} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600" title="Copier M-1"><Copy className="w-4 h-4" /></button>
                            <button onClick={() => openActionModal('RESET')} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800" title="Réinitialiser Planning"><Trash2 className="w-4 h-4" /></button>
                            {currentUser.role === 'ADMIN' && (<button onClick={() => openActionModal('RESET_LEAVES')} className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-red-900/30 rounded-lg border border-orange-200 dark:border-orange-800" title="Réinit. Absences"><Eraser className="w-4 h-4" /></button>)}
                            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button onClick={() => setIsHazardOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 shadow-sm transition-colors"><AlertTriangle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Gérer Aléa</span></button>
                            <button onClick={() => openActionModal('GENERATE')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors"><Wand2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Générer Auto</span></button>
                            </>
                           )}
                      </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                          <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Mois</button>
                          <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Semaine</button>
                          <button onClick={() => setViewMode('workweek')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'workweek' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Ouvré</button>
                          <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Journée</button>
                          <button onClick={() => setViewMode('hourly')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'hourly' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>Horaires</button>
                      </div>
                  </div>
               </div>
               <div className="flex-1 overflow-hidden flex flex-col p-4"><div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col"><ScheduleGrid employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} viewMode={viewMode} onCellClick={handleCellClick} onRangeSelect={handleRangeSelect} highlightNight={highlightNight} highlightedViolations={violationHighlights} preferences={preferences} shiftDefinitions={shiftDefinitionsMap} /></div>{(viewMode !== 'hourly' && viewMode !== 'day') && <div className="mt-4"><StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} shiftDefinitions={shiftDefinitionsMap} /></div>}</div>
               {(currentUser.role === 'ADMIN' || currentUser.role === 'CADRE') && (<div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto hidden xl:block p-4"><ConstraintChecker employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} serviceConfig={activeService?.config} /></div>)}
             </>
           )}
           {activeTab === 'scenarios' && <ScenarioPlanner employees={filteredEmployees} currentDate={currentDate} service={activeService} onApplySchedule={loadData} />}
           {activeTab === 'dashboard' && <Dashboard employees={filteredEmployees} currentDate={currentDate} serviceConfig={activeService?.config} onNavigateToPlanning={handleViewPlanningWithHighlights} onNavigateToScenarios={() => setActiveTab('scenarios')} onScheduleChange={loadData} />}
           {activeTab === 'cycles' && <CycleViewer employees={filteredEmployees} currentUser={currentUser} shiftDefinitions={shiftDefinitionsMap} />}
           {activeTab === 'attractivity' && <AttractivityPanel />}
           {activeTab === 'stats' && <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />}
           {activeTab === 'team' && (<TeamManager employees={employees} allSkills={skillsList} currentUser={currentUser} onReload={loadData} services={servicesList} assignments={assignmentsList} />)}
           {activeTab === 'leaves' && <LeaveManager employees={employees} filteredEmployees={filteredEmployees} onReload={loadData} currentUser={currentUser} activeServiceId={activeServiceId} assignmentsList={assignmentsList} serviceConfig={activeService?.config} />}
           {activeTab === 'surveys' && <SurveyResults />}
           {activeTab === 'settings' && (<div className="p-6 max-w-6xl mx-auto space-y-8 w-full overflow-y-auto"><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Paramètres Généraux</h2><div className="flex flex-col gap-6"><RuleSettings /><ServiceSettings service={activeService} onReload={loadData} currentUser={currentUser} /><ShiftCodeSettings /><SkillsSettings skills={skillsList} onReload={loadData} services={servicesList} /><RoleSettings /></div></div>)}
        </main>
      </div>

      {/* SHIFT EDITOR MODAL (Modifier le poste) */}
      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Modifier le Poste</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {employees.find(e => e.id === selectedCell.empId)?.name} • {new Date(selectedCell.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
               <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button onClick={() => setShiftEditorFilter('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${shiftEditorFilter === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Tout</button>
                  <button onClick={() => setShiftEditorFilter('work')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${shiftEditorFilter === 'work' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500'}`}>Postes</button>
                  <button onClick={() => setShiftEditorFilter('absence')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${shiftEditorFilter === 'absence' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500'}`}>Absences</button>
               </div>
               <select value={editorServiceId} onChange={e => setEditorServiceId(e.target.value)} className="text-xs border rounded p-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Tous les services</option>
                  {servicesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 max-h-[400px]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredShifts.map((shift) => (
                  <button key={shift.code} onClick={() => handleShiftChange(shift.code)} className={`p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-1 transition-all hover:scale-105 hover:shadow-md group ${shift.color} ${shift.textColor}`}>
                    <span className="font-bold text-sm">{shift.code}</span>
                    <span className="text-[10px] text-center line-clamp-1 opacity-80">{shift.label}</span>
                  </button>
                ))}
                <button onClick={() => handleShiftChange('OFF')} className="p-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center gap-1 text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all">
                  <Eraser className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Désaffecter</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsEditorOpen(false)} className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* HAZARD MANAGER MODAL */}
      <HazardManager 
        isOpen={isHazardOpen} 
        onClose={() => setIsHazardOpen(false)} 
        employees={employees} 
        currentDate={currentDate} 
        onResolve={loadData} 
      />

      {/* ACTION MODALS (GENERATE / RESET) */}
      {actionModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                      {actionModal.type === 'GENERATE' ? <Wand2 className="w-5 h-5 text-blue-600"/> : <Trash2 className="w-5 h-5 text-red-600"/>}
                      {actionModal.type === 'GENERATE' ? 'Génération Automatique' : 'Réinitialisation'}
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mois cible</label>
                          <div className="grid grid-cols-2 gap-2">
                              <select value={actionMonth} onChange={e => setActionMonth(parseInt(e.target.value))} className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                  {Array.from({length: 12}, (_, i) => (<option key={i} value={i}>{new Date(2000, i).toLocaleDateString('fr-FR', {month: 'long'})}</option>))}
                              </select>
                              <select value={actionYear} onChange={e => setActionYear(parseInt(e.target.value))} className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                          </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                          {actionModal.type === 'GENERATE' 
                            ? "Le système va générer un planning optimisé pour le service sélectionné en respectant les quotités et contraintes légale." 
                            : "Attention, cette action va supprimer tous les postes planifiés sur cette période (hors congés validés)."}
                      </p>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setActionModal(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm">Annuler</button>
                      <button onClick={confirmAction} disabled={isLoading} className={`px-6 py-2 rounded text-white text-sm font-bold shadow-sm ${actionModal.type === 'GENERATE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                          {isLoading ? 'Action en cours...' : 'Confirmer'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}