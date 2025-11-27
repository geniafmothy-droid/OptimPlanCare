
import React, { useState, useEffect } from 'react';
import { Calendar, BarChart3, Users, Settings, Plus, ChevronLeft, ChevronRight, Download, Filter, Wand2, Trash2, X, RefreshCw, Pencil, Save, Upload } from 'lucide-react';
import { ScheduleGrid } from './components/ScheduleGrid';
import { StatsPanel } from './components/StatsPanel';
import { ConstraintChecker } from './components/ConstraintChecker';
import { MOCK_EMPLOYEES, SHIFT_TYPES } from './constants';
import { Employee, ShiftCode } from './types';
import { generateMonthlySchedule } from './utils/scheduler';
import { parseScheduleCSV } from './utils/csvImport';

function App() {
  const [activeTab, setActiveTab] = useState<'planning' | 'stats' | 'team'>('planning');
  const [currentDate, setCurrentDate] = useState(new Date('2024-12-01'));
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [selectedCell, setSelectedCell] = useState<{empId: string, date: string} | null>(null);

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null); // For Employee Profile Editor
  const [newSkillInput, setNewSkillInput] = useState(''); // For adding skills in editor
  
  // Date Selection Modal State (for Generate and Reset)
  const [dateModalMode, setDateModalMode] = useState<'none' | 'generate' | 'reset'>('none');
  const [targetConfig, setTargetConfig] = useState({ 
    month: new Date().getMonth(), 
    year: new Date().getFullYear() 
  });

  // Filter Logic
  const filteredEmployees = employees.filter(emp => {
    const roleMatch = roleFilter === 'all' || emp.role === roleFilter;
    const skillMatch = skillFilter === 'all' || emp.skills.includes(skillFilter);
    return roleMatch && skillMatch;
  });

  // --- Handlers ---

  const handleCellClick = (empId: string, date: string) => {
    setSelectedCell({ empId, date });
    setIsEditorOpen(true);
  };

  const handleShiftChange = (code: ShiftCode) => {
    if (!selectedCell) return;
    
    setEmployees(prev => prev.map(emp => {
      if (emp.id === selectedCell.empId) {
        return {
          ...emp,
          shifts: { ...emp.shifts, [selectedCell.date]: code }
        };
      }
      return emp;
    }));
    setIsEditorOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const updatedEmployees = parseScheduleCSV(content, employees);
        setEmployees(updatedEmployees);
      }
    };
    reader.readAsText(file);
    // Reset value to allow re-uploading the same file if needed
    event.target.value = '';
  };

  // Open the configuration modal
  const openDateModal = (mode: 'generate' | 'reset') => {
    setTargetConfig({
      month: currentDate.getMonth(),
      year: currentDate.getFullYear()
    });
    setDateModalMode(mode);
  };

  const handleConfirmDateAction = () => {
    if (dateModalMode === 'generate') {
      const newSchedule = generateMonthlySchedule(employees, targetConfig.year, targetConfig.month);
      setEmployees(newSchedule);
      setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
    } else if (dateModalMode === 'reset') {
      setEmployees(prev => {
        const updated = JSON.parse(JSON.stringify(prev)) as Employee[];
        const start = new Date(targetConfig.year, targetConfig.month, 1);
        const end = new Date(targetConfig.year, targetConfig.month + 1, 0);

        updated.forEach(emp => {
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            delete emp.shifts[dateStr];
          }
        });
        return updated;
      });
      setCurrentDate(new Date(targetConfig.year, targetConfig.month, 1));
    }
    setDateModalMode('none');
  };

  // Employee Editor Handlers
  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee({ ...emp }); // Deep copy handled by spread for first level, sufficient here
    setNewSkillInput('');
  };

  const saveEmployeeChanges = () => {
    if (!editingEmployee) return;
    setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? editingEmployee : e));
    setEditingEmployee(null);
  };

  const handleAddSkill = () => {
    if (!editingEmployee || !newSkillInput.trim()) return;
    const skillToAdd = newSkillInput.trim();
    // Prevent duplicates (case insensitive check could be added if needed)
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

  const shiftOptions = Object.values(SHIFT_TYPES);
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const years = [2024, 2025, 2026];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
             <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
             <h1 className="text-lg font-bold text-slate-800 leading-tight">OptiPlan</h1>
             <p className="text-xs text-slate-500">Service Dialyse</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Date Navigation */}
           <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
               <ChevronLeft className="w-4 h-4 text-slate-600" />
             </button>
             <span className="px-3 text-sm font-medium text-slate-700 min-w-[120px] text-center">
                {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
             </span>
             <button className="p-1 hover:bg-slate-200 rounded" onClick={() => setCurrentDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
               <ChevronRight className="w-4 h-4 text-slate-600" />
             </button>
           </div>
           
           <div className="flex items-center gap-2">
             <label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm cursor-pointer" title="Format: Nom;Date1;Date2...">
                <Upload className="w-4 h-4" />
                <span className="hidden xl:inline">Import CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
             </label>

             <div className="w-px h-6 bg-slate-300 mx-1"></div>

             <button 
               onClick={() => openDateModal('reset')}
               className="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
               title="Effacer le planning"
             >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden xl:inline">Réinitialiser</span>
             </button>

             <button 
               onClick={() => openDateModal('generate')}
               className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
             >
                <Wand2 className="w-4 h-4" />
                <span className="hidden md:inline">Générer Auto</span>
             </button>
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Navigation */}
        <aside className="w-16 md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col overflow-y-auto">
          <nav className="p-4 space-y-2">
            <button 
              onClick={() => setActiveTab('planning')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Calendar className="w-5 h-5" />
              <span className="hidden md:block">Planning</span>
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="hidden md:block">Statistiques</span>
            </button>
            <button 
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'team' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Users className="w-5 h-5" />
              <span className="hidden md:block">Équipe</span>
            </button>
          </nav>

          {/* Filters - Desktop Only */}
          <div className="px-4 py-2 hidden md:block">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-3 text-slate-500">
                <Filter className="w-4 h-4" />
                <h3 className="text-xs font-semibold uppercase">Filtres</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Rôle</label>
                  <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full text-xs border-slate-200 rounded-md p-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Tous les rôles</option>
                    <option value="Infirmier">Infirmier</option>
                    <option value="Aide-Soignant">Aide-Soignant</option>
                    <option value="Cadre">Cadre</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Compétence</label>
                  <select 
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                    className="w-full text-xs border-slate-200 rounded-md p-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Toutes</option>
                    <option value="Senior">Senior</option>
                    <option value="Junior">Junior</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-slate-100">
             <div className="hidden md:block bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
               <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Légende Rapide</h4>
               <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-200"></span> RC (Repos Cycle)
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-300"></span> T5 (Matin Long)
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-400"></span> T6 (Journée)
                  </div>
               </div>
             </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Main Grid View */}
          {activeTab === 'planning' && (
             <div className="flex-1 p-4 flex gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col h-full min-w-0">
                  <div className="mb-2 flex justify-between items-center">
                     <h2 className="text-sm font-semibold text-slate-600">Vue d'ensemble</h2>
                     <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-slate-500">Données sauvegardées</span>
                     </div>
                  </div>
                  <ScheduleGrid 
                    employees={filteredEmployees} 
                    startDate={currentDate} 
                    days={31} 
                    onCellClick={handleCellClick}
                  />
                </div>
                
                {/* Right Panel: Constraints */}
                <div className="w-80 flex-shrink-0 hidden xl:flex flex-col h-full">
                   <ConstraintChecker employees={filteredEmployees} startDate={currentDate} days={31} />
                </div>
             </div>
          )}

          {/* Stats View */}
          {activeTab === 'stats' && (
            <div className="flex-1 overflow-hidden h-full">
              <StatsPanel employees={filteredEmployees} startDate={currentDate} days={31} />
            </div>
          )}

          {/* Team List View */}
          {activeTab === 'team' && (
            <div className="p-8 overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 text-slate-800">Gestion de l'équipe</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-4 relative group hover:border-blue-300 transition-all">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditEmployee(emp)}
                          className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg"
                        >
                            <Pencil className="w-4 h-4" />
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

                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                        <span className="font-semibold">Quotité:</span> 
                        <span>{Math.round(emp.fte * 100)}%</span>
                        <span className="text-slate-400">|</span>
                        <span className="font-semibold">Contrat:</span>
                        <span>Standard</span>
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
                  </div>
                ))}
                
                <button className="border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-[160px]">
                   <Plus className="w-8 h-8 mb-2" />
                   <span className="font-medium">Ajouter un membre</span>
                </button>
              </div>
            </div>
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
                  <p className="text-sm text-slate-500">
                    {employees.find(e => e.id === selectedCell.empId)?.name} • {new Date(selectedCell.date).toLocaleDateString('fr-FR')}
                  </p>
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
                   className={`
                     ${type.color} ${type.textColor} 
                     p-2 rounded-lg text-sm font-semibold shadow-sm border border-black/5
                     hover:brightness-95 active:scale-95 transition-all
                     flex flex-col items-center justify-center gap-1 h-16
                   `}
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
                        <h3 className="text-xl font-bold text-slate-900">Modifier l'équipier</h3>
                        <p className="text-sm text-slate-500">Mise à jour des informations contractuelles</p>
                    </div>
                    <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nom Complet</label>
                            <input 
                                type="text" 
                                value={editingEmployee.name}
                                onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Matricule</label>
                            <input 
                                type="text" 
                                value={editingEmployee.matricule}
                                onChange={(e) => setEditingEmployee({...editingEmployee, matricule: e.target.value})}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                placeholder="ex: M001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fonction / Rôle</label>
                            <select 
                                value={editingEmployee.role}
                                onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value as any})}
                                className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Infirmier">Infirmier</option>
                                <option value="Aide-Soignant">Aide-Soignant</option>
                                <option value="Cadre">Cadre</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quotité (ETP)</label>
                            <select 
                                value={editingEmployee.fte}
                                onChange={(e) => setEditingEmployee({...editingEmployee, fte: parseFloat(e.target.value)})}
                                className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value={1.0}>100%</option>
                                <option value={0.9}>90%</option>
                                <option value={0.8}>80%</option>
                                <option value={0.6}>60%</option>
                                <option value={0.5}>50%</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Compétences
                        </label>
                        
                        <div className="flex flex-wrap gap-2 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[42px]">
                            {editingEmployee.skills.length === 0 && (
                                <span className="text-sm text-slate-400 italic py-1">Aucune compétence</span>
                            )}
                            {editingEmployee.skills.map(skill => (
                                <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 animate-in fade-in zoom-in duration-150">
                                    {skill}
                                    <button 
                                        onClick={() => handleRemoveSkill(skill)}
                                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors text-blue-600"
                                        title="Supprimer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newSkillInput}
                                onChange={(e) => setNewSkillInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddSkill();
                                    }
                                }}
                                className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Ajouter une compétence..."
                            />
                            <button 
                                onClick={handleAddSkill}
                                disabled={!newSkillInput.trim()}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg border border-slate-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 ml-1">Ex: Senior, Tutorat, Dialyse, Junior</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={() => setEditingEmployee(null)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={saveEmployeeChanges}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Date Selection Modal */}
      {dateModalMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-80 max-w-[90vw] animate-in fade-in zoom-in duration-200">
              <div className="mb-4">
                 <h3 className="text-lg font-bold text-slate-900">
                    {dateModalMode === 'generate' ? 'Générer Planning' : 'Réinitialiser Planning'}
                 </h3>
                 <p className="text-sm text-slate-500">
                   {dateModalMode === 'generate' 
                      ? "Applique le cycle de travail et génère les postes pour le mois choisi." 
                      : "Attention: Cette action effacera tous les postes du mois choisi."}
                 </p>
              </div>

              <div className="space-y-3 mb-6">
                 <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Mois</label>
                    <select 
                      value={targetConfig.month} 
                      onChange={(e) => setTargetConfig(prev => ({...prev, month: parseInt(e.target.value)}))}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                       {months.map((m, idx) => (
                         <option key={idx} value={idx}>{m}</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Année</label>
                    <select 
                      value={targetConfig.year} 
                      onChange={(e) => setTargetConfig(prev => ({...prev, year: parseInt(e.target.value)}))}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                       {years.map((y) => (
                         <option key={y} value={y}>{y}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setDateModalMode('none')}
                   className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
                 >
                    Annuler
                 </button>
                 <button 
                   onClick={handleConfirmDateAction}
                   className={`flex-1 px-4 py-2 text-white rounded-lg font-medium text-sm shadow-sm ${
                     dateModalMode === 'reset' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                   }`}
                 >
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
