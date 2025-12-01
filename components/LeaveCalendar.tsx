import React, { useMemo } from 'react';
import { Employee } from '../types';
import { SHIFT_TYPES } from '../constants';

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
              isWeekend: d.getDay() === 0 || d.getDay() === 6
          });
      }
      return arr;
  }, [startDate, days]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
        <div className="overflow-auto flex-1">
            <table className="w-max min-w-full text-xs border-collapse">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="p-2 border-r border-b border-slate-200 bg-slate-50 min-w-[200px] text-left sticky left-0 z-30">Collaborateur</th>
                        {dates.map(d => (
                            <th key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] ${d.isWeekend ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-800'}`}>
                                <div>{d.dayNum}</div>
                                <div className="text-[9px] uppercase">{d.dayName}</div>
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
                                const isAbsence = ['CA', 'RH', 'NT', 'FO', 'RC', 'HS'].includes(code);
                                const def = SHIFT_TYPES[code];
                                
                                return (
                                    <td key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center p-0 ${d.isWeekend ? 'bg-slate-50/50' : ''}`}>
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
            </table>
        </div>
    </div>
  );
};
