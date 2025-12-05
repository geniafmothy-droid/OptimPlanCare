
import React, { useState, useMemo } from 'react';
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { Calendar, Clock, User, ArrowRight, Calculator, CalendarClock, ChevronLeft, ChevronRight, Briefcase, Tag } from 'lucide-react';

interface CycleViewerProps {
    employees: Employee[];
}

export const CycleViewer: React.FC<CycleViewerProps> = ({ employees }) => {
    const [selectedEmpId, setSelectedEmpId] = useState<string>(employees.length > 0 ? employees[0].id : '');
    const [cycleStartDate, setCycleStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [cycleWeeks, setCycleWeeks] = useState<number>(4); // Default 4 weeks cycle

    const selectedEmp = employees.find(e => e.id === selectedEmpId);

    // Calculate Cycle Data
    const cycleData = useMemo(() => {
        if (!selectedEmp || !cycleStartDate) return null;

        const weeks = [];
        let grandTotalHours = 0;
        let totalDaysWorked = 0;
        let weekendCount = 0;
        
        const startDateObj = new Date(cycleStartDate);
        // Adjust to Monday if needed (optional, but standard for cycles)
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
                const shiftDef = SHIFT_TYPES[shiftCode];
                
                const hours = SHIFT_HOURS[shiftCode] || 0;
                
                weekDays.push({
                    date: current,
                    dateStr,
                    shiftCode,
                    shiftDef,
                    hours,
                    isWeekend: d === 5 || d === 6 // Sat or Sun (0-based from Monday loop?) No, loop starts Monday.
                });

                weekHours += hours;
                if (shiftDef?.isWork) {
                    totalDaysWorked++;
                    // Check strict Saturday/Sunday based on Date object
                    if (current.getDay() === 0 || current.getDay() === 6) weekendCount++;
                }
            }
            
            grandTotalHours += weekHours;
            weeks.push({ weekNum: w + 1, days: weekDays, totalHours: weekHours });
        }

        return {
            weeks,
            grandTotalHours,
            averageHours: grandTotalHours / cycleWeeks,
            totalDaysWorked,
            weekendCount,
            startDateLabel: adjustedStart.toLocaleDateString('fr-FR'),
            endDateLabel: new Date(adjustedStart.setDate(adjustedStart.getDate() + (cycleWeeks * 7) - 1)).toLocaleDateString('fr-FR')
        };
    }, [selectedEmp, cycleStartDate, cycleWeeks]);

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

    if (!selectedEmp) return <div className="p-8 text-center text-slate-500">Aucun employé sélectionné.</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CalendarClock className="w-6 h-6 text-indigo-600" /> Analyse de Cycle
                </h2>
            </div>

            {/* CONTROLS */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-end gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employé</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            value={selectedEmpId} 
                            onChange={(e) => setSelectedEmpId(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.role}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Début du Cycle (Lundi)</label>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevCycle} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200"><ChevronLeft className="w-4 h-4 text-slate-600"/></button>
                        <input 
                            type="date" 
                            value={cycleStartDate} 
                            onChange={(e) => setCycleStartDate(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button onClick={handleNextCycle} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200"><ChevronRight className="w-4 h-4 text-slate-600"/></button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée</label>
                    <select 
                        value={cycleWeeks} 
                        onChange={(e) => setCycleWeeks(parseInt(e.target.value))}
                        className="p-2 border border-slate-300 rounded-lg bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
                    >
                        <option value={4}>4 Semaines</option>
                        <option value={6}>6 Semaines</option>
                        <option value={8}>8 Semaines</option>
                        <option value={10}>10 Semaines</option>
                        <option value={12}>12 Semaines (Trimestre)</option>
                    </select>
                </div>
            </div>

            {/* EMPLOYEE INFO */}
            {selectedEmp && (
                <div className="flex flex-wrap items-center gap-4 mb-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quotité</div>
                            <div className="text-sm font-bold text-slate-800">{Math.round(selectedEmp.fte * 100)}%</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Tag className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Compétences</div>
                            <div className="flex flex-wrap gap-1">
                                {selectedEmp.skills.length > 0 ? selectedEmp.skills.map(s => (
                                    <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded border border-slate-200">
                                        {s}
                                    </span>
                                )) : <span className="text-xs text-slate-400 italic">Aucune</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STATS SUMMARY */}
            {cycleData && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600"><Clock className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-indigo-600 font-bold uppercase">Total Heures</div>
                            <div className="text-2xl font-bold text-indigo-900">{cycleData.grandTotalHours}h</div>
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-blue-600"><Calculator className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-blue-600 font-bold uppercase">Moyenne Hebdo</div>
                            <div className="text-2xl font-bold text-blue-900">{cycleData.averageHours.toFixed(1)}h</div>
                            <div className="text-xs text-blue-400">Cible: {selectedEmp.fte * 35}h</div>
                        </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-emerald-600"><Calendar className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-emerald-600 font-bold uppercase">Jours Travaillés</div>
                            <div className="text-2xl font-bold text-emerald-900">{cycleData.totalDaysWorked}</div>
                        </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-orange-600"><CalendarClock className="w-6 h-6" /></div>
                        <div>
                            <div className="text-xs text-orange-600 font-bold uppercase">Week-ends / Fériés</div>
                            <div className="text-2xl font-bold text-orange-900">{cycleData.weekendCount}</div>
                            <div className="text-xs text-orange-400">Jours (Sam/Dim)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* CYCLE GRID */}
            <div className="flex-1 bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between">
                    <h3 className="font-bold text-slate-700">Détail du Cycle</h3>
                    <div className="text-sm text-slate-500 font-medium">
                        Du <span className="text-slate-800">{cycleData?.startDateLabel}</span> au <span className="text-slate-800">{cycleData?.endDateLabel}</span>
                    </div>
                </div>
                
                <div className="overflow-auto flex-1 p-6">
                    <div className="space-y-2">
                        {/* Header Row */}
                        <div className="grid grid-cols-9 gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                            <div className="col-span-1 text-left pl-2">Semaine</div>
                            <div>Lun</div>
                            <div>Mar</div>
                            <div>Mer</div>
                            <div>Jeu</div>
                            <div>Ven</div>
                            <div>Sam</div>
                            <div>Dim</div>
                            <div className="col-span-1 text-right pr-2">Total</div>
                        </div>

                        {cycleData?.weeks.map((week) => (
                            <div key={week.weekNum} className="grid grid-cols-9 gap-2 items-center hover:bg-slate-50 p-2 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                {/* Week Number */}
                                <div className="col-span-1 font-bold text-slate-500 text-sm pl-2">
                                    S{week.weekNum}
                                </div>

                                {/* Days */}
                                {week.days.map((d, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div 
                                            className={`
                                                w-full h-10 rounded flex items-center justify-center font-bold text-xs shadow-sm
                                                ${d.shiftDef ? `${d.shiftDef.color} ${d.shiftDef.textColor}` : 'bg-slate-100 text-slate-300 border border-slate-200'}
                                            `}
                                            title={`${d.date.toLocaleDateString()} - ${d.shiftDef?.label || 'Repos'}`}
                                        >
                                            {d.shiftCode !== 'OFF' ? d.shiftCode : ''}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1">{d.date.getDate()}</span>
                                    </div>
                                ))}

                                {/* Week Total */}
                                <div className="col-span-1 text-right pr-2">
                                    <div className={`font-bold text-sm ${week.totalHours > 48 ? 'text-red-600' : 'text-slate-700'}`}>
                                        {week.totalHours}h
                                    </div>
                                    <div className="text-[10px] text-slate-400">Hebdo</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
