import React, { useState, useMemo } from 'react';
import { Employee, Service, PlanningScenario, ShiftCode, ServiceConfig } from '../types';
import { generateMonthlySchedule, getHoursLast7Days, getEffectiveTargets } from '../utils/scheduler';
import { checkConstraints } from '../utils/validation';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { Wand2, Copy, Save, CheckCircle2, RotateCcw, ArrowRightLeft, Users, AlertTriangle, Play, Plus, Clock } from 'lucide-react';
import { ScheduleGrid } from './ScheduleGrid';
import { ConstraintChecker } from './ConstraintChecker';
import { StaffingSummary } from './StaffingSummary';

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
            score: Math.floor(Math.random() * (95 - 80) + 80) 
        };

        setScenarios([...scenarios, newScenario]);
        setActiveScenarioId(newScenario.id);
        setIsOptimizing(false);
    };

    /**
     * Smart Optimization (IA):
     * 1. Detect gaps in staffing based on dynamically configured targets.
     * 2. Try to fill gaps with EXISTING employees who are valid.
     * 3. Use Interim as last resort.
     */
    const handleSmartOptimize = async () => {
        if (!activeScenarioId || !draftScenario) return;
        setIsOptimizing(true);

        const emps = JSON.parse(JSON.stringify(draftScenario.employeesSnapshot)) as Employee[];
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        let filledCount = 0;
        let interimCount = 0;

        const currentServiceConfig: Partial<ServiceConfig> = service?.config || {};
        const openDays = currentServiceConfig.openDays || [1,2,3,4,5,6];

        for(let day=1; day<=daysInMonth; day++) {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dayOfWeek = d.getDay();
            
            const prevD = new Date(d); prevD.setDate(d.getDate() - 1);
            const prevDateStr = prevD.toISOString().split('T')[0];

            const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
            const nextDateStr = nextD.toISOString().split('T')[0];

            if (!openDays.includes(dayOfWeek)) continue;

            // IA LOGIC: Determine effective targets from dynamic configuration (Objectifs Journaliers Spécifiques)
            const dayTargets = getEffectiveTargets(dayOfWeek, service?.config);

            // Fill gaps based on targets
            for (const [code, target] of Object.entries(dayTargets)) {
                const currentCount = emps.filter(e => e.shifts[dateStr] === code).length;
                const needed = target - currentCount;
                
                if (needed > 0) {
                    for(let i=0; i<needed; i++) {
                        
                        // STRATEGY 1: FIND EXISTING CANDIDATE
                        const candidates = emps.filter(e => {
                            if (e.role !== 'Infirmier' && e.role !== 'Intérimaire') return false;
                            
                            const currentShift = e.shifts[dateStr];
                            if (currentShift && SHIFT_TYPES[currentShift]?.isWork) return false; 
                            if (['CA', 'MAL', 'AT', 'ABS'].includes(currentShift)) return false; 

                            if (e.shifts[prevDateStr] === 'S') return false;
                            if (code === 'S' && e.shifts[nextDateStr] && SHIFT_TYPES[e.shifts[nextDateStr]]?.isWork) return false;

                            const hoursToAdd = SHIFT_HOURS[code] || 0;
                            const hoursLast7 = getHoursLast7Days(e, d, e.shifts);
                            if ((hoursLast7 + hoursToAdd) > 48) return false;

                            return true;
                        });

                        candidates.sort((a,b) => {
                            const hoursA = getHoursLast7Days(a, d, a.shifts);
                            const hoursB = getHoursLast7Days(b, d, b.shifts);
                            return hoursA - hoursB;
                        });

                        if (candidates.length > 0) {
                            const winner = candidates[0];
                            winner.shifts[dateStr] = code as ShiftCode;
                            filledCount++;
                        } else {
                            // STRATEGY 2: CREATE INTERIM
                            interimCount++;
                            const interimId = `INT-${Date.now()}-${interimCount}`;
                            const interim: Employee = {
                                id: interimId,
                                matricule: `INT${String(interimCount).padStart(3,'0')}`,
                                name: `Intérimaire ${code} #${interimCount}`,
                                role: 'Intérimaire',
                                fte: 1,
                                leaveBalance: 0,
                                leaveCounters: { CA:0, RTT:0, HS:0, RC:0 },
                                skills: [code],
                                shifts: {} 
                            };
                            interim.shifts[dateStr] = code as any; 
                            emps.push(interim);
                        }
                    }
                }
            }
        }

        const updatedScenario = {
            ...draftScenario,
            employeesSnapshot: emps,
            description: draftScenario.description + ` (IA Optimisé: +${filledCount} titulaires, +${interimCount} intérim)`,
            name: draftScenario.name + ' (Optimisé)'
        };

        setScenarios(scenarios.map(s => s.id === activeScenarioId ? updatedScenario : s));
        setIsOptimizing(false);
    };

    const handleApply = () => {
        if (!draftScenario) return;
        if (confirm("Appliquer ce scénario au planning RÉEL ? Cette action est irréversible.")) {
            alert("Scénario appliqué avec succès (Simulation). Le planning réel n'est pas modifié dans cette démo sans backend complet.");
            onApplySchedule();
        }
    };

    const handleRangeSelect = (empId: string, start: string, end: string, forcedCode?: ShiftCode) => {
        if (!activeScenarioId || !forcedCode) return;
        
        setScenarios(prev => prev.map(s => {
            if (s.id !== activeScenarioId) return s;
            
            const updatedEmps = s.employeesSnapshot.map(e => {
                if (e.id !== empId) return e;
                const newShifts = { ...e.shifts };
                
                const dStart = new Date(start);
                const dEnd = new Date(end);
                
                for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
                     const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                     newShifts[dateStr] = forcedCode;
                }
                return { ...e, shifts: newShifts };
            });
            return { ...s, employeesSnapshot: updatedEmps };
        }));
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

                <div className="col-span-9 flex flex-col gap-4 overflow-hidden">
                    {draftScenario ? (
                        <>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{draftScenario.name}</span>
                                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                                    <button onClick={handleSmartOptimize} className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors">
                                        <Users className="w-3 h-3" /> Combler (IA + Intérim)
                                    </button>
                                </div>
                                <button onClick={handleApply} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> Appliquer au Réel
                                </button>
                            </div>

                            <div className="flex-1 flex gap-4 overflow-hidden">
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
                                        onRangeSelect={handleRangeSelect}
                                    />
                                    <div className="mt-auto border-t border-slate-200 dark:border-slate-700">
                                        <StaffingSummary 
                                            employees={draftScenario.employeesSnapshot} 
                                            startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                            days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}
                                            activeServiceId={service?.id}
                                            serviceConfig={service?.config}
                                        />
                                    </div>
                                </div>

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
                                        <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-slate-300 dark:border-slate-600 opacity-20"></div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="h-32 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
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
