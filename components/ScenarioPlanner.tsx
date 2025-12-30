import React, { useState } from 'react';
import { Employee, Service, PlanningScenario, ShiftCode } from '../types';
// Added missing imports for ScheduleGrid and StaffingSummary
import { ScheduleGrid } from './ScheduleGrid';
import { StaffingSummary } from './StaffingSummary';
import { Wand2, Save, Trash2, CheckCircle2, AlertTriangle, Play, X, Plus, Sparkles } from 'lucide-react';

// Added ScenarioPlanner component and its props definition to fix the missing exported member error in App.tsx
interface ScenarioPlannerProps {
    employees: Employee[];
    currentDate: Date;
    service: Service | null;
    onApply: (employees: Employee[]) => void;
}

export const ScenarioPlanner: React.FC<ScenarioPlannerProps> = ({ employees, currentDate, service, onApply }) => {
    // Added draftScenario state to manage the simulation environment
    const [draftScenario, setDraftScenario] = useState<PlanningScenario | null>(null);

    const handleCreateDraft = () => {
        const snapshot = JSON.parse(JSON.stringify(employees));
        setDraftScenario({
            id: `draft-${Date.now()}`,
            name: 'Simulation temporaire',
            description: 'Brouillon de test',
            createdAt: new Date().toISOString(),
            employeesSnapshot: snapshot
        });
    };

    // Added handleRangeSelect to support bulk editing within the scenario view
    const handleRangeSelect = (empId: string, startDate: string, endDate: string, forcedCode?: ShiftCode) => {
        if (!draftScenario || !forcedCode) return;
        
        const newSnapshot = [...draftScenario.employeesSnapshot];
        const empIndex = newSnapshot.findIndex(e => e.id === empId);
        if (empIndex === -1) return;

        const start = new Date(startDate);
        const end = new Date(endDate);
        const updatedShifts = { ...newSnapshot[empIndex].shifts };

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            updatedShifts[dateStr] = forcedCode;
        }

        newSnapshot[empIndex] = { ...newSnapshot[empIndex], shifts: updatedShifts };
        setDraftScenario({ ...draftScenario, employeesSnapshot: newSnapshot });
    };

    const handleApply = () => {
        if (draftScenario && confirm("Appliquer ces modifications au planning réel ?")) {
            onApply(draftScenario.employeesSnapshot);
            setDraftScenario(null);
        }
    };

    if (!draftScenario) {
        return (
            <div className="p-8 h-full flex flex-col items-center justify-center space-y-6 bg-slate-50 dark:bg-slate-900/50">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-6 rounded-full text-purple-600 dark:text-purple-400 shadow-inner">
                    <Wand2 className="w-16 h-16" />
                </div>
                <div className="text-center max-w-md">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Simulateur de Scénarios</h3>
                    <p className="text-slate-500 dark:text-slate-400">Préparez et testez vos modifications sans impacter le planning de référence avant validation.</p>
                </div>
                <button 
                    onClick={handleCreateDraft}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 dark:shadow-none transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Démarrer un scénario
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col space-y-4 overflow-hidden bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-600 p-2 rounded-lg text-white shadow-lg"><Sparkles className="w-5 h-5" /></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Environnement de Simulation</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Modifications isolées du planning réel.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setDraftScenario(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium text-sm transition-colors">Fermer</button>
                    <button onClick={handleApply} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md text-sm flex items-center gap-2 transition-all"><CheckCircle2 className="w-4 h-4"/> Valider & Enregistrer</button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-[10px] font-bold text-center border-b border-purple-100 dark:border-purple-800 uppercase tracking-widest">
                        Visualisation Interactive du Scénario
                    </div>
                    {/* Fixed: Integrated ScheduleGrid with the draft scenario's snapshot and the current date */}
                    <ScheduleGrid 
                        employees={draftScenario.employeesSnapshot} 
                        startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                        days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()} 
                        viewMode="month" 
                        onCellClick={() => {}} 
                        onRangeSelect={handleRangeSelect}
                    />
                    {/* STAFFING SUMMARY EMBEDDED IN SCENARIO */}
                    <div className="mt-auto border-t border-slate-200 dark:border-slate-700">
                        {/* Fixed: Integrated StaffingSummary to show impact on coverage within the scenario */}
                        <StaffingSummary 
                            employees={draftScenario.employeesSnapshot} 
                            startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                            days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}
                            serviceConfig={service?.config}
                        />
                    </div>
                </div>

                <div className="w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 overflow-y-auto shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" /> 
                        Aide à la Décision
                    </h4>
                    <div className="space-y-3">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-xs text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-100 dark:border-slate-800">
                            Utilisez le glisser-déposer sur la grille pour modifier des séries de postes.
                        </div>
                        <div className="p-3 border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                Les indicateurs de couverture en bas de page se mettent à jour en temps réel selon vos ajustements.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
