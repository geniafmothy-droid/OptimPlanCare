import React, { useMemo, useState } from 'react';
import { Employee, ShiftCode, ViewMode } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScheduleGridProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  viewMode: ViewMode;
  onCellClick: (employeeId: string, date: string) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({ employees, startDate, days, viewMode, onCellClick }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Generate date headers (MOVED UP: Hooks must be executed unconditionally)
  const dates = useMemo(() => {
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      
      // FIX: Use local date construction instead of toISOString() to avoid timezone shifts
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      result.push({
        obj: d,
        str: dateStr, // Key used to lookup shifts
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNameFull: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('fr-FR', { month: 'short' })
      });
    }
    return result;
  }, [startDate, days]);

  // --- MODE HORAIRE (HOURLY) ---
  if (viewMode === 'hourly') {
    // Dans ce mode, on affiche une grille 05h-24h pour une seule journée
    
    // FIX: Use local date construction for hourly view as well
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const currentDateStr = `${year}-${month}-${day}`;

    const startDisplayHour = 5;
    const endDisplayHour = 24;
    const hours = Array.from({ length: endDisplayHour - startDisplayHour }, (_, i) => i + startDisplayHour);

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
                             style={{ borderLeftColor: shiftDef?.isWork ? undefined : 'transparent' }} 
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
                             let content = null;

                             if (isWorking && shiftDef?.startHour !== undefined && shiftDef?.endHour !== undefined) {
                                const start = shiftDef.startHour;
                                const end = shiftDef.endHour;

                                // Vérifier si l'heure 'h' est dans la plage [start, end[
                                if (h >= Math.floor(start) && h < end) {
                                   
                                   // Calcul de la position et largeur pour gérer les demi-heures
                                   // Par défaut occupe toute la cellule (0% left, 100% width)
                                   let leftPct = 0;
                                   let widthPct = 100;

                                   // Cas de la première heure (ex: start=6.5, h=6)
                                   if (h === Math.floor(start)) {
                                       leftPct = (start % 1) * 100;
                                       widthPct -= leftPct;
                                   }

                                   // Cas de la dernière heure (ex: end=18.5, h=18)
                                   if (h === Math.floor(end)) {
                                       const endPct = (end % 1) === 0 ? 100 : (end % 1) * 100;
                                       widthPct = endPct - leftPct;
                                   }

                                   content = (
                                      <div 
                                        className={`absolute inset-y-1 rounded-sm ${shiftDef.color} opacity-90 shadow-sm`}
                                        style={{ 
                                            left: `${leftPct}%`, 
                                            width: `${widthPct}%`,
                                            margin: '0 1px' // petite marge pour distinguer les blocs si collés
                                        }}
                                        title={`${shiftDef.label} (${start}h - ${end}h)`}
                                      ></div>
                                   );
                                }
                             }

                             return (
                                <td key={h} className="border-b border-r border-slate-100 p-0 relative h-10 min-w-[40px]">
                                   {content}
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

  const codesToCount: ShiftCode[] = ['IT', 'T5', 'T6', 'S', 'RH'];

  return (
    <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-white shadow-sm h-full">
      {/* Scrollable Container */}
      <div className="overflow-auto relative h-full flex flex-col">
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
          </tbody>
          
          {/* Footer with Totals */}
          <tfoot className="bg-slate-50 border-t-2 border-slate-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
             {/* Main Total Row */}
             <tr>
               <td className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-300 p-2">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Total Présents</span>
                    <button 
                        onClick={() => setShowDetails(!showDetails)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500"
                        title={showDetails ? "Masquer détails" : "Voir détails par code"}
                    >
                        {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                 </div>
               </td>
               {dates.map(d => {
                 const count = employees.reduce((acc, emp) => {
                   const code = emp.shifts[d.str];
                   return (code && SHIFT_TYPES[code].isWork) ? acc + 1 : acc;
                 }, 0);
                 const isUnderstaffed = count < 5; 
                 return (
                    <td key={`total-${d.str}`} className={`text-center text-xs font-bold p-1 border-b border-r border-slate-300 ${isUnderstaffed ? 'bg-red-50 text-red-700' : 'text-slate-700'}`}>
                      {count}
                    </td>
                 )
               })}
            </tr>

            {/* Detailed Rows (Collapsible) */}
            {showDetails && codesToCount.map(code => (
                <tr key={code} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 p-2 text-xs text-right font-medium text-slate-500 border-l-4"
                        style={{ borderLeftColor: SHIFT_TYPES[code].color.replace('bg-', '').replace('-200', '-400').replace('-300', '-500') }}
                    >
                        {code}
                    </td>
                    {dates.map(d => {
                        const count = employees.reduce((acc, emp) => {
                            return emp.shifts[d.str] === code ? acc + 1 : acc;
                        }, 0);
                        return (
                            <td key={`detail-${code}-${d.str}`} className="text-center text-[10px] p-1 border-b border-r border-slate-200 text-slate-600">
                                {count > 0 ? count : '-'}
                            </td>
                        )
                    })}
                </tr>
            ))}
          </tfoot>
        </table>
      </div>
      
      {/* Footer Legend */}
      <div className="bg-white p-2 text-[10px] text-slate-500 flex justify-between items-center no-print border-t border-slate-200">
          <div>
              Utilisez la flèche dans le total pour voir le détail par poste (IT, T5, etc.)
          </div>
          <div className="flex gap-2">
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200"></span> IT</span>
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-300"></span> T5</span>
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> T6</span>
             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-200"></span> S</span>
          </div>
      </div>
    </div>
  );
};