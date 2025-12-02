
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText, Menu, Search, UserPlus } from 'lucide-react';
import { ScheduleGrid } from './components/ScheduleGrid';
import { StaffingSummary } from './components/StaffingSummary';
import { StatsPanel } from './components/StatsPanel';
import { ConstraintChecker } from './components/ConstraintChecker';
import { LeaveManager } from './components/LeaveManager';
import { SkillsSettings } from './components/SkillsSettings';
import { ServiceSettings } from './components/ServiceSettings';
import { Dashboard } from './components/Dashboard';
import { SHIFT_TYPES } from './constants';
import { Employee, ShiftCode, ViewMode, Skill, Service, LeaveData, ServiceAssignment, LeaveCounter } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';
import { exportScheduleToCSV } from './utils/csvExport';
import { Toast } from './components/Toast';
import { checkConstraints } from './utils/validation';
import * as db from './services/db';
import * as notifications from './utils/notifications';

function App() {
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [absenceTypeFilter, setAbsenceTypeFilter] = useState<string>('all');

  // Sidebar Mobile State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null); 
  const [newSkillInput, setNewSkillInput] = useState(''); 
  
  // Share Menu State
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  // Team View Expansion State
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Date Selection Modal State
  const [dateModalMode, setDateModalMode] = useState<'none' | 'generate' | 'reset'>('none');
  const [targetConfig, setTargetConfig] = useState({ 
    month: new Date().getMonth(), 
    year: new Date().getFullYear() 
  });

  // Date Picker Toggle
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print Handler (Native)
  const handlePrint = () => {
      window.print();
  };

  // --- Initial Data Load ---
  useEffect(() => {
    loadData();
  }, []);

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
      
      // Default service select
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

  const activeService = servicesList.find(s => s.id === activeServiceId) || null;

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
      return employees.filter(emp => {
        // 1. Role & Skill Filter
        const roleMatch = roleFilter === 'all' || emp.role === roleFilter;
        const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
        
        // 2. Service Qualification Filter
        let qualificationMatch = true;
        if (showQualifiedOnly && activeService?.config?.requiredSkills?.length > 0) {
            const reqSkills = activeService.config.requiredSkills;
            const hasSkill = emp.skills.some(s => reqSkills.includes(s));
            qualificationMatch = hasSkill;
        }

        // 3. Service Assignment Filter (Active Service Period)
        let assignmentMatch = true;
        if (activeServiceId && assignmentsList.length > 0) {
            const viewEnd = new Date(gridStartDate);
            viewEnd.setDate(viewEnd.getDate() + gridDuration);

            // Find relevant assignments for this employee and this service
            const empAssignments = assignmentsList.filter(a => 
                a.employeeId === emp.id && 
                a.serviceId === activeServiceId
            );

            if (empAssignments.length > 0) {
                // Check overlap
                const hasOverlap = empAssignments.some(a => {
                    const aStart = new Date(a.startDate);
                    const aEnd = a.endDate ? new Date(a.endDate) : new Date('2099-12-31');
                    return aStart < viewEnd && aEnd >= gridStartDate;
                });
                assignmentMatch = hasOverlap;
            } else {
                // If service has assignments but employee is not in them, filter out.
                // UNLESS the service has NO assignments at all (legacy mode)
                const serviceHasAnyAssignments = assignmentsList.some(a => a.serviceId === activeServiceId);
                if (serviceHasAnyAssignments) {
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
            else if (statusFilter === 'absent') statusMatch = !hasWork;

            if (absenceTypeFilter !== 'all') absenceTypeMatch = hasSpecificAbsence;
        }

        return roleMatch && skillMatch && qualificationMatch && assignmentMatch && statusMatch && absenceTypeMatch;
      });
  }, [employees, roleFilter, skillFilter, showQualifiedOnly, activeServiceId, assignmentsList, gridStartDate, gridDuration, statusFilter, absenceTypeFilter, activeService]);

  const handleSeedDatabase = async () => {
    setIsLoading(true);
    try {
      await db.seedDatabase();
      await loadData();
      setToast({ message: "Base de données initialisée avec succès", type: "success" });
    } catch (error: any) {
      setToast({ message: `Erreur d'initialisation: ${error.message || "Inconnue"}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Date Navigation Helper ---
  const handleDateNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'workweek') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      // Day and Hourly
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
      setCurrentDate(new Date());
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
          setShowDatePicker(false);
      }
  };

  const getDateLabel = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week' || viewMode === 'workweek') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(currentDate);
      monday.setDate(diff);
      return `Semaine du ${monday.getDate()} ${monday.toLocaleDateString('fr-FR', { month: 'short' })}`;
    }
    return currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // --- Handlers ---
  const handleCellClick = (empId: string, date: string) => {
    setSelectedCell({ empId, date });
    setIsEditorOpen(true);
  };

  const handleShiftChange = async (code: ShiftCode) => {
    if (!selectedCell) return;
    const oldEmployees = [...employees];
    const updatedEmployees = employees.map(emp => {
      if (emp.id === selectedCell.empId) {
        return {
          ...emp,
          shifts: { ...emp.shifts, [selectedCell.date]: code }
        };
      }
      return emp;
    });
    setEmployees(updatedEmployees);
    setIsEditorOpen(false);
    try {
      await db.upsertShift(selectedCell.empId, selectedCell.date, code);
      setToast({ message: "Poste mis à jour", type: "success" });
    } catch (error: any) {
      setEmployees(oldEmployees);
      setToast({ message: `Erreur: ${error.message}`, type: "error" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
            const result = parseScheduleCSV(content, employees);
            if (result.error) {
                setToast({ message: result.error, type: "error" });
            } else if (result.employees) {
                await db.bulkImportEmployees(result.employees);
                await loadData();
                setToast({ message: `Import CSV réussi.`, type: "success" });
            }
        } catch (error: any) {
            setToast({ message: `Erreur Import: ${error.message}`, type: "error" });
        } finally {
            setIsLoading(false);
        }
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset
  };

  const handleExport = () => {
    exportScheduleToCSV(employees, currentDate);
    setToast({ message: "Exportation réussie", type: "success" });
  };

  const handleCopyToNextMonth = async () => {
    if (!confirm("Copier le planning du mois affiché vers le mois suivant ?\nCela écrasera les données existantes du mois cible.")) return;
    setIsLoading(true);
    try {
      const nextDate = new Date(currentDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const targetYear = nextDate.getFullYear();
      const targetMonth = nextDate.getMonth();

      const shiftsToCopy: {employee_id: string, date: string, shift_code: string}[] = [];
      const daysInCurrent = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const daysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
      const limitDays = Math.min(daysInCurrent, daysInTarget);

      for (let day = 1; day <= limitDays; day++) {
        const srcDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        employees.forEach(emp => {
          const code = emp.shifts[srcDateStr];
          if (code && code !== 'OFF') {
            shiftsToCopy.push({ employee_id: emp.id, date: targetDateStr, shift_code: code });
          }
        });
      }
      if (shiftsToCopy.length > 0) {
        await db.bulkUpsertShifts(shiftsToCopy);
        await loadData();
        setToast({ message: "Planning copié vers le mois suivant avec succès.", type: "success" });
      } else {
        setToast({ message: "Aucun poste à copier.", type: "warning" });
      }
    } catch (error: any) {
      setToast({ message: `Erreur copie: ${error.message}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const openDateModal = (mode: 'generate' | 'reset') => {
    setTargetConfig({ month: currentDate.getMonth(), year: currentDate.getFullYear() });
    setDateModalMode(mode);
  };

  const handleConfirmDateAction = async () => {
    setIsLoading(true);
    try {
        if (dateModalMode === 'generate') {
          const newSchedule = generateMonthlySchedule(employees, targetConfig.year, targetConfig.month, activeService?.config);
          await db.bulkSaveSchedule(newSchedule);
          setEmployees(newSchedule);
          setToast({ message: "Planning généré.", type: "success" });
          setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
          setViewMode('month');
        } else if (dateModalMode === 'reset') {
          await db.clearShiftsInRange(targetConfig.year, targetConfig.month);
          await loadData();
          setToast({ message: "Planning réinitialisé.", type: "success" });
          setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
          setViewMode('month');
        }
    } catch (error: any) {
        setToast({ message: `Erreur: ${error.message}`, type: "error" });
    } finally {
        setIsLoading(false);
        setDateModalMode('none');
    }
  };

  // --- Employee Management ---
  const handleCreateNewEmployee = () => {
      const newEmp: Employee = {
          id: '',
          matricule: `M${Math.floor(Math.random() * 10000)}`,
          name: '',
          role: 'Infirmier',
          fte: 1.0,
          leaveBalance: 0,
          leaveData: {
              year: new Date().getFullYear(),
              counters: {
                  "CA": { allowed: 25, taken: 0, reliquat: 0 },
                  "RTT": { allowed: 0, taken: 0, reliquat: 0 },
                  "HS": { allowed: 0, taken: 0, reliquat: 0 }
              },
              history: []
          },
          skills: [],
          shifts: {}
      };
      setEditingEmployee(newEmp);
      setNewSkillInput('');
  };

  const handleEditEmployee = (emp: Employee) => {
    // Clone deep to avoid reference issues
    const clone = JSON.parse(JSON.stringify(emp));
    if (!clone.leaveData) {
        clone.leaveData = {
              year: new Date().getFullYear(),
              counters: {
                  "CA": { allowed: 25, taken: 0, reliquat: 0 },
                  "RTT": { allowed: 0, taken: 0, reliquat: 0 },
                  "HS": { allowed: 0, taken: 0, reliquat: 0 }
              },
              history: []
        };
    }
    setEditingEmployee(clone);
    setNewSkillInput('');
  };

  const handleDeleteEmployee = async (empId: string) => {
      if (!confirm("Supprimer cet employé ?")) return;
      setIsLoading(true);
      try {
          await db.deleteEmployee(empId);
          await loadData();
          setToast({ message: "Équipier supprimé", type: "success" });
      } catch (error: any) {
          setToast({ message: `Erreur: ${error.message}`, type: "error" });
      } finally {
          setIsLoading(false);
      }
  };

  const saveEmployeeChanges = async () => {
    if (!editingEmployee) return;
    if (!editingEmployee.name.trim() || !editingEmployee.matricule.trim()) {
        setToast({ message: "Nom et Matricule obligatoires.", type: "warning" });
        return;
    }

    setIsSaving(true);
    try {
        await db.upsertEmployee(editingEmployee);
        await loadData();
        setToast({ message: "Fiche équipier enregistrée.", type: "success" });
        setEditingEmployee(null);
    } catch (error: any) {
        setToast({ message: `Erreur: ${error.message}`, type: "error" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (!editingEmployee || !newSkillInput.trim()) return;
    const skill = newSkillInput.trim();
    if (!editingEmployee.skills.includes(skill)) {
        setEditingEmployee({...editingEmployee, skills: [...editingEmployee.skills, skill]});
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    if (!editingEmployee) return;
    setEditingEmployee({...editingEmployee, skills: editingEmployee.skills.filter(s => s !== skill)});
  };

  // --- Notifications ---
  const handleSendEmail = async () => {
      // Mock implementation
      setToast({ message: "Fonctionnalité Email simulée", type: "success" });
      setIsShareMenuOpen(false);
  };
  const handleNotifyTeam = async () => {
      // Mock implementation
      setToast({ message: "Notification équipe simulée", type: "success" });
      setIsShareMenuOpen(false);
  };
  const handleSendManagerRecap = async () => {
      // Mock implementation
      setToast({ message: "Récap manager simulé", type: "success" });
      setIsShareMenuOpen(false);
  };

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

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-slate-600 rounded hover:bg-slate-100">
             <Menu className="w-6 h-6" />
          </button>
          <div className="bg-blue-600 p-2 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
          <div>
             <h1 className="text-lg font-bold text-slate-800 leading-tight hidden sm:block">OptiPlan</h1>
             <p className="text-xs text-slate-500">{activeService ? activeService.name : 'Tous Services'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
           {/* Date Nav */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 relative">
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
             <button className="px-2 md:px-3 text-sm font-medium text-slate-700 min-w-[120px] md:min-w-[200px] text-center capitalize hover:bg-slate-100 rounded" onClick={() => setShowDatePicker(!showDatePicker)}>{getDateLabel()}</button>
             {showDatePicker && <div className="absolute top-full left-0 mt-2 bg-white shadow-xl rounded-lg border border-slate-200 p-2 z-50"><input type="date" onChange={handleDateSelect} className="p-2 border border-slate-300 rounded outline-none" /></div>}
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600" /></button>
             <button onClick={handleToday} className="hidden md:block ml-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100">Aujourd'hui</button>
           </div>

           {/* View Modes (Hidden on small mobile) */}
           <div className="hidden lg:flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button onClick={() => setViewMode('month')} className={`p-1.5 rounded ${viewMode === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`} title="Mois"><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('week')} className={`p-1.5 rounded ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`} title="Semaine"><CalendarDays className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('day')} className={`p-1.5 rounded ${viewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`} title="Jour"><LayoutList className="w-4 h-4" /></button>
           </div>

           <div className="h-6 w-px bg-slate-300 mx-1 hidden md:block"></div>

           {/* Quick Actions */}
           <div className="flex items-center gap-2">
             <button onClick={handlePrint} className="hidden md:block p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg" title="Imprimer"><Printer className="w-4 h-4" /></button>
             <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileUpload} />
             <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg" title="Importer CSV"><Upload className="w-4 h-4" /></button>
             <button onClick={handleCopyToNextMonth} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg" title="Copier vers M+1"><Copy className="w-4 h-4" /></button>
             
             {/* Share */}
             <div className="relative">
                 <button onClick={() => setIsShareMenuOpen(!isShareMenuOpen)} className={`p-2 border rounded-lg ${isShareMenuOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-50'}`}><Share2 className="w-4 h-4" /></button>
                 {isShareMenuOpen && (
                     <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border z-50 p-1">
                         <button onClick={handleSendEmail} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2"><Mail className="w-4 h-4" /> Email</button>
                         <button onClick={handleNotifyTeam} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2"><Bell className="w-4 h-4" /> Notifier</button>
                         <button onClick={handleExport} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2"><FileDown className="w-4 h-4" /> Export CSV</button>
                     </div>
                 )}
             </div>

             <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>
             <button onClick={() => openDateModal('reset')} className="hidden sm:block p-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg" title="Réinitialiser"><RefreshCw className="w-4 h-4" /></button>
             <button onClick={() => openDateModal('generate')} className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium"><Wand2 className="w-4 h-4" /> Générer</button>
           </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR & OVERLAY */}
        {isSidebarOpen && (
            <div className="absolute inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}
        <aside className={`
            absolute md:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            no-print
        `}>
          <nav className="p-4 space-y-2 border-b border-slate-100">
            <button onClick={() => { setActiveTab('planning'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-5 h-5" /> Planning</button>
            <button onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /> Carnet de Bord</button>
            <button onClick={() => { setActiveTab('stats'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'stats' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><BarChart3 className="w-5 h-5" /> Statistiques</button>
            <button onClick={() => { setActiveTab('team'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'team' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Users className="w-5 h-5" /> Équipe</button>
            <button onClick={() => { setActiveTab('leaves'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><BriefcaseBusiness className="w-5 h-5" /> Congés</button>
            <button onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings className="w-5 h-5" /> Paramètres</button>
          </nav>

          {/* FILTERS SECTION */}
          <div className="p-4 space-y-6">
             <div className="flex items-center gap-2 text-slate-400 uppercase text-xs font-bold tracking-wider">
                 <Filter className="w-3 h-3" /> Filtres & Contexte
             </div>

             {/* 1. Service Filter */}
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Service</label>
                 <select value={activeServiceId} onChange={(e) => setActiveServiceId(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-100 outline-none">
                     {servicesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     <option value="">Tous les services</option>
                 </select>
                 {activeService && (
                     <div className="text-[10px] text-slate-500 bg-blue-50 p-2 rounded border border-blue-100 flex flex-col gap-1">
                        <div className="flex justify-between"><span>Compétences req.:</span> <span className="font-bold">{activeService.config?.requiredSkills?.length || 0}</span></div>
                        <div className="flex justify-between"><span>Effectif assigné:</span> <span className="font-bold">{assignmentsList.filter(a => a.serviceId === activeService.id).length}</span></div>
                     </div>
                 )}
             </div>

             {/* 2. Role Filter */}
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Rôle</label>
                 <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                     <option value="all">Tous les rôles</option>
                     <option value="Infirmier">Infirmier (IDE)</option>
                     <option value="Aide-Soignant">Aide-Soignant (AS)</option>
                     <option value="Cadre">Cadre</option>
                     <option value="Manager">Manager</option>
                 </select>
             </div>

             {/* 3. Skill Filter */}
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Compétence</label>
                 <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                     <option value="all">Toutes compétences</option>
                     {activeService ? 
                        activeService.config?.requiredSkills?.map(sk => <option key={sk} value={sk}>{sk}</option>) :
                        skillsList.map(s => <option key={s.id} value={s.code}>{s.label}</option>)
                     }
                 </select>
             </div>

             {/* 4. Qualification Toggle */}
             {activeService && (
                 <label className="flex items-center gap-2 cursor-pointer group">
                     <div className={`w-9 h-5 rounded-full p-1 transition-colors ${showQualifiedOnly ? 'bg-blue-600' : 'bg-slate-300'}`}>
                         <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showQualifiedOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                     </div>
                     <span className="text-xs text-slate-600 font-medium group-hover:text-blue-600">Qualifiés uniquement</span>
                     <input type="checkbox" className="hidden" checked={showQualifiedOnly} onChange={(e) => setShowQualifiedOnly(e.target.checked)} />
                 </label>
             )}

             <hr className="border-slate-100" />

             {/* 5. Status Filter */}
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Statut Période</label>
                 <div className="flex bg-slate-100 p-1 rounded-lg">
                     <button onClick={() => setStatusFilter('all')} className={`flex-1 py-1 text-xs rounded font-medium ${statusFilter === 'all' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Tous</button>
                     <button onClick={() => setStatusFilter('present')} className={`flex-1 py-1 text-xs rounded font-medium ${statusFilter === 'present' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}>Présents</button>
                     <button onClick={() => setStatusFilter('absent')} className={`flex-1 py-1 text-xs rounded font-medium ${statusFilter === 'absent' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}>Absents</button>
                 </div>
             </div>

             {/* 6. Absence Type Filter */}
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-700">Type d'Absence</label>
                 <select value={absenceTypeFilter} onChange={(e) => setAbsenceTypeFilter(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-slate-50">
                     <option value="all">Tout type</option>
                     <option value="CA">Congés (CA)</option>
                     <option value="RH">Repos Hebdo (RH)</option>
                     <option value="RC">Repos Cycle (RC)</option>
                     <option value="NT">Maladie/Autre (NT)</option>
                     <option value="FO">Formation (FO)</option>
                 </select>
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-slate-100">
             {activeTab === 'planning' && (
                <div className="print-container flex-1 p-2 md:p-4 flex flex-col gap-2 overflow-hidden h-full">
                    {/* Grid + Summary Area */}
                    <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                        <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                             {/* The Grid takes remaining space but allows shrinking. It handles its own scroll. */}
                             <ScheduleGrid employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} viewMode={viewMode} onCellClick={handleCellClick} />
                             {/* Summary sits at bottom, sticky */}
                             <div className="border-t border-slate-200 bg-slate-50">
                                <StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />
                             </div>
                        </div>
                        
                        {/* Right Sidebar for Constraints (Desktop Only) */}
                        <div className="w-80 flex-shrink-0 hidden xl:flex flex-col h-full no-print overflow-hidden">
                            <ConstraintChecker employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} serviceConfig={activeService?.config} />
                        </div>
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
                 <div className="p-4 md:p-8 flex-1 overflow-y-auto h-full">
                     <div className="flex justify-between items-center mb-6">
                         <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> Équipe</h2>
                         <button onClick={handleCreateNewEmployee} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"><UserPlus className="w-4 h-4" /> Ajouter un équipier</button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                         {filteredEmployees.map(emp => (
                             <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative">
                                 <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => handleEditEmployee(emp)} className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                                     <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                 </div>
                                 <div className="flex items-center gap-3 mb-3">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${emp.role === 'Infirmier' ? 'bg-blue-100 text-blue-700' : emp.role === 'Aide-Soignant' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                         {emp.name.charAt(0)}
                                     </div>
                                     <div>
                                         <div className="font-bold text-slate-800 truncate w-32 md:w-40" title={emp.name}>{emp.name}</div>
                                         <div className="text-xs text-slate-500">{emp.matricule} • {Math.round(emp.fte * 100)}%</div>
                                     </div>
                                 </div>
                                 <div className="space-y-2 text-xs">
                                     <div className="flex justify-between border-b pb-1"><span>Rôle:</span> <span className="font-medium">{emp.role}</span></div>
                                     <div className="flex justify-between border-b pb-1"><span>Solde CA:</span> <span className="font-medium text-blue-600">{emp.leaveBalance}j</span></div>
                                     <div className="flex flex-wrap gap-1 pt-1">
                                         {emp.skills.slice(0, 3).map(s => <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{s}</span>)}
                                         {emp.skills.length > 3 && <span className="text-[10px] text-slate-400">+{emp.skills.length - 3}</span>}
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {activeTab === 'leaves' && <div className="flex-1 overflow-y-auto h-full"><LeaveManager employees={employees} onReload={loadData} /></div>}
             
             {activeTab === 'settings' && (
                <div className="flex-1 overflow-y-auto h-full p-8 space-y-8">
                    <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Database className="w-5 h-5 text-purple-600" /> Administration des Données</h3>
                        <p className="text-sm text-slate-500 mb-4">Utilisez cette option pour peupler la base de données avec des données de démonstration.</p>
                        <button onClick={() => { if(confirm("Attention : Injection de données démo.")) handleSeedDatabase(); }} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm font-medium" disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Initialiser Données Démo</button>
                    </div>
                    <ServiceSettings service={activeService} onReload={loadData} />
                    <SkillsSettings skills={skillsList} onReload={loadData} />
                </div>
             )}
        </main>
      </div>

      {/* MODAL: SHIFT EDITOR */}
      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                <h3 className="font-bold mb-4 text-lg">Modifier Poste</h3>
                <p className="text-sm text-slate-500 mb-4">{selectedCell.date} - {employees.find(e => e.id === selectedCell.empId)?.name}</p>
                <div className="grid grid-cols-4 gap-2">
                     {Object.values(SHIFT_TYPES).map(t => (
                         <button key={t.code} onClick={() => handleShiftChange(t.code as ShiftCode)} className={`p-2 rounded text-xs font-bold transition-transform active:scale-95 ${t.color} ${t.textColor}`}>
                            {t.code}
                         </button>
                     ))}
                </div>
                <button onClick={() => setIsEditorOpen(false)} className="mt-6 w-full border border-slate-300 p-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">Annuler</button>
            </div>
        </div>
      )}

      {/* MODAL: DATE ACTION */}
      {dateModalMode !== 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-6 rounded-xl w-80">
                  <h3 className="font-bold mb-4 text-lg">{dateModalMode === 'generate' ? 'Générer Planning' : 'Réinitialiser Planning'}</h3>
                  <div className="flex gap-2 mb-4">
                      <select value={targetConfig.month} onChange={e => setTargetConfig({...targetConfig, month: parseInt(e.target.value)})} className="p-2 border rounded flex-1">
                          {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleDateString('fr-FR', {month: 'long'})}</option>)}
                      </select>
                      <input type="number" value={targetConfig.year} onChange={e => setTargetConfig({...targetConfig, year: parseInt(e.target.value)})} className="p-2 border rounded w-20" />
                  </div>
                  <button onClick={handleConfirmDateAction} className="w-full bg-blue-600 text-white p-2.5 rounded-lg font-medium hover:bg-blue-700 mb-2">Confirmer</button>
                  <button onClick={() => setDateModalMode('none')} className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-600 hover:bg-slate-50">Annuler</button>
              </div>
          </div>
      )}

      {/* MODAL: EDIT EMPLOYEE (FULL RESTORED) */}
      {editingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
              <div className="bg-white p-6 rounded-xl w-full max-w-2xl my-8">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-xl text-slate-800">Fiche Équipier</h3>
                      <button onClick={() => setEditingEmployee(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Section Identité */}
                      <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-blue-600 uppercase">Identité & Poste</h4>
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Nom complet</label>
                              <input className="w-full border p-2 rounded-lg" value={editingEmployee.name} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} placeholder="Ex: DUPONT Jean" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">Matricule</label>
                                  <input className="w-full border p-2 rounded-lg" value={editingEmployee.matricule} onChange={e => setEditingEmployee({...editingEmployee, matricule: e.target.value})} />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">Quotité (0.1 - 1.0)</label>
                                  <input type="number" step="0.1" min="0" max="1" className="w-full border p-2 rounded-lg" value={editingEmployee.fte} onChange={e => setEditingEmployee({...editingEmployee, fte: parseFloat(e.target.value)})} />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Fonction</label>
                              <select className="w-full border p-2 rounded-lg" value={editingEmployee.role} onChange={e => setEditingEmployee({...editingEmployee, role: e.target.value as any})}>
                                  <option value="Infirmier">Infirmier</option>
                                  <option value="Aide-Soignant">Aide-Soignant</option>
                                  <option value="Cadre">Cadre</option>
                                  <option value="Manager">Manager</option>
                              </select>
                          </div>
                      </div>

                      {/* Section Compteurs & Compétences */}
                      <div className="space-y-6">
                          <div>
                              <h4 className="text-sm font-semibold text-blue-600 uppercase mb-3">Compteurs de Congés</h4>
                              <div className="grid grid-cols-3 gap-2">
                                  <div>
                                      <label className="block text-xs text-slate-500">CA (Jours)</label>
                                      <input type="number" className="w-full border p-1.5 rounded text-sm" 
                                        value={editingEmployee.leaveBalance} 
                                        onChange={e => setEditingEmployee({...editingEmployee, leaveBalance: parseFloat(e.target.value)})} 
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs text-slate-500">RTT</label>
                                      <input type="number" className="w-full border p-1.5 rounded text-sm" 
                                        value={editingEmployee.leaveData?.counters?.RTT?.allowed || 0}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            const updated = {...editingEmployee};
                                            if(!updated.leaveData) updated.leaveData = { year: new Date().getFullYear(), counters: {}, history: [] };
                                            if(!updated.leaveData.counters.RTT) updated.leaveData.counters.RTT = { allowed: 0, taken: 0, reliquat: 0 };
                                            updated.leaveData.counters.RTT.allowed = val;
                                            setEditingEmployee(updated);
                                        }} 
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs text-slate-500">HS (Heures)</label>
                                      <input type="number" className="w-full border p-1.5 rounded text-sm" 
                                         value={editingEmployee.leaveData?.counters?.HS?.allowed || 0}
                                         onChange={e => {
                                             const val = parseFloat(e.target.value);
                                             const updated = {...editingEmployee};
                                             if(!updated.leaveData) updated.leaveData = { year: new Date().getFullYear(), counters: {}, history: [] };
                                             if(!updated.leaveData.counters.HS) updated.leaveData.counters.HS = { allowed: 0, taken: 0, reliquat: 0 };
                                             updated.leaveData.counters.HS.allowed = val;
                                             setEditingEmployee(updated);
                                         }}
                                      />
                                  </div>
                              </div>
                          </div>

                          <div>
                              <h4 className="text-sm font-semibold text-blue-600 uppercase mb-2">Compétences</h4>
                              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 rounded border border-slate-200 min-h-[50px]">
                                  {editingEmployee.skills.map(s => (
                                      <span key={s} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-1">
                                          {s}
                                          <button onClick={() => handleRemoveSkill(s)} className="text-red-500 hover:text-red-700"><X className="w-3 h-3"/></button>
                                      </span>
                                  ))}
                                  {editingEmployee.skills.length === 0 && <span className="text-slate-400 text-xs italic">Aucune compétence</span>}
                              </div>
                              <div className="flex gap-2">
                                  <input 
                                    className="flex-1 border p-1.5 rounded text-sm" 
                                    placeholder="Nouvelle comp." 
                                    value={newSkillInput} 
                                    onChange={e => setNewSkillInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                                  />
                                  <button onClick={handleAddSkill} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded text-sm"><Plus className="w-4 h-4"/></button>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                      <button onClick={saveEmployeeChanges} disabled={isSaving} className="flex-1 bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 font-medium flex justify-center items-center gap-2">
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Enregistrer Fiche
                      </button>
                      <button onClick={() => setEditingEmployee(null)} className="flex-1 border border-slate-300 text-slate-600 p-2.5 rounded-lg hover:bg-slate-50 font-medium">Annuler</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
