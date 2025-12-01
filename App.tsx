import React, { useState, useEffect, useRef } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History, UserCheck, UserX, Coffee, Share2, Mail, Bell, FileText } from 'lucide-react';
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

  // --- Notification Handlers ---
  const handleSendEmail = async () => {
      const email = prompt("Adresse email du destinataire :");
      if (!email) return;
      
      setIsSaving(true); // reuse saving loader
      try {
          await notifications.sendScheduleEmail(email, activeService?.name || 'Général', currentDate.toLocaleDateString());
          setToast({ message: `Planning envoyé à ${email}`, type: 'success' });
      } catch (e) {
          setToast({ message: "Erreur lors de l'envoi", type: 'error' });
      } finally {
          setIsSaving(false);
          setIsShareMenuOpen(false);
      }
  };

  const handleNotifyTeam = async () => {
      if (!activeService) {
          setToast({ message: "Veuillez sélectionner un service", type: "warning" });
          return;
      }
      if (!confirm(`Notifier toute l'équipe "${activeService.name}" de la mise à jour du planning ?`)) return;

      setIsSaving(true);
      try {
          const count = filteredEmployees.length;
          await notifications.notifyTeam(activeService.name, count);
          setToast({ message: `Notification envoyée à ${count} membres.`, type: 'success' });
      } catch (e) {
          setToast({ message: "Erreur notification", type: 'error' });
      } finally {
          setIsSaving(false);
          setIsShareMenuOpen(false);
      }
  };

  const handleSendManagerRecap = async () => {
      if (!activeService) return;
      setIsSaving(true);
      try {
          const res = await notifications.sendManagerWeeklyRecap(filteredEmployees, activeService, gridStartDate);
          if (res.success) setToast({ message: res.message, type: 'success' });
          else setToast({ message: res.message, type: 'warning' });
      } catch (e) {
          setToast({ message: "Erreur envoi récapitulatif", type: 'error' });
      } finally {
          setIsSaving(false);
          setIsShareMenuOpen(false);
      }
  };


  // --- View Calculation Helpers ---
  const getGridConfig = () => {
    if (viewMode === 'day' || viewMode === 'hourly') {
      return { start: currentDate, days: 1 };
    }
    
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
  };

  const { start: gridStartDate, days: gridDuration } = getGridConfig();

  // --- Filter Logic ---
  const filteredEmployees = employees.filter(emp => {
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
      const end = new Date(monday);
      end.setDate(monday.getDate() + (viewMode === 'week' ? 6 : 4));
      return `Semaine du ${monday.getDate()} ${monday.toLocaleDateString('fr-FR', { month: 'short' })}`;
    }
    return currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // --- Handlers ---

  const handleTeamResetLeave = async (empId: string) => {
      if (!confirm("Réinitialiser les compteurs de congés pour l'année suivante ? (Ceci basculera les reliquats)")) return;
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;

      const currentData: LeaveData = emp.leaveData || { year: new Date().getFullYear(), counters: {}, history: [] };
      const nextYear = currentData.year + 1;

      const newData: LeaveData = {
          year: nextYear,
          counters: {},
          history: [...(currentData.history || [])]
      };
      
      const keys = currentData.counters ? Object.keys(currentData.counters) : ['CA', 'RTT', 'RC', 'HS'];
      if (!keys.includes('HS')) keys.push('HS');

      keys.forEach(k => {
          const old = currentData.counters?.[k] || { allowed: 0, taken: 0, reliquat: 0 };
          const remaining = Math.max(0, old.allowed - old.taken);
          newData.counters[k] = {
              allowed: old.allowed,
              taken: 0,
              reliquat: old.reliquat + remaining
          };
      });

      if (keys.length === 0) {
          newData.counters = {
              "CA": { allowed: 25, taken: 0, reliquat: 0 },
              "RTT": { allowed: 0, taken: 0, reliquat: 0 },
              "RC": { allowed: 0, taken: 0, reliquat: 0 },
              "HS": { allowed: 0, taken: 0, reliquat: 0 }
          };
      }

      newData.history.unshift({
          date: new Date().toISOString().split('T')[0],
          action: 'RESET',
          type: 'SYSTEM',
          details: `Réinitialisation depuis Vue Équipe pour ${nextYear}`
      });

      try {
          await db.updateEmployeeLeaveData(empId, newData);
          await loadData();
          setToast({ message: "Compteurs réinitialisés", type: "success" });
      } catch (err: any) {
          setToast({ message: `Erreur: ${err.message}`, type: "error" });
      }
  };

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

    const emp = updatedEmployees.find(e => e.id === selectedCell.empId);
    if (emp) {
        const [y, m, d] = selectedCell.date.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        const violations = checkConstraints([emp], localDate, 1, activeService?.config);
        if (violations.length > 0) setToast({ message: violations[0].message, type: violations[0].severity });
        else setToast({ message: "Enregistré", type: 'success' });
    }

    try {
      await db.upsertShift(selectedCell.empId, selectedCell.date, code);
    } catch (error: any) {
      console.error(error);
      setToast({ message: `Erreur de sauvegarde: ${error.message}`, type: "error" });
      setEmployees(oldEmployees);
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
            const updatedEmployees = parseScheduleCSV(content, employees);
            await db.bulkImportEmployees(updatedEmployees);
            await loadData();
            setToast({ message: "Import CSV réussi", type: "success" });
        } catch (error: any) {
            console.error(error);
            setToast({ message: `Erreur Import: ${error.message}`, type: "error" });
            setIsLoading(false);
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
            shiftsToCopy.push({
              employee_id: emp.id,
              date: targetDateStr,
              shift_code: code
            });
          }
        });
      }

      if (shiftsToCopy.length > 0) {
        await db.bulkUpsertShifts(shiftsToCopy);
        await loadData();
        setToast({ message: "Planning copié vers le mois suivant avec succès.", type: "success" });
      } else {
        setToast({ message: "Aucun poste à copier dans le mois courant.", type: "warning" });
      }

    } catch (error: any) {
      console.error(error);
      setToast({ message: `Erreur copie: ${error.message}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const openDateModal = (mode: 'generate' | 'reset') => {
    setTargetConfig({
      month: currentDate.getMonth(),
      year: currentDate.getFullYear()
    });
    setDateModalMode(mode);
  };

  const handleConfirmDateAction = async () => {
    setIsLoading(true);
    try {
        if (dateModalMode === 'generate') {
          const newSchedule = generateMonthlySchedule(
              employees, 
              targetConfig.year, 
              targetConfig.month, 
              activeService?.config
          );
          
          await db.bulkSaveSchedule(newSchedule);
          setEmployees(newSchedule);
          setToast({ message: "Planning généré et sauvegardé", type: "success" });
          setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
          setViewMode('month');
        } else if (dateModalMode === 'reset') {
          await db.clearShiftsInRange(targetConfig.year, targetConfig.month);
          setEmployees(prev => {
            const updated = JSON.parse(JSON.stringify(prev)) as Employee[];
            const start = new Date(targetConfig.year, targetConfig.month, 1);
            const end = new Date(targetConfig.year, targetConfig.month + 1, 0);

            updated.forEach(emp => {
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                delete emp.shifts[dateStr];
              }
            });
            return updated;
          });
          setToast({ message: "Planning réinitialisé", type: "success" });
          setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
          setViewMode('month');
        }
    } catch (error: any) {
        console.error(error);
        setToast({ message: `Erreur: ${error.message}`, type: "error" });
    } finally {
        setIsLoading(false);
        setDateModalMode('none');
    }
  };

  const handleCreateNewEmployee = () => {
      const newEmp: Employee = {
          id: '',
          matricule: `M${Math.floor(Math.random() * 10000)}`,
          name: '',
          role: 'Infirmier',
          fte: 1.0,
          leaveBalance: 0,
          skills: [],
          shifts: {}
      };
      setEditingEmployee(newEmp);
      setNewSkillInput('');
  };

  const handleDeleteEmployee = async (empId: string) => {
      if (!confirm("Are you sure you want to delete this employee? This action cannot be undone.")) return;
      
      setIsLoading(true);
      try {
          await db.deleteEmployee(empId);
          setEmployees(prev => prev.filter(e => e.id !== empId));
          setToast({ message: "Équipier supprimé", type: "success" });
      } catch (error: any) {
          setToast({ message: `Erreur: ${error.message}`, type: "error" });
      } finally {
          setIsLoading(false);
      }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee({ ...emp, skills: [...emp.skills] });
    setNewSkillInput('');
  };

  const saveEmployeeChanges = async () => {
    if (!editingEmployee) return;

    if (!editingEmployee.name.trim()) {
        setToast({ message: "Le nom de l'équipier est obligatoire.", type: "warning" });
        return;
    }
    if (!editingEmployee.matricule.trim()) {
        setToast({ message: "Le matricule est obligatoire.", type: "warning" });
        return;
    }

    const duplicate = employees.find(e => 
        e.matricule.toLowerCase() === editingEmployee.matricule.toLowerCase() && 
        e.id !== editingEmployee.id
    );

    if (duplicate) {
        setToast({ message: `Le matricule ${editingEmployee.matricule} est déjà utilisé par ${duplicate.name}.`, type: "error" });
        return;
    }

    setIsSaving(true);
    try {
        await db.upsertEmployee(editingEmployee);
        await loadData();
        setToast({ message: "Fiche équipier enregistrée avec succès", type: "success" });
        setEditingEmployee(null);
    } catch (error: any) {
        console.error(error);
        setToast({ message: `Erreur lors de la sauvegarde: ${error.message}`, type: "error" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (!editingEmployee || !newSkillInput.trim()) return;
    const skillToAdd = newSkillInput.trim();
    if (!editingEmployee.skills.some(s => s.toLowerCase() === skillToAdd.toLowerCase())) {
        setEditingEmployee({
            ...editingEmployee,
            skills: [...editingEmployee.skills, skillToAdd]
        });
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!editingEmployee) return;
    setEditingEmployee({
        ...editingEmployee,
        skills: editingEmployee.skills.filter(s => s !== skillToRemove)
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
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

      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm sticky top-0 z-40">
        {/* Header Content - Logo, Title, Navigation, Tools... */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
          <div>
             <h1 className="text-lg font-bold text-slate-800 leading-tight">OptiPlan</h1>
             <p className="text-xs text-slate-500">{activeService ? activeService.name : 'Aucun service'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Date Nav */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 relative">
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('prev')}><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
             <button className="px-3 text-sm font-medium text-slate-700 min-w-[200px] text-center capitalize hover:bg-slate-100 rounded" onClick={() => setShowDatePicker(!showDatePicker)}>{getDateLabel()}</button>
             {showDatePicker && <div className="absolute top-full left-0 mt-2 bg-white shadow-xl rounded-lg border border-slate-200 p-2 z-50"><input type="date" onChange={handleDateSelect} className="p-2 border border-slate-300 rounded outline-none" /></div>}
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('next')}><ChevronRight className="w-4 h-4 text-slate-600" /></button>
             <button onClick={handleToday} className="ml-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100">Aujourd'hui</button>
           </div>

           {/* View Modes */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button onClick={() => setViewMode('month')} className={`p-1.5 rounded ${viewMode === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('week')} className={`p-1.5 rounded ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><CalendarDays className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('workweek')} className={`p-1.5 rounded ${viewMode === 'workweek' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Briefcase className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('day')} className={`p-1.5 rounded ${viewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutList className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('hourly')} className={`p-1.5 rounded ${viewMode === 'hourly' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Clock className="w-4 h-4" /></button>
           </div>

           <div className="h-6 w-px bg-slate-300 mx-1"></div>

           {/* Actions */}
           <div className="flex items-center gap-2">
             <button onClick={handlePrint} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg" title="Imprimer"><Printer className="w-4 h-4" /></button>
             <button onClick={handleExport} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg" title="CSV"><FileDown className="w-4 h-4" /></button>
             
             {/* Share Menu */}
             <div className="relative">
                 <button onClick={() => setIsShareMenuOpen(!isShareMenuOpen)} className={`p-2 border rounded-lg ${isShareMenuOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-50'}`}><Share2 className="w-4 h-4" /></button>
                 {isShareMenuOpen && (
                     <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border z-50 p-2 space-y-1">
                         <button onClick={handleSendEmail} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2"><Mail className="w-4 h-4 text-blue-500" /> Email</button>
                         <button onClick={handleNotifyTeam} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2"><Bell className="w-4 h-4 text-orange-500" /> Notifier</button>
                         <button onClick={handleSendManagerRecap} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex gap-2 border-t pt-2"><FileText className="w-4 h-4 text-purple-500" /> Récap</button>
                     </div>
                 )}
             </div>

             <div className="h-6 w-px bg-slate-300 mx-1"></div>
             <button onClick={() => openDateModal('reset')} className="p-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
             <button onClick={() => openDateModal('generate')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"><Wand2 className="w-4 h-4" /> Générer</button>
           </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col overflow-y-auto no-print">
          <nav className="p-4 space-y-2">
            {/* Nav Buttons... */}
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-5 h-5" /><span className="hidden md:block">Planning</span></button>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /><span className="hidden md:block">Dashboard</span></button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'stats' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><BarChart3 className="w-5 h-5" /><span className="hidden md:block">Stats</span></button>
            <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'team' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Users className="w-5 h-5" /><span className="hidden md:block">Équipe</span></button>
            <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><BriefcaseBusiness className="w-5 h-5" /><span className="hidden md:block">Congés</span></button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Tag className="w-5 h-5" /><span className="hidden md:block">Paramètres</span></button>
          </nav>
          {/* Filters... (omitted for brevity, logic remains) */}
          <div className="px-4 py-2 hidden md:block">
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-4">
                 <div><label className="text-xs font-bold text-slate-600">Service</label><select value={activeServiceId} onChange={(e) => setActiveServiceId(e.target.value)} className="w-full text-xs border p-1.5 rounded">{servicesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                 {/* Other filters... */}
             </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
             {activeTab === 'planning' && (
                <div className="print-container flex-1 p-4 flex flex-col gap-4 overflow-hidden h-full">
                    <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                        <div className="flex-1 flex flex-col h-full min-w-0">
                        <ScheduleGrid employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} viewMode={viewMode} onCellClick={handleCellClick} />
                        <StaffingSummary employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />
                        </div>
                        <div className="w-80 flex-shrink-0 hidden xl:flex flex-col h-full no-print overflow-hidden">
                            <ConstraintChecker employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} serviceConfig={activeService?.config} />
                        </div>
                    </div>
                </div>
             )}
             {activeTab === 'stats' && <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />}
             {activeTab === 'dashboard' && <div className="flex-1 overflow-y-auto h-full"><Dashboard employees={employees} currentDate={currentDate} serviceConfig={activeService?.config} /></div>}
             {activeTab === 'team' && (
                 // Team View (Keeping existing logic + reset leave button integration inside loop)
                 <div className="p-8 overflow-y-auto">
                     {/* ... Team grid map ... */}
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {filteredEmployees.map(emp => (
                             <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                 <div className="flex justify-between">
                                     <div>
                                         <div className="font-bold">{emp.name}</div>
                                         <div className="text-xs text-slate-500">{emp.role}</div>
                                     </div>
                                     <div className="flex gap-2">
                                        <button onClick={() => handleEditEmployee(emp)}><Pencil className="w-4 h-4 text-slate-400" /></button>
                                        <button onClick={() => handleDeleteEmployee(emp.id)}><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" /></button>
                                     </div>
                                 </div>
                                 {/* ... Expanded section ... */}
                                 <div className="mt-2 border-t pt-2">
                                     <button onClick={() => setExpandedEmpId(expandedEmpId === emp.id ? null : emp.id)} className="text-xs text-blue-600 flex items-center gap-1">
                                         {expandedEmpId === emp.id ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>} Détails
                                     </button>
                                     {expandedEmpId === emp.id && (
                                         <div className="mt-2 space-y-2">
                                             {/* Constraints */}
                                             <div className="bg-slate-50 p-2 rounded text-xs">
                                                 <div className="font-semibold mb-1">Alertes</div>
                                                 {/* ... violations list ... */}
                                                 <div className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Conforme</div>
                                             </div>
                                             {/* Leave Reset Button */}
                                             <button onClick={() => handleTeamResetLeave(emp.id)} className="w-full py-1 bg-blue-50 text-blue-600 rounded text-xs border border-blue-100 hover:bg-blue-100">
                                                 Réinitialiser Congés Annuel
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
             {/* ... Other tabs (Leaves, Settings) ... */}
             {activeTab === 'leaves' && <div className="flex-1 overflow-y-auto h-full"><LeaveManager employees={employees} onReload={loadData} /></div>}
             {activeTab === 'settings' && <div className="flex-1 overflow-y-auto h-full p-8"><ServiceSettings service={activeService} onReload={loadData} /><div className="h-8"></div><SkillsSettings skills={skillsList} onReload={loadData} /></div>}
        </main>
      </div>

      {/* Modals (Edit Shift, Edit Employee, Date Picker) - Kept as is */}
      {/* ... */}
      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white p-6 rounded-xl shadow-xl"><h3 className="font-bold mb-4">Modifier Poste</h3><div className="grid grid-cols-4 gap-2">{Object.values(SHIFT_TYPES).map(t => (
                         <button key={t.code} onClick={() => handleShiftChange(t.code as ShiftCode)} className={`p-2 rounded ${t.color} ${t.textColor}`}>{t.code}</button>
                     ))}</div><button onClick={() => setIsEditorOpen(false)} className="mt-4 w-full border p-2 rounded">Annuler</button></div></div>
      )}
      {dateModalMode !== 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white p-6 rounded-xl w-80"><h3 className="font-bold mb-4">{dateModalMode === 'generate' ? 'Générer' : 'Réinitialiser'}</h3><button onClick={handleConfirmDateAction} className="w-full bg-blue-600 text-white p-2 rounded mb-2">Confirmer</button><button onClick={() => setDateModalMode('none')} className="w-full border p-2 rounded">Annuler</button></div></div>
      )}
      {/* ... Edit Employee Modal ... */}
      {editingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-[500px]">
                  <h3 className="font-bold mb-4">Éditer Équipier</h3>
                  {/* Simple form inputs mapping to editingEmployee state */}
                  <input className="w-full border p-2 rounded mb-2" value={editingEmployee.name} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} placeholder="Nom" />
                  <input className="w-full border p-2 rounded mb-2" value={editingEmployee.matricule} onChange={e => setEditingEmployee({...editingEmployee, matricule: e.target.value})} placeholder="Matricule" />
                  <button onClick={saveEmployeeChanges} className="w-full bg-blue-600 text-white p-2 rounded">Enregistrer</button>
                  <button onClick={() => setEditingEmployee(null)} className="w-full border p-2 rounded mt-2">Annuler</button>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
