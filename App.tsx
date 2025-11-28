
// ... imports are the same as provided App.tsx ...
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload, Database, Loader2, FileDown, LayoutGrid, CalendarDays, LayoutList, Clock, Briefcase, BriefcaseBusiness, Printer, Tag, LayoutDashboard, AlertCircle, CheckCircle, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Copy, Store, History } from 'lucide-react';
import { ScheduleGrid } from './components/ScheduleGrid';
import { StaffingSummary } from './components/StaffingSummary';
import { StatsPanel } from './components/StatsPanel';
import { ConstraintChecker } from './components/ConstraintChecker';
import { LeaveManager } from './components/LeaveManager';
import { SkillsSettings } from './components/SkillsSettings';
import { ServiceSettings } from './components/ServiceSettings';
import { Dashboard } from './components/Dashboard';
import { SHIFT_TYPES } from './constants';
import { Employee, ShiftCode, ViewMode, Skill, Service, LeaveData } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';
import { exportScheduleToCSV } from './utils/csvExport';
import { Toast } from './components/Toast';
import { checkConstraints } from './utils/validation';
import * as db from './services/db';

function App() {
  const [activeTab, setActiveTab] = useState<'planning' | 'stats' | 'team' | 'leaves' | 'settings' | 'dashboard'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string>('');
  
  const [selectedCell, setSelectedCell] = useState<{empId: string, date: string} | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null); 
  const [newSkillInput, setNewSkillInput] = useState(''); 
  
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
      const [empData, skillsData, servicesData] = await Promise.all([
          db.fetchEmployeesWithShifts(),
          db.fetchSkills(),
          db.fetchServices()
      ]);
      setEmployees(empData);
      setSkillsList(skillsData);
      setServicesList(servicesData);
      
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

  // Filter Logic
  const filteredEmployees = employees.filter(emp => {
    const roleMatch = roleFilter === 'all' || emp.role === roleFilter;
    const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
    
    // Service Qualification Filter
    let qualificationMatch = true;
    if (showQualifiedOnly && activeService?.config?.requiredSkills?.length > 0) {
        const reqSkills = activeService.config.requiredSkills;
        const hasSkill = emp.skills.some(s => reqSkills.includes(s));
        qualificationMatch = hasSkill;
    }

    return roleMatch && skillMatch && qualificationMatch;
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

  // --- View Calculation Helpers ---
  const getGridConfig = () => {
    if (viewMode === 'day' || viewMode === 'hourly') {
      return { start: currentDate, days: 1 };
    }
    
    if (viewMode === 'week') {
      // Calculate Monday of current week
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const monday = new Date(currentDate);
      monday.setDate(diff);
      return { start: monday, days: 7 };
    }

    if (viewMode === 'workweek') {
      // Calculate Monday of current week
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(currentDate);
      monday.setDate(diff);
      return { start: monday, days: 5 }; // Only 5 days (Mon-Fri)
    }

    // Month Mode
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    return { start, days: daysInMonth };
  };

  const { start: gridStartDate, days: gridDuration } = getGridConfig();

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
      
      // Init or Carry over counters
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

    // Validation
    const emp = updatedEmployees.find(e => e.id === selectedCell.empId);
    if (emp) {
        const [y, m, d] = selectedCell.date.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        
        const violations = checkConstraints([emp], localDate, 1, activeService?.config);
        if (violations.length > 0) {
            setToast({ message: violations[0].message, type: violations[0].severity });
        } else {
            setToast({ message: "Enregistré", type: 'success' });
        }
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
    try {
      exportScheduleToCSV(employees, currentDate);
      setToast({ message: "Exportation réussie", type: "success" });
    } catch (error: any) {
      console.error(error);
      setToast({ message: "Erreur lors de l'exportation", type: "error" });
    }
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
          console.error(error);
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

  const downloadSqlSchema = () => {
    const sqlContent = `
-- Script SQL pour Supabase

CREATE TABLE IF NOT EXISTS public.skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    code TEXT NOT NULL UNIQUE, 
    label TEXT NOT NULL
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for skills" ON public.skills;
CREATE POLICY "Enable all access for skills" ON public.skills FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    config JSONB DEFAULT '{"openDays": [1, 2, 3, 4, 5, 6]}'::jsonb
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for services" ON public.services;
CREATE POLICY "Enable all access for services" ON public.services FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.services (name, config) VALUES ('Dialyse', '{"openDays": [1, 2, 3, 4, 5, 6]}') ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    matricule TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    fte NUMERIC DEFAULT 1.0,
    leave_balance NUMERIC DEFAULT 0,
    leave_data JSONB,
    skills TEXT[] DEFAULT '{}'::TEXT[]
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for employees" ON public.employees;
CREATE POLICY "Enable all access for employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_code TEXT NOT NULL,
    CONSTRAINT unique_shift_per_day UNIQUE (employee_id, date)
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for shifts" ON public.shifts;
CREATE POLICY "Enable all access for shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.skills (code, label) SELECT 'Senior', 'Infirmier Senior' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'Senior');
INSERT INTO public.skills (code, label) SELECT 'Tutorat', 'Habilité Tutorat' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'Tutorat');
INSERT INTO public.skills (code, label) SELECT 'Dialyse', 'Spécialisation Dialyse' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'Dialyse');
INSERT INTO public.skills (code, label) SELECT 'IT', 'Jour 06h30-18h30' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'IT');
INSERT INTO public.skills (code, label) SELECT 'T5', 'Matin Long 07h00-17h30' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'T5');
INSERT INTO public.skills (code, label) SELECT 'T6', 'Journée 07h30-18h00' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'T6');
INSERT INTO public.skills (code, label) SELECT 'S', 'Soir 17h30-00h00' WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE code = 'S');
    `;
    
    const blob = new Blob([sqlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supabase_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shiftOptions = Object.values(SHIFT_TYPES);
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const years = [2024, 2025, 2026];

  if (isLoading && employees.length === 0) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-slate-500">Connexion à Supabase...</p>
          </div>
      );
  }

  const getDateLabel = () => {
    if (viewMode === 'day' || viewMode === 'hourly') {
      return currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week' || viewMode === 'workweek') {
      const endOfWeek = new Date(gridStartDate);
      const diff = viewMode === 'workweek' ? 4 : 6;
      endOfWeek.setDate(endOfWeek.getDate() + diff);
      return `Semaine du ${gridStartDate.getDate()} au ${endOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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

      {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
             <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
             <h1 className="text-lg font-bold text-slate-800 leading-tight">OptiPlan</h1>
             <p className="text-xs text-slate-500 flex items-center gap-1">
                {activeService ? activeService.name : 'Aucun service'} 
                <span className="text-slate-300">•</span> 
                Supabase
             </p>
          </div>
          <button onClick={downloadSqlSchema} className="ml-2 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Télécharger Schéma SQL">
             <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
           {/* Date Navigation */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200 relative">
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('prev')}>
               <ChevronLeft className="w-4 h-4 text-slate-600" />
             </button>
             
             <button 
                className="px-3 text-sm font-medium text-slate-700 min-w-[200px] text-center capitalize hover:bg-slate-100 rounded"
                onClick={() => setShowDatePicker(!showDatePicker)}
             >
                {getDateLabel()}
             </button>

             {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white shadow-xl rounded-lg border border-slate-200 p-2 z-50">
                    <input 
                        type="date" 
                        onChange={handleDateSelect}
                        className="p-2 border border-slate-300 rounded outline-none"
                    />
                </div>
             )}

             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => handleDateNavigate('next')}>
               <ChevronRight className="w-4 h-4 text-slate-600" />
             </button>

             <button 
                onClick={handleToday}
                className="ml-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100"
             >
                Aujourd'hui
             </button>
           </div>
           
           {/* View Modes */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button 
                onClick={() => setViewMode('month')} 
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Mois"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('week')} 
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Semaine (7j)"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('workweek')} 
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'workweek' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Semaine Ouvrée (5j)"
              >
                <Briefcase className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('day')} 
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Journée"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('hourly')} 
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'hourly' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Vue Horaire"
              >
                <Clock className="w-4 h-4" />
              </button>
           </div>
           
           <div className="h-6 w-px bg-slate-300 mx-1"></div>

           <div className="flex items-center gap-2">
             <button 
                onClick={handlePrint}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors shadow-sm"
                title="Imprimer / PDF"
             >
                <Printer className="w-4 h-4" />
             </button>

             <button 
                onClick={handleExport}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors shadow-sm"
                title="Exporter en CSV"
             >
                <FileDown className="w-4 h-4" />
             </button>

             <label className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors shadow-sm cursor-pointer" title="Import CSV">
                <Upload className="w-4 h-4" />
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
             </label>

             <button 
               onClick={handleCopyToNextMonth}
               className="p-2 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-lg transition-colors shadow-sm"
               title="Copier vers M+1"
             >
                <Copy className="w-4 h-4" />
             </button>

             <button 
               onClick={() => openDateModal('reset')}
               className="p-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition-colors shadow-sm"
               title="Réinitialiser"
             >
                <RefreshCw className="w-4 h-4" />
             </button>

             <button 
               onClick={() => openDateModal('generate')}
               className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors shadow-sm"
             >
                <Wand2 className="w-4 h-4" />
                <span className="hidden xl:inline">Générer</span>
             </button>
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-16 md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col overflow-y-auto no-print">
          <nav className="p-4 space-y-2">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Calendar className="w-5 h-5" />
              <span className="hidden md:block">Planning</span>
            </button>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden md:block">Carnet de bord</span>
            </button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <BarChart3 className="w-5 h-5" />
              <span className="hidden md:block">Statistiques</span>
            </button>
            <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'team' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Users className="w-5 h-5" />
              <span className="hidden md:block">Équipe</span>
            </button>
            <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'leaves' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <BriefcaseBusiness className="w-5 h-5" />
              <span className="hidden md:block">Congés</span>
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Tag className="w-5 h-5" />
              <span className="hidden md:block">Paramètres</span>
            </button>
          </nav>

          {/* Filters */}
          <div className="px-4 py-2 hidden md:block">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-3 text-slate-500">
                <Filter className="w-4 h-4" />
                <h3 className="text-xs font-semibold uppercase">Filtres & Contexte</h3>
              </div>
              <div className="space-y-4">
                {/* Service Filter */}
                <div>
                   <label className="text-xs text-slate-600 font-bold mb-1.5 block flex items-center justify-between">
                      Service
                      <span className="text-[10px] font-normal text-blue-600">Actif</span>
                   </label>
                   <div className="relative">
                       <Store className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                       <select value={activeServiceId} onChange={(e) => setActiveServiceId(e.target.value)} className="w-full text-xs border-slate-200 rounded-md py-1.5 pl-8 pr-2 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none">
                           {servicesList.map(s => (
                               <option key={s.id} value={s.id}>{s.name}</option>
                           ))}
                           {servicesList.length === 0 && <option value="">Aucun service</option>}
                       </select>
                   </div>
                   {activeService && (
                       <div className="mt-2 space-y-1">
                           <p className="text-[10px] text-slate-400 flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {activeService.config.openDays.includes(0) ? "Ouvert 7j/7" : "Fermé le Dimanche"}
                           </p>
                           {/* Show Required Skills indicator if any */}
                           {activeService.config.requiredSkills && activeService.config.requiredSkills.length > 0 && (
                                <div className="text-[10px] text-purple-600 flex items-center gap-1 font-medium bg-purple-50 p-1 rounded">
                                    <ShieldCheck className="w-3 h-3" />
                                    {activeService.config.requiredSkills.length} Compétence(s) Requise(s)
                                </div>
                           )}
                       </div>
                   )}
                </div>

                <div className="h-px bg-slate-200 my-2"></div>

                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Rôle</label>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full text-xs border-slate-200 rounded-md p-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="all">Tous les rôles</option>
                    <option value="Infirmier">Infirmier</option>
                    <option value="Aide-Soignant">Aide-Soignant</option>
                    <option value="Cadre">Cadre</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Compétence</label>
                  <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full text-xs border-slate-200 rounded-md p-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="all">Toutes</option>
                    {skillsList.map(skill => (
                        <option key={skill.code} value={skill.code}>
                            {skill.code}
                        </option>
                    ))}
                  </select>
                </div>

                {/* Qualified Only Toggle - Visible only if Service has requirements */}
                {activeService?.config?.requiredSkills && activeService.config.requiredSkills.length > 0 && (
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={showQualifiedOnly}
                                    onChange={(e) => setShowQualifiedOnly(e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </div>
                            <span className="text-xs font-medium text-slate-600 group-hover:text-purple-700 transition-colors">
                                Qualifiés uniquement
                            </span>
                        </label>
                        <p className="text-[10px] text-slate-400 mt-1 pl-1">
                            Masque les employés sans les compétences requises par le service.
                        </p>
                    </div>
                )}

              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {employees.length === 0 && !isLoading ? (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <Database className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">Base de données vide</h3>
                <p className="text-slate-500 max-w-md mb-6">Aucun collaborateur trouvé dans la base Supabase. Vous pouvez initialiser la base avec des données de démonstration.</p>
                <button 
                    onClick={handleSeedDatabase}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm flex items-center gap-2"
                >
                    <Wand2 className="w-5 h-5" />
                    Initialiser les données (Seeding)
                </button>
             </div>
          ) : (
             <>
                {/* Main Grid View */}
                {activeTab === 'planning' && (
                    <div className="print-container flex-1 p-4 flex flex-col gap-4 overflow-hidden h-full">
                        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                          <div className="flex-1 flex flex-col h-full min-w-0">
                            <ScheduleGrid 
                                employees={filteredEmployees} 
                                startDate={gridStartDate} 
                                days={gridDuration} 
                                viewMode={viewMode}
                                onCellClick={handleCellClick}
                            />
                            {/* Staffing Summary Below Grid */}
                            <StaffingSummary 
                                employees={filteredEmployees}
                                startDate={gridStartDate}
                                days={gridDuration}
                            />
                          </div>
                          <div className="w-80 flex-shrink-0 hidden xl:flex flex-col h-full no-print overflow-hidden">
                             <ConstraintChecker 
                                employees={filteredEmployees} 
                                startDate={gridStartDate} 
                                days={gridDuration} 
                                serviceConfig={activeService?.config}
                             />
                          </div>
                        </div>
                    </div>
                )}
                
                {/* Dashboard View (New) */}
                {activeTab === 'dashboard' && (
                    <div className="flex-1 overflow-y-auto h-full">
                        <Dashboard 
                            employees={employees} 
                            currentDate={currentDate} 
                            serviceConfig={activeService?.config}
                        />
                    </div>
                )}

                {/* Stats View */}
                {activeTab === 'stats' && (
                    <div className="flex-1 overflow-hidden h-full">
                        <StatsPanel employees={filteredEmployees} startDate={gridStartDate} days={gridDuration} />
                    </div>
                )}

                {/* Leaves Management View */}
                {activeTab === 'leaves' && (
                    <div className="flex-1 overflow-y-auto h-full">
                        <LeaveManager employees={employees} onReload={loadData} />
                    </div>
                )}
                
                {/* Settings View (Skills & Service) */}
                {activeTab === 'settings' && (
                    <div className="flex-1 overflow-y-auto h-full p-8 space-y-8">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <ServiceSettings service={activeService} onReload={loadData} />
                            <SkillsSettings skills={skillsList} onReload={loadData} />
                        </div>
                    </div>
                )}

                {/* Team List View */}
                {activeTab === 'team' && (
                    <div className="p-8 overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6 text-slate-800">Gestion de l'équipe</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredEmployees.map(emp => {
                                // Calculate violations ONLY if expanded to avoid perf hit on all cards
                                const empViolations = expandedEmpId === emp.id 
                                    ? checkConstraints([emp], gridStartDate, gridDuration, activeService?.config).filter(v => v.employeeId === emp.id)
                                    : [];
                                
                                const leaveData = emp.leaveData || { year: new Date().getFullYear(), counters: {}, history: [] };

                                return (
                                <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-4 relative group hover:border-blue-300 transition-all">
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditEmployee(emp)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors" title="Modifier">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors" title="Supprimer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">{emp.name}</div>
                                            <div className="text-xs text-slate-400 font-mono mb-0.5">#{emp.matricule}</div>
                                            <div className="text-sm text-slate-500">{emp.role}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold">Quotité:</span> 
                                            <span>{Math.round(emp.fte * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold">Solde CA:</span> 
                                            <span className="font-bold text-blue-600">{emp.leaveBalance || 0}j</span>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3">
                                        <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Compétences</div>
                                        <div className="flex flex-wrap gap-2">
                                            {emp.skills.length > 0 ? emp.skills.map(s => (
                                            <span key={s} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-100 rounded-full text-slate-600 uppercase tracking-wide border border-slate-200">
                                                {s}
                                            </span>
                                            )) : (
                                                <span className="text-[10px] italic text-slate-400">Aucune</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section Dépliable : Conformité & Congés */}
                                    <div className="mt-2 border-t border-slate-100 pt-2">
                                        <button 
                                            onClick={() => setExpandedEmpId(expandedEmpId === emp.id ? null : emp.id)}
                                            className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded transition-colors"
                                        >
                                            {expandedEmpId === emp.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            {expandedEmpId === emp.id ? 'Masquer Détails' : 'Voir Détails & Congés'}
                                        </button>
                                        
                                        {expandedEmpId === emp.id && (
                                            <div className="mt-2 text-xs animate-in slide-in-from-top-2 duration-200 space-y-3">
                                                {/* Conformité */}
                                                <div className="bg-slate-50 rounded p-3">
                                                    <div className="mb-2 font-semibold text-slate-600 flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3" /> Conformité (Période affichée)
                                                    </div>
                                                    {empViolations.length === 0 ? (
                                                        <div className="flex items-center gap-2 text-green-600">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span>Aucune anomalie.</span>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {empViolations.map((v, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-red-600 bg-white p-2 rounded border border-red-100 shadow-sm">
                                                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                                    <div>
                                                                        <div className="font-semibold">{v.date}</div>
                                                                        <div>{v.message}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Congés & Historique */}
                                                <div className="bg-blue-50 rounded p-3 border border-blue-100">
                                                    <div className="mb-2 font-semibold text-blue-700 flex items-center justify-between">
                                                        <span className="flex items-center gap-1"><History className="w-3 h-3" /> Congés {leaveData.year}</span>
                                                        <button 
                                                            onClick={() => handleTeamResetLeave(emp.id)}
                                                            className="px-2 py-1 bg-white text-blue-600 border border-blue-200 rounded hover:bg-blue-100 text-[10px]"
                                                        >
                                                            Reset Annuel
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Compteurs Rapides */}
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        {Object.entries(leaveData.counters || {}).map(([key, val]) => (
                                                            <div key={key} className="bg-white p-1.5 rounded text-center border border-blue-100">
                                                                <div className="text-[10px] font-bold text-slate-500">{key}</div>
                                                                <div className="text-sm font-bold text-blue-600">{val.allowed + val.reliquat - val.taken}</div>
                                                            </div>
                                                        ))}
                                                        {(!leaveData.counters || Object.keys(leaveData.counters).length === 0) && (
                                                            <div className="col-span-3 text-center text-slate-400 italic">Aucun compteur</div>
                                                        )}
                                                    </div>

                                                    {/* Derniers Historiques */}
                                                    <div className="space-y-1">
                                                        {leaveData.history && leaveData.history.length > 0 ? (
                                                            leaveData.history.slice(0, 3).map((h, i) => (
                                                                <div key={i} className="flex gap-2 text-[10px] text-slate-600 bg-white p-1 rounded border border-slate-100">
                                                                    <span className="font-mono text-slate-400">{h.date}</span>
                                                                    <span className={`font-bold ${h.action === 'PRIS' ? 'text-orange-500' : 'text-blue-500'}`}>{h.type || h.action}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="text-[10px] text-center text-slate-400">Aucun historique récent</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )})}
                            <button 
                                onClick={handleCreateNewEmployee}
                                className="border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-[160px]"
                            >
                                <Plus className="w-8 h-8 mb-2" />
                                <span className="font-medium">Ajouter un membre</span>
                            </button>
                        </div>
                    </div>
                )}
             </>
          )}
        </main>
      </div>

      {/* Edit Shift Modal */}
      {isEditorOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw] animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-lg font-bold text-slate-900">Modifier le poste</h3>
                  <p className="text-sm text-slate-500">{employees.find(e => e.id === selectedCell.empId)?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{new Date(selectedCell.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
               </div>
               <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-slate-600">
                 <X className="w-6 h-6" />
               </button>
             </div>
             
             <div className="grid grid-cols-3 gap-2">
               {shiftOptions.map((type) => (
                 <button
                   key={type.code}
                   onClick={() => handleShiftChange(type.code as ShiftCode)}
                   className={`${type.color} ${type.textColor} p-2 rounded-lg text-sm font-semibold shadow-sm border border-black/5 hover:brightness-95 flex flex-col items-center justify-center gap-1 h-16`}
                 >
                   <span>{type.code}</span>
                   {type.code !== type.label && <span className="text-[10px] font-normal opacity-75">{type.label}</span>}
                 </button>
               ))}
               <button 
                  onClick={() => handleShiftChange('OFF')}
                  className="bg-slate-50 text-slate-500 border border-slate-200 p-2 rounded-lg text-sm font-semibold hover:bg-slate-100 flex items-center justify-center h-16"
                >
                  Effacer
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Employee Profile Editor Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px] max-w-[90vw] animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {editingEmployee.id ? "Modifier l'équipier" : "Nouvel équipier"}
                        </h3>
                        <p className="text-sm text-slate-500">Mettez à jour les informations RH</p>
                    </div>
                    <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nom Complet <span className="text-red-500">*</span></label>
                            <input type="text" value={editingEmployee.name} onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: DUPONT Jean" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Matricule <span className="text-red-500">*</span></label>
                            <input type="text" value={editingEmployee.matricule} onChange={(e) => setEditingEmployee({...editingEmployee, matricule: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="ex: M042" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fonction / Rôle</label>
                            <select value={editingEmployee.role} onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value as any})} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none">
                                <option value="Infirmier">Infirmier</option>
                                <option value="Aide-Soignant">Aide-Soignant</option>
                                <option value="Cadre">Cadre</option>
                                <option value="Manager">Manager</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quotité (ETP)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    step="0.05" 
                                    min="0" 
                                    max="1" 
                                    value={editingEmployee.fte} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setEditingEmployee({...editingEmployee, fte: isNaN(val) ? 0 : val});
                                    }} 
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-sm font-semibold text-slate-500 w-12 text-right">
                                    {Math.round(editingEmployee.fte * 100)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Compétences</label>
                        <div className="flex flex-wrap gap-2 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[42px]">
                            {editingEmployee.skills.map(skill => (
                                <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {skill}
                                    <button onClick={() => handleRemoveSkill(skill)} className="hover:bg-blue-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={newSkillInput} onChange={(e) => setNewSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()} className="flex-1 p-2 border border-slate-300 rounded-lg outline-none text-sm" placeholder="Ajouter (ex: T5, IT)..." />
                            <button onClick={handleAddSkill} disabled={!newSkillInput.trim()} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"><Plus className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setEditingEmployee(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Annuler</button>
                    <button onClick={saveEmployeeChanges} disabled={isSaving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm flex items-center justify-center gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Date Modal */}
      {dateModalMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-80 max-w-[90vw] animate-in fade-in zoom-in duration-200">
              <div className="mb-4">
                 <h3 className="text-lg font-bold text-slate-900">{dateModalMode === 'generate' ? 'Générer Planning' : 'Réinitialiser Planning'}</h3>
              </div>
              <div className="space-y-3 mb-6">
                 <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Mois</label>
                    <select value={targetConfig.month} onChange={(e) => setTargetConfig(prev => ({...prev, month: parseInt(e.target.value)}))} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none">
                       {months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Année</label>
                    <select value={targetConfig.year} onChange={(e) => setTargetConfig(prev => ({...prev, year: parseInt(e.target.value)}))} className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none">
                       {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setDateModalMode('none')} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">Annuler</button>
                 <button onClick={handleConfirmDateAction} disabled={isLoading} className={`flex-1 px-4 py-2 text-white rounded-lg ${dateModalMode === 'reset' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
