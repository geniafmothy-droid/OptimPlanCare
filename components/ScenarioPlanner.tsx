
import React, { useState, useMemo } from 'react';
import { Employee, Service, PlanningScenario, ShiftCode } from '../types';
import { generateMonthlySchedule } from '../utils/scheduler';
import { checkConstraints } from '../utils/validation';
import { analyzePlanningWithAI, AIAnalysisResult } from '../services/ai';
import { Wand2, CheckCircle2, Plus, Sparkles, BrainCircuit, ShieldAlert, ListChecks, Info, AlertTriangle } from 'lucide-react';
import { ScheduleGrid } from './ScheduleGrid';
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
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const activeScenario = useMemo(() => scenarios.find(s => s.id === activeScenarioId) || null, [activeScenarioId, scenarios]);

    const handleCreateScenario = async () => {
        setIsOptimizing(true);
        setAiAnalysis(null);
        try {
            const newEmps = await generateMonthlySchedule(employees, currentDate.getFullYear(), currentDate.getMonth(), service?.config);
            const newScenario: PlanningScenario = {
                id: crypto.randomUUID(),
                name: `Scénario ${scenarios.length + 1}`,
                description: 'Génération automatique sous contraintes métier.',
                createdAt: new Date().toISOString(),
                employeesSnapshot: newEmps,
                score: 85
            };
            setScenarios([...scenarios, newScenario]);
            setActiveScenarioId(newScenario.id);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleAIQuery = async () => {
        if (!activeScenario) return;
        setIsAnalyzing(true);
        const violations = checkConstraints(activeScenario.employeesSnapshot, new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 31, service?.config);
        const result = await analyzePlanningWithAI(activeScenario.employeesSnapshot, violations, service?.name || "Général");
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Wand2 className="w-6 h-6 text-purple-600" /> Planification Automatique
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Gérez vos hypothèses et optimisez le planning avec l'aide de l'IA.</p>
                </div>
                <button onClick={handleCreateScenario} disabled={isOptimizing} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-purple-200 transition-all active:scale-95">
                    {isOptimizing ? <Sparkles className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5" />} Nouveau Scénario
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                {/* Sidebar Scenarios */}
                <div className="col-span-3 space-y-3 overflow-y-auto">
                    {scenarios.map(s => (
                        <div key={s.id} onClick={() => { setActiveScenarioId(s.id); setAiAnalysis(null); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${activeScenarioId === s.id ? 'bg-white dark:bg-slate-800 border-purple-500 shadow-md ring-1 ring-purple-200' : 'bg-slate-100 dark:bg-slate-800/50 border-transparent hover:bg-white'}`}>
                            <div className="font-bold dark:text-white">{s.name}</div>
                            <div className="text-xs text-slate-500 mt-1">{new Date(s.createdAt).toLocaleTimeString()}</div>
                        </div>
                    ))}
                </div>

                {/* Main View */}
                <div className="col-span-9 flex flex-col gap-4 overflow-hidden">
                    {activeScenario ? (
                        <>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[500px]">
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border-b dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest">Aperçu du Planning</span>
                                        <button onClick={handleAIQuery} disabled={isAnalyzing} className="text-xs flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-50 transition-colors">
                                            {isAnalyzing ? <BrainCircuit className="w-4 h-4 animate-pulse"/> : <BrainCircuit className="w-4 h-4" />}
                                            Audit IA Gemini
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <ScheduleGrid 
                                            employees={activeScenario.employeesSnapshot} 
                                            startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                            days={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()} 
                                            viewMode="month" 
                                            onCellClick={() => {}} 
                                        />
                                    </div>
                                </div>

                                {/* AI ANALYSIS SIDEBAR */}
                                <div className="w-80 flex flex-col gap-4">
                                    <div className={`flex-1 rounded-2xl p-5 border transition-all ${aiAnalysis ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 flex items-center justify-center'}`}>
                                        {isAnalyzing ? (
                                            <div className="text-center animate-in fade-in">
                                                <BrainCircuit className="w-12 h-12 text-indigo-500 animate-bounce mx-auto mb-3" />
                                                <p className="text-sm font-bold text-indigo-600">Gemini analyse les contraintes...</p>
                                            </div>
                                        ) : aiAnalysis ? (
                                            <div className="space-y-4 animate-in slide-in-from-right-4">
                                                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold">
                                                    <BrainCircuit className="w-5 h-5"/> Rapport d'audit IA
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`text-2xl font-black ${aiAnalysis.riskScore > 50 ? 'text-orange-500' : 'text-green-500'}`}>{100 - aiAnalysis.riskScore}%</div>
                                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Indice de Qualité</div>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic border-l-2 border-indigo-200 pl-3">"{aiAnalysis.summary}"</p>
                                                <div className="space-y-2">
                                                    <div className="text-[10px] font-black uppercase text-slate-400">Recommandations :</div>
                                                    {aiAnalysis.suggestions.map((s, i) => (
                                                        <div key={i} className="text-[11px] bg-white dark:bg-slate-800 p-2 rounded border border-indigo-100 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                                                            {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center p-4">
                                                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs text-slate-400 font-medium italic">Cliquez sur "Audit IA" pour obtenir une analyse critique de ce scénario.</p>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { alert("Scénario appliqué au planning réel."); onApplySchedule(); }} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95">
                                        <CheckCircle2 className="w-5 h-5" /> Appliquer ce Planning
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 overflow-hidden">
                                <StaffingSummary 
                                    employees={activeScenario.employeesSnapshot} 
                                    startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)} 
                                    days={31} 
                                    activeServiceId={service?.id}
                                    serviceConfig={service?.config}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border-4 border-dashed border-slate-100 dark:border-slate-700">
                            <BrainCircuit className="w-20 h-20 text-slate-200 dark:text-slate-700 mb-4" />
                            <h3 className="text-xl font-bold text-slate-400 dark:text-slate-600">Générez un scénario pour commencer l'optimisation</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
