import React, { useMemo, useState } from 'react';
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp, Users, Briefcase, UserX, X, Coffee, CheckCircle2, AlertCircle } from 'lucide-react';
import { getHolidayName } from '../utils/holidays';

interface StaffingSummaryProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

export const StaffingSummary: React.FC<StaffingSummaryProps> = ({ employees, startDate, days }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDateDetail, setSelectedDateDetail] = useState<{ dateStr: string, dateObj: Date } | null>(null);

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
        dateObj: d,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 1),
        fullDayName: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        dayIndex: d.getDay(), // 0=Sun, 1=Mon...
        holiday: getHolidayName(d)
      });
    }
    return result;
  }, [startDate, days]);

  // Define Lists explicitly
  const WORK_CODES: ShiftCode[] = ['IT', 'T5', 'T6', 'S', 'M', 'DP', 'FO'];
  const ABSENCE_CODES: ShiftCode[] = ['RH', 'CA', 'RTT', 'HS', 'RC', 'NT', 'F', 'ETP', 'MAL', 'AT', 'ABS'];

  const getTargetClass = (code: ShiftCode, count: number, isWeekend: boolean, dayIndex: number, isHoliday: boolean) => {
      if (isWeekend || isHoliday) return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';

      const ALERT_CLASS = 'bg-red-100 text-red-700 font-bold border border-red-300';

      if (code === 'IT' && count < 4) return ALERT_CLASS;
      if (code === 'T5' && count < 1) return ALERT_CLASS;
      if (code === 'T6' && count < 1) return ALERT_CLASS;
      if (code === 'S' && [1, 3, 5].includes(dayIndex) && count < 2) return ALERT_CLASS;

      return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
  };

  // Compute lists for the selected date popup
  const detailLists = useMemo(() => {
      if (!selectedDateDetail) return null;
      
      const present: { emp: Employee, code: ShiftCode }[] = [];
      const absent: { emp: Employee, code: ShiftCode }[] = [];
      const rest: { emp: Employee, code: ShiftCode }[] = [];

      employees.forEach(emp => {
          const code = emp.shifts[selectedDateDetail.dateStr];
          const def = code ? (SHIFT_TYPES[code] || SHIFT_TYPES['OFF']) : SHIFT_TYPES['OFF'];

          if (code && def?.isWork) {
              present.push({ emp, code });
          } else if (code && !def?.isWork && code !== 'OFF' && code !== 'RH' && code !== 'NT' && code !== 'RC') {
              // Strict Absences (CA, MAL, etc)
              absent.push({ emp, code });
          } else {
              // Rest or OFF (Available for replacement theoretically)
              rest.push({ emp, code: code || 'OFF' });
          }
      });

      // Sort by name
      present.sort((a,b) => a.emp.name.localeCompare(b.emp.name));
      absent.sort((a,b) => a.emp.name.localeCompare(b.emp.name));
      rest.sort((a,b) => a.emp.name.localeCompare(b.emp.name));

      return { present, absent, rest };
  }, [selectedDateDetail, employees]);

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
                                title="Cliquez pour voir le détail nominatif"
                                onClick={() => setSelectedDateDetail({ dateStr: d.dateStr, dateObj: d.dateObj })}
                                className={`p-1 border-r border-b border-slate-200 text-center min-w-[30px] cursor-pointer hover:brightness-95 transition-all ${
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
                        if (!def) return null; 
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
                                    
                                    let cellClass = '';
                                    if (isWorkTable) {
                                        cellClass = getTargetClass(code, count, d.isWeekend, d.dayIndex, !!d.holiday);
                                    } else {
                                        cellClass = count > 0 ? 'text-slate-700 font-medium' : 'text-slate-300';
                                    }

                                    return (
                                        <td 
                                            key={`${code}-${d.dateStr}`} 
                                            className={`p-1 border-r border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100 ${cellClass}`}
                                            onClick={() => setSelectedDateDetail({ dateStr: d.dateStr, dateObj: d.dateObj })}
                                        >
                                            {count > 0 ? count : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    
                    <tr className={`${isWorkTable ? 'bg-blue-50' : 'bg-orange-50'} font-bold border-t-2 border-slate-200`}>
                        <td className={`p-2 border-r border-slate-200 text-right sticky left-0 z-10 ${isWorkTable ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                            {isWorkTable ? 'TOTAL PRÉSENTS' : 'TOTAL ABSENTS'}
                        </td>
                        {dates.map(d => {
                            const total = employees.reduce((acc, emp) => {
                                const c = emp.shifts[d.dateStr];
                                if (!c || c === 'OFF') return acc;
                                const isWorkShift = SHIFT_TYPES[c]?.isWork;
                                if (isWorkTable && isWorkShift) return acc + 1;
                                if (!isWorkTable && !isWorkShift) return acc + 1;
                                return acc;
                            }, 0);

                            return (
                                <td 
                                    key={`total-${d.dateStr}`} 
                                    className={`p-1 border-r border-slate-200 text-center cursor-pointer hover:brightness-95 ${isWorkTable ? 'text-blue-700' : 'text-orange-700'}`}
                                    onClick={() => setSelectedDateDetail({ dateStr: d.dateStr, dateObj: d.dateObj })}
                                >
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
    <>
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
                    <p className="text-xs text-slate-400 mb-4 italic flex items-center gap-1">
                        <AlertCircle className="w-3 h-3"/> Cliquez sur un jour ou un total pour voir le détail nominatif (Présents / Absents / Repos).
                    </p>
                    {renderTable("Compétences (Présents)", <Briefcase className="w-4 h-4 text-blue-600" />, WORK_CODES, true)}
                    {renderTable("Absences & Repos", <UserX className="w-4 h-4 text-orange-600" />, ABSENCE_CODES, false)}
                </div>
            )}
        </div>

        {/* DETAIL MODAL */}
        {selectedDateDetail && detailLists && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Détail Journalier</div>
                            <h3 className="text-xl font-bold text-slate-800 capitalize">{selectedDateDetail.dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                        </div>
                        <button onClick={() => setSelectedDateDetail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-6 h-6"/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                            
                            {/* COLUMN 1: PRESENT */}
                            <div className="bg-white rounded-lg border border-green-200 shadow-sm flex flex-col overflow-hidden h-full">
                                <div className="p-3 bg-green-50 border-b border-green-100 flex justify-between items-center">
                                    <div className="font-bold text-green-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> En Poste</div>
                                    <div className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">{detailLists.present.length}</div>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                    {detailLists.present.length === 0 ? <div className="text-slate-400 text-sm p-4 text-center italic">Personne ce jour.</div> : 
                                    detailLists.present.map((item, i) => {
                                        const def = SHIFT_TYPES[item.code] || SHIFT_TYPES['OFF'];
                                        return (
                                            <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                <span className="font-medium text-slate-700 text-sm truncate max-w-[140px]">{item.emp.name}</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${def.color} ${def.textColor}`}>
                                                    {item.code}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* COLUMN 2: ABSENT */}
                            <div className="bg-white rounded-lg border border-red-200 shadow-sm flex flex-col overflow-hidden h-full">
                                <div className="p-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
                                    <div className="font-bold text-red-800 flex items-center gap-2"><UserX className="w-4 h-4"/> Absents / Indispo</div>
                                    <div className="text-xs font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full">{detailLists.absent.length}</div>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                    {detailLists.absent.length === 0 ? <div className="text-slate-400 text-sm p-4 text-center italic">Aucune absence.</div> :
                                    detailLists.absent.map((item, i) => {
                                        const def = SHIFT_TYPES[item.code] || SHIFT_TYPES['OFF'];
                                        return (
                                            <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                <span className="font-medium text-slate-700 text-sm truncate max-w-[140px]">{item.emp.name}</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${def.color} ${def.textColor}`}>
                                                    {item.code}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* COLUMN 3: REST (AVAILABLE) */}
                            <div className="bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col overflow-hidden h-full">
                                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                                    <div className="font-bold text-slate-700 flex items-center gap-2"><Coffee className="w-4 h-4"/> Repos (Disponibles?)</div>
                                    <div className="text-xs font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">{detailLists.rest.length}</div>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                    {detailLists.rest.length === 0 ? <div className="text-slate-400 text-sm p-4 text-center italic">Tous affectés.</div> :
                                    detailLists.rest.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700 text-sm truncate max-w-[140px]">{item.emp.name}</span>
                                                <span className="text-[10px] text-slate-400">{item.emp.role}</span>
                                            </div>
                                            <span className="text-xs font-mono text-slate-400 font-bold px-2">
                                                {item.code}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};