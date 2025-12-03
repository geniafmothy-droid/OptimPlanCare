
import React, { useMemo, useState } from 'react';
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp, Users, Briefcase, UserX } from 'lucide-react';
import { getHolidayName } from '../utils/holidays';

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
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        holiday: getHolidayName(d)
      });
    }
    return result;
  }, [startDate, days]);

  // Define Lists explicitly
  const WORK_CODES: ShiftCode[] = ['IT', 'T5', 'T6', 'S', 'M', 'DP', 'FO'];
  const ABSENCE_CODES: ShiftCode[] = ['RH', 'CA', 'RTT', 'HS', 'RC', 'NT', 'F'];

  const renderTable = (title: string, icon: React.ReactNode, codes: ShiftCode[], isWorkTable: boolean) => (
    <div className="mb-6 last:mb-0">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
            {icon} {title}
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 border-r border-b border-slate-200 bg-slate-50 min-w-[150px] text-left text-slate-500 font-medium sticky left-0 z-10">
                            Type de Poste
                        </th>
                        {dates.map(d => (
                            <th 
                                key={d.dateStr} 
                                title={d.holiday || undefined}
                                className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] ${
                                    d.holiday ? 'bg-red-50 text-red-700' :
                                    d.isWeekend ? 'bg-slate-50 text-slate-800' : 'bg-white text-slate-500'
                                }`}
                            >
                                <div className="font-bold">{d.dayNum}</div>
                                <div className="text-[9px] uppercase">{d.dayName}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {codes.map(code => {
                        const def = SHIFT_TYPES[code];
                        if (!def) return null; // Safety check
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
                                    
                                    // Highlight logic for specific rules
                                    let bgClass = '';
                                    if (code === 'IT' && count < 4 && !d.isWeekend && !d.holiday) bgClass = 'bg-red-50 text-red-700 font-bold';
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
                    
                    {/* TOTAL ROW FOR THIS TABLE */}
                    <tr className={`${isWorkTable ? 'bg-blue-50' : 'bg-orange-50'} font-bold border-t-2 border-slate-200`}>
                        <td className={`p-2 border-r border-slate-200 text-right sticky left-0 z-10 ${isWorkTable ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                            {isWorkTable ? 'TOTAL PRÉSENTS' : 'TOTAL ABSENTS'}
                        </td>
                        {dates.map(d => {
                            const total = employees.reduce((acc, emp) => {
                                const c = emp.shifts[d.dateStr];
                                if (!c || c === 'OFF') return acc;
                                
                                const isWorkShift = SHIFT_TYPES[c]?.isWork;
                                // If Work Table, count worked shifts. If Absence Table, count non-worked shifts.
                                if (isWorkTable && isWorkShift) return acc + 1;
                                if (!isWorkTable && !isWorkShift) return acc + 1;
                                return acc;
                            }, 0);

                            return (
                                <td key={`total-${d.dateStr}`} className={`p-1 border-r border-slate-200 text-center ${isWorkTable ? 'text-blue-700' : 'text-orange-700'}`}>
                                    {total}
                                </td>
                            )
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm mt-4 flex flex-col no-print">
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
        <div className="p-4">
            {renderTable("Compétences (Présents)", <Briefcase className="w-4 h-4 text-blue-600" />, WORK_CODES, true)}
            {renderTable("Absences & Repos", <UserX className="w-4 h-4 text-orange-600" />, ABSENCE_CODES, false)}
        </div>
      )}
    </div>
  );
};
