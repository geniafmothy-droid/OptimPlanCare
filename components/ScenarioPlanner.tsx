

import React, { useState, useMemo } from 'react';
import { Employee, Service, PlanningScenario } from '../types';
import { generateMonthlySchedule } from '../utils/scheduler';
import { checkConstraints } from '../utils/validation';
import { Wand2, Copy, Save, CheckCircle2, RotateCcw, ArrowRightLeft, Users, AlertTriangle, Play, Plus, Clock } from 'lucide-react';
import { ScheduleGrid } from './ScheduleGrid';
import { ConstraintChecker } from './ConstraintChecker';

interface ScenarioPlannerProps {
    employees: Employee[];
    currentDate: Date;
    service: Service | null;
    onApplySchedule: () => void;
}

export const ScenarioPlanner: React.FC<ScenarioPlannerProps> = ({ employees, currentDate, service, onApplySchedule }) => {
    const [scenarios, setScenarios] = useState<PlanningScenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [comparisonMode, setComparisonMode] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Initial load: create a "Draft" based on current reality
    const draftScenario = useMemo(() => {
        if (activeScenarioId) {
            return scenarios.find(s => s.id === activeScenarioId) || null;
        }
        return null;
    }, [activeScenarioId, scenarios]);

    const handleCreateScenario = async () => {
        setIsOptimizing(true);
        // Simulate generation
        const newEmps = await generateMonthlySchedule(
            employees, 
            currentDate.getFullYear(), 
            currentDate.getMonth(), 
            service?.config
        );
        
        const newScenario: PlanningScenario = {
            id: crypto.randomUUID(),
            name: `Scénario ${scenarios.length + 1}`,
            description: 'Génération automatique basée sur les contraintes.',
            createdAt: new Date().toISOString(),
            employeesSnapshot: newEmps,
            score: 85 // Mock score
        };

        setScenarios([...scenarios, newScenario]);
        setActiveScenarioId(newScenario.id);
        setIsOptimizing(false);
    };

    const handleOptimizeInterim = async () => {
        if (!activeScenarioId || !draftScenario) return;
        setIsOptimizing(true);

        // 1. Clone current scenario employees
        const emps = JSON.parse(JSON.stringify(draftScenario.employeesSnapshot)) as Employee[];
        
        // 2. Identify Gaps (using validation logic)
        // This is a simplified "gap filling" logic. 
        // In a real app, this would use the `violations` output to target specific days/slots.
        
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        let interimCount = 0;

        for(let day=1; day<=daysInMonth; day++) {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            
            // Check staffing (Example: need 4 IT)
            const countIT = emps.filter(e => e.shifts[dateStr] === 'IT').length;
            if (countIT < 4) {
                // Add Interim
                const interim: Employee = {
                    id: `INT-${Date.now()}-${interimCount}`,
                    matricule: `INT${interimCount}`,
                    name: `Intérimaire #${interimCount+1}`,
                    role: 'Intérimaire',
                    fte: 1,
                    leaveBalance: 0,
                    leaveCounters: { CA:0, RTT:0, HS:0, RC:0 },
                    skills: ['IT'],
                    shifts: { [dateStr]: 'IT' }
                };
                emps.push(interim);
                interimCount++;
            }
        }

        // Update Scenario
        const updatedScenario = {
            ...draftScenario,
            employeesSnapshot: emps,
            description: draftScenario.description + ' (Optimisé Intérim)',
            name: draftScenario.name + ' + Intérim'
        };

        setScenarios(scenarios.map(s => s.id === activeScenarioId ? updatedScenario : s));
        setIsOptimizing(false);
    };

    const handleApply = () => {
        if (!draftScenario) return;
        if (confirm("Appliquer ce scénario au planning RÉEL ? Cette action est irréversible.")) {
            // In a real app, this would call bulkSaveSchedule with draftScenario.employeesSnapshot
            alert("Scénario appliqué avec succès (Simulation).");
            onApplySchedule();
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Wand2 className="w-6 h-6 text-purple-600" />
                        Planification & Scénarios
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Générez des hypothèses, optimisez le recours à l'intérim et comparez avant de valider.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setComparisonMode(!comparisonMode)}
                        className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium ${comparisonMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200'}`}
                    >
                        <ArrowRightLeft className="w-4 h-4" /> Comparer
                    </button>
                    <button 
                        onClick={handleCreateScenario} 
                        disabled={isOptimizing}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm"
                    >
                        {isOptimizing ? <RotateCcw className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4" />} 
                        Nouveau Scénario
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                {/* Sidebar: Scenario List */}
                <div className="col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col overflow-y-auto">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 uppercase text-xs tracking-wider">Scénarios disponibles</h3>
                    <div className="space-y-3">
                        {scenarios.map(s => (
                            <div 
                                key={s.id} 
                                onClick={() => setActiveScenarioId(s.id)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                    activeScenarioId === s.id 
                                    ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-200 dark:bg-purple-900/30 dark:border-purple-700' 
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-800 dark:text-white">{s.name}</span>
                                    {s.score && <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">{s.score}%</span>}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{s.description}</p>
                                <div className="mt-3 flex items-center text-xs text-slate-400 gap-2">
                                    <Clock className="w-3 h-3" /> {new Date(s.createdAt).toLocaleTimeString()}
                                    <span className="ml-auto flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {s.employeesSnapshot.length}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {scenarios.length === 0 && (
                            <div className="text-center py-10 text-slate-400 italic">
                                Aucun scénario généré.
                            </div>
                        )}
                    </div>
                </div>

                {/* Main View */}
                <div className={`flex flex-col gap-4 overflow-hidden ${comparisonMode ? 'col-span-9' : 'col-span-9'}`}>
                    
                    {draftScenario ? (
                        <>
                            {/* Toolbar */}
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{draftScenario.name}</span>
                                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                                    <button onClick={handleOptimizeInterim} className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors">
                                        <Users className="w-3 h-3" /> Combler avec Intérim
                                    </button>
                                </div>
                                <button onClick={handleApply} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> Appliquer au Réel
                                </button>
                            </div>

                            <div className="flex-1 flex gap-4 overflow-hidden">
                                {/* Left: Scenario View */}
                                <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-bold text-center border-b border-purple-100 dark:border-purple-800">
                                        VISUALISATION SCÉNARIO
                                    </div>
                                    <ScheduleGrid 
                                        employees={draftScenario.employeesSnapshot} 
                                        startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                        days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()} 
                                        viewMode="month" 
                                        onCellClick={() => {}} 
                                    />
                                </div>

                                {/* Right: Comparison (if enabled) */}
                                {comparisonMode && (
                                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold text-center border-b border-slate-200 dark:border-slate-600">
                                            PLANNING ACTUEL (RÉEL)
                                        </div>
                                        <ScheduleGrid 
                                            employees={employees} 
                                            startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                            days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()} 
                                            viewMode="month" 
                                            onCellClick={() => {}} 
                                        />
                                        
                                        {/* Diff Overlay Hint */}
                                        <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-slate-300 dark:border-slate-600 opacity-20"></div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Validation / Alerts for Scenario */}
                            <div className="h-40 border-t border-slate-200 dark:border-slate-700">
                                <ConstraintChecker 
                                    employees={draftScenario.employeesSnapshot} 
                                    startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                    days={30}
                                    serviceConfig={service?.config}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <Wand2 className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Sélectionnez ou créez un scénario pour commencer la simulation.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};