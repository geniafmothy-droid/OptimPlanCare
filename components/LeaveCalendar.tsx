
import React, { useMemo } from 'react';
import { Employee } from '../types';
import { SHIFT_TYPES } from '../constants';

interface LeaveCalendarProps {
  employees: Employee[];
}

export const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ employees }) => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Display current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const dates = useMemo(() => {
      const arr = [];
      for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, month, i);
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          arr.push({ dateStr, dayNum: i, dayName: d.toLocaleDateString('fr-FR', {weekday: 'short'}) });
      }
      return arr;
  }, [year, month]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
            Planning des Absences - {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
        <div className="overflow-auto flex-1">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 border-r border-b border-slate-200 bg-white min-w-[200px] text-left sticky left-0 z-10">Collaborateur</th>
                        {dates.map(d => (
                            <th key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] ${['sa.','di.'].includes(d.dayName) ? 'bg-slate-100' : 'bg-white'}`}>
                                <div>{d.dayNum}</div>
                                <div className="text-[9px] uppercase">{d.dayName}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-2 border-r border-b border-slate-200 font-medium sticky left-0 bg-white z-10">
                                {emp.name}
                            </td>
                            {dates.map(d => {
                                const code = emp.shifts[d.dateStr];
                                const isAbsence = ['CA', 'RH', 'NT', 'FO', 'RC'].includes(code);
                                const def = SHIFT_TYPES[code];
                                
                                return (
                                    <td key={d.dateStr} className="p-1 border-r border-b border-slate-200 text-center p-0">
                                        {isAbsence && (
                                            <div 
                                                className={`w-full h-full min-h-[24px] flex items-center justify-center font-bold ${def?.color} ${def?.textColor}`}
                                                title={def?.label}
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
