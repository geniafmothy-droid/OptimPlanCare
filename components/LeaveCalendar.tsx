
import React, { useMemo, useRef } from 'react';
import { Employee, LeaveRequestWorkflow, WorkPreference, ServiceConfig } from '../types';
import { SHIFT_TYPES } from '../constants';
import { getHolidayName } from '../utils/holidays';
import { Heart, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeaveCalendarProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  pendingRequests?: LeaveRequestWorkflow[]; // Optional: For Forecast View
  preferences?: WorkPreference[]; // Optional: For Global View with Desiderata
  serviceConfig?: ServiceConfig; // For calculating targets
}

export const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ employees, startDate, days, pendingRequests = [], preferences = [], serviceConfig }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Prepare dates header
  const dates = useMemo(() => {
      const arr = [];
      for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          arr.push({ 
              dateObj: d,
              dateStr, 
              dayNum: d.getDate(), 
              dayName: d.toLocaleDateString('fr-FR', {weekday: 'short'}),
              isWeekend: d.getDay() === 0 || d.getDay() === 6,
              dayOfWeek: d.getDay(), // 0=Sun, 1=Mon...
              holiday: getHolidayName(d)
          });
      }
      return arr;
  }, [startDate, days]);

  // Helper to check if a date is within a range
  const isWithin = (dateStr: string, start: string, end: string) => dateStr >= start && dateStr <= end;

  // DIALYSIS SPECIFIC FALLBACK TARGETS (If no config provided)
  const getDialysisTarget = (dayOfWeek: number) => {
      if (dayOfWeek === 0) return 0; // Sunday Closed
      // Lundi (1), Mercredi (3), Vendredi (5) => 8 (4 IT + 1 T5 + 1 T6 + 2 S)
      if ([1, 3, 5].includes(dayOfWeek)) return 8; 
      // Mardi (2), Jeudi (4), Samedi (6) => 7 (4 IT + 1 T5 + 1 T6 + 1 S)
      return 7;
  };

  const handleScroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const scrollAmount = 300;
          scrollContainerRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
          });
      }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full relative group">
        
        {/* Navigation Buttons (Visible on Hover) */}
        {days > 7 && (
            <>
                <button 
                    onClick={() => handleScroll('left')}
                    className="absolute left-[210px] top-12 z-40 p-1.5 bg-white/90 border border-slate-300 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-50 text-slate-600 hover:scale-110"
                    title="Défiler à gauche"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => handleScroll('right')}
                    className="absolute right-4 top-12 z-40 p-1.5 bg-white/90 border border-slate-300 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-50 text-slate-600 hover:scale-110"
                    title="Défiler à droite"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </>
        )}

        <div className="overflow-auto flex-1 relative scroll-smooth" ref={scrollContainerRef}>
            <table className="w-max min-w-full text-xs border-collapse">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="p-2 border-r border-b border-slate-200 bg-slate-50 min-w-[200px] text-left sticky left-0 z-30">Collaborateur</th>
                        {dates.map(d => (
                            <th 
                                key={d.dateStr} 
                                title={d.holiday || undefined}
                                className={`p-1 border-r border-b border-slate-200 text-center min-w-[34px] relative ${
                                    d.holiday ? 'bg-red-50 text-red-700 font-bold' :
                                    d.isWeekend ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-800'
                                }`}
                            >
                                <div>{d.dayNum}</div>
                                <div className="text-[9px] uppercase">{d.dayName}</div>
                                {d.holiday && (
                                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" title={d.holiday}></div>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-2 border-r border-b border-slate-200 font-medium sticky left-0 bg-white z-10 border-r-slate-300">
                                {emp.name}
                            </td>
                            {dates.map(d => {
                                const code = emp.shifts[d.dateStr];
                                const def = code ? SHIFT_TYPES[code] : null;
                                
                                // 1. Check for Pending Request (Forecast View) - Highest Priority Overlay
                                const pending = pendingRequests.find(r => r.employeeId === emp.id && isWithin(d.dateStr, r.startDate, r.endDate));
                                
                                // 2. Check for Validated Absence (Standard View)
                                // Show anything that is NOT work (except OFF) OR explicit Formation
                                const isValidatedAbsence = def && (!def.isWork || code === 'FO') && code !== 'OFF';
                                
                                // 3. Check for Desiderata (Global View) - Lowest Priority
                                const pref = preferences.find(p => p.employeeId === emp.id && isWithin(d.dateStr, p.startDate, p.endDate));
                                
                                // Determine what to render
                                let content = null;
                                let cellClass = d.holiday ? 'bg-red-50/20' : (d.isWeekend ? 'bg-slate-50/50' : '');

                                if (pending) {
                                    // PENDING REQUEST RENDERING
                                    content = (
                                        <div 
                                            className="w-full h-full min-h-[24px] flex items-center justify-center font-bold rounded-sm border border-dashed border-blue-400 bg-blue-50 text-blue-600 relative overflow-hidden"
                                            title={`En attente: ${pending.type}`}
                                        >
                                            {/* Striped background pattern effect via CSS or simple opacity */}
                                            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:10px_10px]"></div>
                                            <span className="relative z-10 text-[10px]">{pending.type}</span>
                                            <Clock className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-blue-400" />
                                        </div>
                                    );
                                } else if (isValidatedAbsence && def) {
                                    // VALIDATED ABSENCE RENDERING
                                    content = (
                                        <div 
                                            className={`w-full h-full min-h-[24px] flex items-center justify-center font-bold rounded-sm ${def.color} ${def.textColor} shadow-sm`}
                                            title={def.label}
                                        >
                                            {code}
                                        </div>
                                    );
                                } else if (pref) {
                                    // DESIDERATA RENDERING
                                    const isConflict = def && def.isWork && pref.type === 'NO_WORK';
                                    
                                    if (isConflict) {
                                         content = (
                                            <div className="w-full h-full flex items-center justify-center relative">
                                                <div className={`w-full h-full opacity-30 ${def.color} rounded-sm`}></div>
                                                <AlertCircle className="w-4 h-4 text-red-500 absolute z-10" title="Conflit : Souhait 'Non Travaillé' mais planifié" />
                                            </div>
                                         );
                                    } else {
                                        content = (
                                            <div className="w-full h-full min-h-[24px] flex items-center justify-center">
                                                <Heart className="w-3.5 h-3.5 text-purple-400 opacity-60" title={`Souhait: ${pref.type}`} />
                                            </div>
                                        );
                                    }
                                }

                                return (
                                    <td key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center p-0 ${cellClass}`}>
                                        {content}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
                {/* FOOTER DES TOTAUX ET CIBLES */}
                <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <tr className="bg-orange-50 font-bold border-t border-orange-100">
                        <td className="p-2 border-r border-orange-200 text-orange-800 text-right sticky left-0 bg-orange-50 z-30 text-[10px] uppercase">
                            Absences (Total)
                        </td>
                        {dates.map(d => {
                            const count = employees.reduce((acc, emp) => {
                                // 1. Check Pending
                                const pending = pendingRequests.some(r => r.employeeId === emp.id && isWithin(d.dateStr, r.startDate, r.endDate));
                                if (pending) return acc + 1;

                                // 2. Check Validated
                                const c = emp.shifts[d.dateStr];
                                const isAbsence = c && !SHIFT_TYPES[c]?.isWork && c !== 'OFF';
                                
                                return isAbsence ? acc + 1 : acc;
                            }, 0);
                            return (
                                <td key={`abs-${d.dateStr}`} className="p-1 border-r border-orange-200 text-center text-orange-700 bg-orange-50">
                                    {count > 0 ? count : ''}
                                </td>
                            );
                        })}
                    </tr>
                    
                    {/* LIGNE EFFECTIF THEORIQUE (CIBLE) */}
                    <tr className="bg-slate-100 font-bold border-t border-slate-200">
                        <td className="p-2 border-r border-slate-300 text-slate-800 text-right sticky left-0 bg-slate-100 z-30 text-[10px] uppercase">
                            Effectif / Cible
                        </td>
                        {dates.map(d => {
                            // 1. CALCULATE PROJECTED PRESENCE
                            let presentCount = 0;
                            employees.forEach(emp => {
                                const c = emp.shifts[d.dateStr];
                                // Is normally scheduled to work?
                                if (c && SHIFT_TYPES[c]?.isWork) {
                                    // Check if they have a pending request overlapping this day
                                    const hasPendingRequest = pendingRequests.some(r => r.employeeId === emp.id && isWithin(d.dateStr, r.startDate, r.endDate));
                                    if (!hasPendingRequest) {
                                        presentCount++;
                                    }
                                }
                            });

                            // 2. DETERMINE TARGET
                            // Use Service Config if available (generic sum of minStaff), else use Dialysis Fallback logic
                            let target = getDialysisTarget(d.dayOfWeek);
                            
                            // If user provided a custom config with shiftTargets, calculate sum
                            if (serviceConfig?.shiftTargets && serviceConfig.shiftTargets[d.dayOfWeek]) {
                                const dayTargets = serviceConfig.shiftTargets[d.dayOfWeek];
                                target = (Object.values(dayTargets) as number[]).reduce((a, b) => a + b, 0);
                            } else if (serviceConfig?.openDays && !serviceConfig.openDays.includes(d.dayOfWeek)) {
                                target = 0; // Closed based on generic openDays
                            }

                            // 3. DETERMINE STATUS
                            const isClosed = target === 0;
                            const isBelow = presentCount < target;
                            const statusClass = isClosed ? 'bg-slate-200 text-slate-400' : (isBelow ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200');

                            return (
                                <td key={`tgt-${d.dateStr}`} className={`p-1 border-r border-b border-slate-300 text-center text-[10px] ${statusClass}`}>
                                    {isClosed ? '-' : `${presentCount} / ${target}`}
                                </td>
                            );
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
  );
};
