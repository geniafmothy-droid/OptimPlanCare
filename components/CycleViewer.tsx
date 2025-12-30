import React, { useState, useMemo, useEffect } from 'react';
import { Employee, ShiftCode, UserRole, ShiftDefinition } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Calendar, Clock, User, ArrowRight, Calculator, CalendarClock, ChevronLeft, ChevronRight, Briefcase, Tag, Percent } from 'lucide-react';

interface CycleViewerProps {
    employees: Employee[];
    currentUser?: { role: UserRole, employeeId?: string };
    shiftDefinitions?: Record<string, ShiftDefinition>;
}

export const CycleViewer: React.FC<CycleViewerProps> = ({ employees, currentUser, shiftDefinitions }) => {
    // Determine access level
    const isManager = ['ADMIN', 'DIRECTOR', 'CADRE', 'CADRE_SUP', 'MANAGER'].includes(currentUser?.role || '');
    
    // Initial selection logic
    const initialId = (!isManager && currentUser?.employeeId) 
        ? currentUser.employeeId 
        : (employees.length > 0 ? employees[0].id : '');

    const [selectedEmpId, setSelectedEmpId] = useState<string>(initialId);
    const [cycleStartDate, setCycleStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [cycleWeeks, setCycleWeeks] = useState<number>(4); // Default 4 weeks cycle

    const defs = useMemo(() => shiftDefinitions || SHIFT_TYPES, [shiftDefinitions]);

    // Enforce self-view for non-managers if employees list updates
    useEffect(() => {
        if (!isManager && currentUser?.employeeId) {
            setSelectedEmpId(currentUser.employeeId);
        }
    }, [currentUser, isManager, employees]);

    const selectedEmp = employees.find(e => e.id === selectedEmpId);

    // Helper to calculate effective work hours for a shift code
    const getEffectiveHours = (code: string) => {
        const def = defs[code];
        if (!def || !def.isWork) return 0;
        const duration = def.duration || 0;
        const breakTime = def.breakDuration || 0;
        return Math.max(0, duration - breakTime);
    };

    // Calculate Cycle Data
    const cycleData = useMemo(() => {
        if (!selectedEmp || !cycleStartDate) return null;

        const weeks = [];
        let grandTotalHours = 0;
        let totalDaysWorked = 0;
        let weekendCount = 0;
        
        const startDateObj = new Date(cycleStartDate);
        // Adjust to Monday if needed
        const dayOfWeek = startDateObj.getDay();
        const diff = startDateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const adjustedStart = new Date(startDateObj);
        adjustedStart.setDate(diff);

        for (let w = 0; w < cycleWeeks; w++) {
            const weekDays = [];
            let weekHours = 0;

            for (let d = 0; d < 7; d++) {
                const current = new Date(adjustedStart);
                current.setDate(adjustedStart.getDate() + (w * 7) + d);
                
                const dateStr = current.toISOString().split('T')[0];
                const shiftCode = selectedEmp.shifts[dateStr] || 'OFF';
                const shiftDef = defs[shiftCode];
                
                const hours = getEffectiveHours(shiftCode);
                
                weekDays.push({
                    date: current,
                    dateStr,
                    shiftCode,
                    shiftDef,
                    hours,
                });

                weekHours += hours;
                if (shiftDef?.isWork) {
                    totalDaysWorked++;
                    if (current.getDay() === 0 || current.getDay() === 6) weekendCount++;
                }
            }
            
            grandTotalHours += weekHours;
            weeks.push({ 
                weekNum: w + 1, 
                days: weekDays, 
                totalHours: Math.round(weekHours * 100) / 100 
            });
        }

        const displayEnd = new Date(adjustedStart);
        displayEnd.setDate(displayEnd.getDate() + (cycleWeeks * 7) - 1);

        return {
            weeks,
            grandTotalHours: Math.round(grandTotalHours * 100) / 100,
            averageHours: Math.round((grandTotalHours / cycleWeeks) * 100) / 100,
            totalDaysWorked,
            weekendCount,
            startDateLabel: adjustedStart.toLocaleDateString('fr-FR'),
            endDateLabel: displayEnd.toLocaleDateString('fr-FR')
        };
    }, [selectedEmp, cycleStartDate, cycleWeeks, defs]);

    const handlePrevCycle = () => {
        const d = new Date(cycleStartDate);
        d.setDate(d.getDate() - (cycleWeeks * 7));
        setCycleStartDate(d.toISOString().split('T')[0]);
    };

    const handleNextCycle = () => {
        const d = new Date(cycleStartDate);
        d.setDate(d.getDate() + (cycleWeeks * 7));
        setCycleStartDate(d.toISOString().split('T')[0]);
    };

    if (!selectedEmp) return <div className="p-8 text-center text-slate-500">Profil employé introuvable.</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarClock className="w-6 h-6 text-indigo-600" /> 
                    {isManager ? 'Analyse de Cycle' : 'Mon Cycle de Travail'}
                </h2>
            </div>

            {/* CONTROLS */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4 mb-6">
                {isManager ? (
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employé</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select 
                                value={selectedEmpId} 
                                onChange={(e) => setSelectedEmpId(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            >
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.role}</option>)}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-w-[200px] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {selectedEmp.name.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">{selectedEmp.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{selectedEmp.role}</div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Début du Cycle (Lundi)</label>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevCycle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                        <input 
                            type="date" 
                            value={cycleStartDate} 
                            onChange={(e) => setCycleStartDate(e.target.value)}
                            className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button onClick={handleNextCycle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée</label>
                    <select 
                        value={cycleWeeks} 
                        onChange={(e) => setCycleWeeks(parseInt(e.target.value))}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
                    >
                        <option value={4}>4 Semaines</option>
                        <option value={6}>6 Semaines</option>
                        <option value={8}>8 Semaines</option>
                        <option value={10}>10 Semaines</option>
                        <option value={12}>12 Semaines</option>
                    </select>
                </div>
            </div>

            {/* STATS SUMMARY */}
            {cycleData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-600 dark:text-slate-400"><Percent className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Quotité (FTE)</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-indigo-200">{Math.round(selectedEmp.fte * 100)}%</div>
                            <div className="text-[10px] text-slate-400">{selectedEmp.role}</div>
                        </div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-indigo-600 dark:text-indigo-400"><Clock className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase">Total Heures Cycle</div>
                            <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-200">{cycleData.grandTotalHours}h</div>
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-blue-600 dark:text-blue-400"><Calculator className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Moyenne Hebdo</div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{cycleData.averageHours}h</div>
                            <div className="text-[10px] text-blue-400">Cible (Théorie): {selectedEmp.fte * 35}h</div>
                        </div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-emerald-600 dark:text-emerald-400"><Calendar className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase">Jours Travaillés</div>
                            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">{cycleData.totalDaysWorked}</div>
                        </div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900 p-4 rounded-xl flex items-center gap-4 col-span-2 md:col-span-1">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-orange-600 dark:text-orange-400"><CalendarClock className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase">Week-ends Actifs</div>
                            <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">{cycleData.weekendCount}</div>
                            <div className="text-[10px] text-orange-400">Jours (Samedi/Dimanche)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* CYCLE GRID */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Détail des Semaines</h3>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Période : <span className="text-slate-800 dark:text-slate-200 font-bold">{cycleData?.startDateLabel}</span> au <span className="text-slate-800 dark:text-slate-200 font-bold">{cycleData?.endDateLabel}</span>
                    </div>
                </div>
                
                <div className="overflow-auto flex-1 p-6">
                    <div className="space-y-2 min-w-[700px]">
                        {/* Header Row */}
                        <div className="grid grid-cols-9 gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                            <div className="col-span-1 text-left pl-2">Semaine</div>
                            <div>Lun</div>
                            <div>Mar</div>
                            <div>Mer</div>
                            <div>Jeu</div>
                            <div>Ven</div>
                            <div className="text-indigo-600">Sam</div>
                            <div className="text-indigo-600">Dim</div>
                            <div className="col-span-1 text-right pr-2">Total Hebdo</div>
                        </div>

                        {cycleData?.weeks.map((week) => (
                            <div key={week.weekNum} className="grid grid-cols-9 gap-2 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 p-2 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                {/* Week Number */}
                                <div className="col-span-1 font-bold text-slate-500 dark:text-slate-400 text-sm pl-2">
                                    Semaine {week.weekNum}
                                </div>

                                {/* Days */}
                                {week.days.map((d, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div 
                                            className={`
                                                w-full h-10 rounded flex items-center justify-center font-bold text-xs shadow-sm
                                                ${d.shiftDef ? `${d.shiftDef.color} ${d.shiftDef.textColor}` : 'bg-slate-100 dark:bg-slate-900 text-slate-300 dark:text-slate-700 border border-slate-200 dark:border-slate-700'}
                                            `}
                                            title={`${d.date.toLocaleDateString()} - ${d.shiftDef?.label || 'Repos / Non défini'}`}
                                        >
                                            {d.shiftCode !== 'OFF' ? d.shiftCode : ''}
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">{d.date.getDate()}</span>
                                    </div>
                                ))}

                                {/* Week Total */}
                                <div className="col-span-1 text-right pr-2">
                                    <div className={`font-bold text-sm ${week.totalHours > 48 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {week.totalHours}h
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tighter">Réalisé</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 italic">
                    Note : Les totaux d'heures sont calculés en soustrayant le temps de pause défini pour chaque compétence.
                </div>
            </div>
        </div>
    );
};