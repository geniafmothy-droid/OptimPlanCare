
import React, { useMemo } from 'react';
import { Employee } from '../types';
import { SHIFT_TYPES } from '../constants';
import { getHolidayName } from '../utils/holidays';

interface LeaveCalendarProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

export const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ employees, startDate, days }) => {
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
                                className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] relative ${
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
                                const isAbsence = ['CA', 'RH', 'NT', 'FO', 'RC', 'HS', 'RTT'].includes(code);
                                const def = SHIFT_TYPES[code];
                                
                                return (
                                    <td key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center p-0 ${d.holiday ? 'bg-red-50/20' : (d.isWeekend ? 'bg-slate-50/50' : '')}`}>
                                        {isAbsence && def && (
                                            <div 
                                                className={`w-full h-full min-h-[24px] flex items-center justify-center font-bold rounded-sm ${def.color} ${def.textColor}`}
                                                title={def.label}
                                            >
                                                {code}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
                {/* FOOTER DES TOTAUX */}
                <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    {/* Ligne Présents */}
                    <tr className="bg-blue-50 font-bold border-t-2 border-blue-100">
                        <td className="p-2 border-r border-blue-200 text-blue-800 text-right sticky left-0 bg-blue-50 z-30">
                            Total Présents
                        </td>
                        {dates.map(d => {
                            const count = employees.reduce((acc, emp) => {
                                const c = emp.shifts[d.dateStr];
                                return c && SHIFT_TYPES[c]?.isWork ? acc + 1 : acc;
                            }, 0);
                            return (
                                <td key={`pres-${d.dateStr}`} className="p-1 border-r border-blue-200 text-center text-blue-700 bg-blue-50">
                                    {count}
                                </td>
                            );
                        })}
                    </tr>
                    {/* Ligne Absents */}
                    <tr className="bg-orange-50 font-bold border-t border-orange-100">
                        <td className="p-2 border-r border-orange-200 text-orange-800 text-right sticky left-0 bg-orange-50 z-30">
                            Total Absents
                        </td>
                        {dates.map(d => {
                            const count = employees.reduce((acc, emp) => {
                                const c = emp.shifts[d.dateStr];
                                // Est absent si code défini ET isWork est faux (Inclut CA, RTT, RH, Maladie...)
                                return c && !SHIFT_TYPES[c]?.isWork && c !== 'OFF' ? acc + 1 : acc;
                            }, 0);
                            return (
                                <td key={`abs-${d.dateStr}`} className="p-1 border-r border-orange-200 text-center text-orange-700 bg-orange-50">
                                    {count}
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
