
import React, { useMemo, useState, useRef } from 'react';
import { Employee, ShiftCode, ViewMode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface ScheduleGridProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  viewMode: ViewMode;
  onCellClick: (employeeId: string, date: string) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({ employees, startDate, days, viewMode, onCellClick }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate date headers
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
        obj: d,
        str: dateStr,
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNameFull: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('fr-FR', { month: 'short' })
      });
    }
    return result;
  }, [startDate, days]);

  const handleScroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const scrollAmount = 300;
          scrollContainerRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
          });
      }
  };

  // --- MODE HORAIRE (HOURLY) ---
  if (viewMode === 'hourly') {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const currentDateStr = `${year}-${month}-${day}`;

    const startDisplayHour = 5;
    const endDisplayHour = 24;
    const hours = Array.from({ length: endDisplayHour - startDisplayHour }, (_, i) => i + startDisplayHour);

    return (
      <div className="flex-1 overflow-hidden flex flex-col h-full relative group bg-white">
         <div className="overflow-auto relative h-full" ref={scrollContainerRef}>
            <table className="border-collapse w-max min-w-full">
              <thead className="sticky top-0 z-20 bg-white shadow-sm">
                 <tr>
                    <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 min-w-[220px] text-left">
                       <span className="text-xs font-semibold text-slate-500 uppercase">Collaborateur</span>
                    </th>
                    {hours.map(h => (
                       <th key={h} className="min-w-[40px] border-b border-r border-slate-200 p-1 text-center text-xs bg-white text-slate-600">
                          {h}h
                       </th>
                    ))}
                 </tr>
              </thead>
              <tbody>
                 {employees.map(emp => {
                    const shiftCode = emp.shifts[currentDateStr];
                    const shiftDef = shiftCode ? SHIFT_TYPES[shiftCode] : null;
                    const isWorking = shiftDef?.isWork && shiftDef?.startHour !== undefined && shiftDef?.endHour !== undefined;

                    return (
                       <tr key={emp.id} className="hover:bg-slate-50">
                          <td 
                             className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-2 cursor-pointer border-l-4"
                             style={{ borderLeftColor: shiftDef?.isWork ? undefined : 'transparent' }} 
                             onClick={() => onCellClick(emp.id, currentDateStr)}
                          >
                             <div className="font-medium text-sm text-slate-900">{emp.name}</div>
                          </td>
                          {hours.map(h => {
                             let content = null;
                             if (isWorking && shiftDef?.startHour !== undefined && shiftDef?.endHour !== undefined) {
                                const start = shiftDef.startHour;
                                const end = shiftDef.endHour;
                                if (h >= Math.floor(start) && h < end) {
                                   let leftPct = 0;
                                   let widthPct = 100;
                                   if (h === Math.floor(start)) {
                                       leftPct = (start % 1) * 100;
                                       widthPct -= leftPct;
                                   }
                                   if (h === Math.floor(end)) {
                                       const endPct = (end % 1) === 0 ? 100 : (end % 1) * 100;
                                       widthPct = endPct - leftPct;
                                   }
                                   content = (
                                      <div 
                                        className={`absolute inset-y-1 rounded-sm ${shiftDef.color} opacity-90 shadow-sm`}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, margin: '0 1px' }}
                                        title={`${shiftDef.label} (${shiftDef.startHour}h - ${shiftDef.endHour}h)`}
                                      ></div>
                                   );
                                }
                             }
                             return <td key={h} className="border-b border-r border-slate-100 p-0 relative h-10 min-w-[40px]">{content}</td>;
                          })}
                       </tr>
                    );
                 })}
              </tbody>
            </table>
         </div>
      </div>
    );
  }

  // --- MODE DATE STANDARD ---

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getCellWidthClass = () => {
      if (days === 1) return "min-w-[150px]";
      if (days <= 7) return "min-w-[100px]";
      return "min-w-[40px]";
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full relative group">
      {/* Buttons Fixed to Sticky Header Area to ensure visibility even if table is short */}
      {days > 7 && (
          <>
            <button 
                onClick={() => handleScroll('left')}
                className="absolute left-[225px] top-10 z-40 p-1.5 bg-white/90 hover:bg-white text-slate-700 border border-slate-300 rounded shadow-md opacity-0 group-hover:opacity-100 transition-all no-print"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
                onClick={() => handleScroll('right')}
                className="absolute right-2 top-10 z-40 p-1.5 bg-white/90 hover:bg-white text-slate-700 border border-slate-300 rounded shadow-md opacity-0 group-hover:opacity-100 transition-all no-print"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
          </>
      )}

      <div className="overflow-auto relative flex-1 flex flex-col scroll-smooth" ref={scrollContainerRef}>
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 min-w-[220px] text-left h-14">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collaborateur</span>
                  <span className="text-[10px] text-slate-400 font-normal">Matricule / Quotité / Comp.</span>
                </div>
              </th>
              {dates.map((d) => (
                <th 
                  key={d.str} 
                  className={`${getCellWidthClass()} border-b border-r border-slate-200 p-1 text-center text-xs h-14 ${
                    isWeekend(d.obj) ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-600'
                  }`}
                >
                  <div className="font-bold flex items-center justify-center gap-1">
                      {d.dayNum}
                      {days <= 7 && <span className="font-normal text-slate-400">{d.month}</span>}
                  </div>
                  <div className="text-[10px] uppercase">
                      {days <= 7 ? d.dayNameFull : d.dayName.slice(0, 1)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-2 group cursor-pointer h-12">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{emp.name}</div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                            emp.fte < 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {Math.round(emp.fte * 100)}%
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100">{emp.role.slice(0, 3)}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {dates.map((d) => {
                  const shiftCode = emp.shifts[d.str] || 'OFF';
                  const shiftDef = SHIFT_TYPES[shiftCode];
                  
                  return (
                    <td 
                      key={`${emp.id}-${d.str}`} 
                      className={`border-b border-r border-slate-200 p-0.5 text-center cursor-pointer relative group h-12 ${
                        isWeekend(d.obj) ? 'bg-slate-50/50' : ''
                      }`}
                      onClick={() => onCellClick(emp.id, d.str)}
                      title={shiftCode !== 'OFF' ? `${d.dayName} ${d.dayNum}: ${shiftDef.label}` : undefined}
                    >
                      <div 
                        className={`
                          w-full h-8 flex items-center justify-center text-[10px] font-bold rounded-sm shadow-sm transition-all
                          hover:opacity-80 hover:scale-105 hover:z-10 hover:shadow-md
                          ${shiftDef.color} ${shiftDef.textColor}
                          ${shiftCode === 'OFF' ? 'opacity-0 hover:opacity-100 border border-dashed border-slate-300' : ''}
                        `}
                      >
                        {shiftCode !== 'OFF' ? shiftCode : '+'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
             {employees.length === 0 && (
                 <tr>
                     <td colSpan={dates.length + 1} className="p-8 text-center text-slate-400 italic bg-slate-50">
                         Aucun employé ne correspond aux filtres.
                     </td>
                 </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
