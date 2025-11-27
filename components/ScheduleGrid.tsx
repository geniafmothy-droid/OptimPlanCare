
import React, { useMemo } from 'react';
import { Employee, ShiftCode, ViewMode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ScheduleGridProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  viewMode: ViewMode;
  onCellClick: (employeeId: string, date: string) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({ employees, startDate, days, viewMode, onCellClick }) => {
  
  // --- MODE HORAIRE (HOURLY) ---
  if (viewMode === 'hourly') {
    // Dans ce mode, on affiche une grille 05h-24h pour une seule journée
    const currentDateStr = startDate.toISOString().split('T')[0];
    const hours = Array.from({ length: 19 }, (_, i) => i + 5); // 5h à 23h (affichage 24h)

    return (
      <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-white shadow-sm h-full">
         <div className="overflow-auto relative h-full">
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
                             style={{ borderLeftColor: shiftDef?.isWork ? shiftDef.color.replace('bg-', '') : 'transparent' }} // Petit indicateur visuel
                             onClick={() => onCellClick(emp.id, currentDateStr)}
                          >
                             <div className="font-medium text-sm text-slate-900">{emp.name}</div>
                             <div className="text-[10px] text-slate-500">
                                {shiftCode ? (
                                   <span className={`px-1.5 py-0.5 rounded ${shiftDef?.color} ${shiftDef?.textColor}`}>
                                      {shiftDef?.label} 
                                      {isWorking ? ` (${shiftDef?.startHour}h-${shiftDef?.endHour}h)` : ''}
                                   </span>
                                ) : 'OFF'}
                             </div>
                          </td>
                          
                          {/* Cellules horaires */}
                          {hours.map(h => {
                             let bgClass = '';
                             let isStart = false;
                             let isEnd = false;

                             if (isWorking && shiftDef?.startHour !== undefined && shiftDef?.endHour !== undefined) {
                                // Logique simple: si l'heure est dans la plage [start, end[
                                if (h >= Math.floor(shiftDef.startHour) && h < shiftDef.endHour) {
                                   // On utilise la couleur du shift, mais légèrement modifiée si besoin
                                   // Pour simplifier, on applique une classe de background générique ou style inline
                                   // Comme on ne peut pas interpoler facilement les classes tailwind dynamiques complètes, on utilise le style pour la couleur précise si besoin
                                   // Mais ici on a les classes dans shiftDef.color (ex: bg-blue-200)
                                   bgClass = shiftDef.color;
                                }

                                // Marqueurs visuels de début/fin pour les demi-heures (ex: 6.5)
                                if (Math.floor(shiftDef.startHour) === h && shiftDef.startHour % 1 !== 0) {
                                   bgClass = `${bgClass} bg-gradient-to-r from-transparent from-50% to-${shiftDef.color.replace('bg-', '')} to-50%`;
                                   // Fallback simple si gradient complexe: on colorie tout pour l'instant ou on gère via style
                                }
                             }

                             return (
                                <td key={h} className="border-b border-r border-slate-100 p-0 relative h-10">
                                   {bgClass && (
                                      <div className={`absolute inset-y-1 inset-x-0 mx-0.5 rounded-sm ${bgClass} opacity-80`}></div>
                                   )}
                                </td>
                             );
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

  // --- MODE DATE STANDARD (Mois, Semaine, 5 Jours) ---
  
  // Generate date headers
  const dates = useMemo(() => {
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      result.push({
        obj: d,
        str: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNameFull: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('fr-FR', { month: 'short' })
      });
    }
    return result;
  }, [startDate, days]);

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Adjust cell width based on number of days (Week/Day view vs Month view)
  const getCellWidthClass = () => {
      if (days === 1) return "min-w-[150px]";
      if (days <= 7) return "min-w-[100px]";
      return "min-w-[40px]";
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-white shadow-sm h-full">
      {/* Scrollable Container */}
      <div className="overflow-auto relative h-full">
        <table className="border-collapse w-max">
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr>
              {/* Sticky Corner */}
              <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 min-w-[220px] text-left">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collaborateur</span>
                  <span className="text-[10px] text-slate-400 font-normal">Matricule / Quotité / Comp.</span>
                </div>
              </th>
              {/* Date Headers */}
              {dates.map((d) => (
                <th 
                  key={d.str} 
                  className={`${getCellWidthClass()} border-b border-r border-slate-200 p-1 text-center text-xs ${
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
                {/* Employee Name (Sticky Left) */}
                <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-2 group cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{emp.name}</div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="text-slate-400 font-mono text-[9px] mr-1">#{emp.matricule}</span>
                        {/* Affichage de la Quotité */}
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                            emp.fte < 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {Math.round(emp.fte * 100)}%
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100">{emp.role.slice(0, 3)}</span>
                        {emp.skills.includes('Senior') && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Sr</span>
                        )}
                      </div>
                    </div>
                    {/* Status Indicator */}
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                </td>

                {/* Shift Cells */}
                {dates.map((d) => {
                  const shiftCode = emp.shifts[d.str] || 'OFF';
                  const shiftDef = SHIFT_TYPES[shiftCode];
                  
                  return (
                    <td 
                      key={`${emp.id}-${d.str}`} 
                      className={`border-b border-r border-slate-200 p-0.5 text-center cursor-pointer relative group ${
                        isWeekend(d.obj) ? 'bg-slate-50/50' : ''
                      }`}
                      onClick={() => onCellClick(emp.id, d.str)}
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
                      
                      {/* Tooltip on hover */}
                      <div className="absolute hidden group-hover:block z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap">
                         {d.dayName} {d.dayNum}: {shiftDef.label} - {shiftDef.description}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Totals Row (Sticky Bottom attempt, but rendering normally for simplicity in table) */}
            <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
               <td className="sticky left-0 z-10 bg-slate-100 border-r border-slate-300 p-2 text-xs text-right">
                 Total Présents
               </td>
               {dates.map(d => {
                 const count = employees.reduce((acc, emp) => {
                   const code = emp.shifts[d.str];
                   return (code && SHIFT_TYPES[code].isWork) ? acc + 1 : acc;
                 }, 0);
                 // Simple validation visual
                 const isUnderstaffed = count < 5; // Arbitrary rule
                 return (
                    <td key={`total-${d.str}`} className={`text-center text-xs p-1 border-r border-slate-300 ${isUnderstaffed ? 'bg-red-100 text-red-700' : ''}`}>
                      {count}
                    </td>
                 )
               })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
