
import React, { useMemo } from 'react';
import { Employee, LeaveRequestWorkflow, WorkPreference } from '../types';
import { SHIFT_TYPES } from '../constants';
import { getHolidayName } from '../utils/holidays';
import { Heart, Clock, AlertCircle } from 'lucide-react';

interface LeaveCalendarProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  pendingRequests?: LeaveRequestWorkflow[]; // Optional: For Forecast View
  preferences?: WorkPreference[]; // Optional: For Global View with Desiderata
}

export const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ employees, startDate, days, pendingRequests = [], preferences = [] }) => {
  
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
              dateStr, 
              dayNum: d.getDate(), 
              dayName: d.toLocaleDateString('fr-FR', {weekday: 'short'}),
              isWeekend: d.getDay() === 0 || d.getDay() === 6,
              holiday: getHolidayName(d)
          });
      }
      return arr;
  }, [startDate, days]);

  // Helper to check if a date is within a range
  const isWithin = (dateStr: string, start: string, end: string) => dateStr >= start && dateStr <= end;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
        <div className="overflow-auto flex-1 relative">
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
                                    // Only show if no work is scheduled (or override depending on rule, but usually desire appears on empty slots)
                                    // If employee is working on a day they asked not to, maybe highlight conflict? 
                                    // For now, simple rendering.
                                    
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
                {/* FOOTER DES TOTAUX */}
                <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <tr className="bg-orange-50 font-bold border-t border-orange-100">
                        <td className="p-2 border-r border-orange-200 text-orange-800 text-right sticky left-0 bg-orange-50 z-30 text-[10px] uppercase">
                            Absences (Validées + Prév.)
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
                </tfoot>
            </table>
        </div>
    </div>
  );
};
