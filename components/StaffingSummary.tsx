
import React, { useMemo, useState } from 'react';
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

interface StaffingSummaryProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

export const StaffingSummary: React.FC<StaffingSummaryProps> = ({ employees, startDate, days }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Generate dates headers
  const dates = useMemo(() => {
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      result.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 1),
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return result;
  }, [startDate, days]);

  // Codes to track - Added HS
  const codes: ShiftCode[] = ['IT', 'T5', 'T6', 'S', 'NT', 'RH', 'CA', 'RC', 'HS'];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm mt-2 flex flex-col no-print">
      <div 
        className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
           <Users className="w-4 h-4 text-blue-600" />
           Synthèse des Effectifs
        </h3>
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
      </div>

      {!isCollapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
             <thead>
                <tr>
                   <th className="p-2 border-r border-b border-slate-200 bg-white min-w-[150px] text-left text-slate-500 font-medium sticky left-0 z-10">
                      Compétence / Poste
                   </th>
                   {dates.map(d => (
                      <th key={d.dateStr} className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] ${d.isWeekend ? 'bg-slate-50 text-slate-800' : 'bg-white text-slate-500'}`}>
                         <div className="font-bold">{d.dayNum}</div>
                         <div className="text-[9px] uppercase">{d.dayName}</div>
                      </th>
                   ))}
                </tr>
             </thead>
             <tbody>
                {codes.map(code => {
                   const def = SHIFT_TYPES[code];
                   return (
                      <tr key={code} className="hover:bg-slate-50">
                         <td className="p-2 border-r border-b border-slate-200 font-medium flex items-center gap-2 sticky left-0 bg-white z-10">
                            <span className={`w-2 h-2 rounded-full ${def.color}`}></span>
                            <span className="text-slate-700">{code}</span>
                            <span className="text-[10px] text-slate-400 font-normal ml-auto hidden sm:inline">{def.description.split('(')[0]}</span>
                         </td>
                         {dates.map(d => {
                            const count = employees.reduce((acc, emp) => {
                               return emp.shifts[d.dateStr] === code ? acc + 1 : acc;
                            }, 0);
                            
                            // Highlight logic
                            let bgClass = '';
                            if (code === 'IT' && count < 4 && !d.isWeekend) bgClass = 'bg-red-50 text-red-700 font-bold';
                            else if (count === 0) bgClass = 'text-slate-300';
                            else bgClass = 'text-slate-700 font-medium';

                            return (
                               <td key={`${code}-${d.dateStr}`} className={`p-1 border-r border-b border-slate-200 text-center ${bgClass}`}>
                                  {count > 0 ? count : '-'}
                               </td>
                            );
                         })}
                      </tr>
                   );
                })}
                {/* Total Row */}
                <tr className="bg-slate-50 font-bold">
                    <td className="p-2 border-r border-slate-200 text-slate-700 text-right sticky left-0 bg-slate-50 z-10">TOTAL PRÉSENTS</td>
                    {dates.map(d => {
                        const total = employees.reduce((acc, emp) => {
                            const c = emp.shifts[d.dateStr];
                            return (c && SHIFT_TYPES[c]?.isWork) ? acc + 1 : acc;
                        }, 0);
                        return (
                            <td key={`total-${d.dateStr}`} className="p-1 border-r border-slate-200 text-center text-blue-700 bg-slate-50">
                                {total}
                            </td>
                        )
                    })}
                </tr>
             </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
