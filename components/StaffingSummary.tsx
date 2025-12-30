
import React, { useMemo, useState } from 'react';
import { Employee, ShiftCode, ShiftDefinition, ServiceConfig } from '../types';
import { SHIFT_TYPES } from '../constants';
import { ChevronDown, ChevronUp, Users, Briefcase, UserX, X, Coffee, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getHolidayName } from '../utils/holidays';

interface StaffingSummaryProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  shiftDefinitions?: Record<string, ShiftDefinition>;
  activeServiceId?: string;
  serviceConfig?: ServiceConfig;
}

export const StaffingSummary: React.FC<StaffingSummaryProps> = ({ employees, startDate, days, shiftDefinitions, activeServiceId, serviceConfig }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDateDetail, setSelectedDateDetail] = useState<{ dateStr: string, dateObj: Date } | null>(null);

  const defs = useMemo(() => shiftDefinitions || SHIFT_TYPES, [shiftDefinitions]);

  const formatHour = (h?: number) => {
    if (h === undefined) return '';
    const hh = Math.floor(h);
    const mm = Math.round((h % 1) * 60);
    return `${hh.toString().padStart(2, '0')}h${mm.toString().padStart(2, '0')}`;
  };

  // Dynamically determine which codes to display based on the active service
  const { workCodes, absenceCodes } = useMemo(() => {
    const allDefsArray = Object.values(defs) as ShiftDefinition[];
    
    // 1. Logique pour les postes de travail (Work Codes) : Filtrés par service
    let workRelevantDefs = allDefsArray;
    if (activeServiceId) {
        const serviceSpecific = allDefsArray.filter(d => d.serviceId === activeServiceId && d.isWork);
        if (serviceSpecific.length > 0) {
            workRelevantDefs = serviceSpecific;
        } else {
            // Fallback aux postes de travail globaux
            workRelevantDefs = allDefsArray.filter(d => !d.serviceId && d.isWork);
        }
    } else {
        workRelevantDefs = allDefsArray.filter(d => !d.serviceId && d.isWork);
    }

    // 2. Logique pour les absences : Toujours afficher les codes globaux (sans serviceId)
    const globalAbsences = allDefsArray.filter(d => !d.isWork && d.code !== 'OFF' && !d.serviceId);

    const w = workRelevantDefs.map(d => d.code);
    const a = globalAbsences.map(d => d.code);

    return { workCodes: w, absenceCodes: a };
  }, [defs, activeServiceId]);

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
        dayIndex: d.getDay(), 
        holiday: getHolidayName(d)
      });
    }
    return result;
  }, [startDate, days]);

  const getTargetClass = (code: ShiftCode, count: number, isWeekend: boolean, dayIndex: number, isHoliday: boolean) => {
      const ALERT_CLASS = 'bg-red-100 text-red-700 font-bold border border-red-300 ring-1 ring-inset ring-red-200';
      
      // 1. Priorité absolue : Jours fériés (souvent pas d'alertes d'effectifs cibles)
      if (isHoliday) return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';

      // 2. Priorité absolue : Vérification si le service est FERMÉ ce jour là
      // Si le jour n'est pas dans la liste des jours d'ouverture, on ne met jamais d'alerte
      if (serviceConfig?.openDays && !serviceConfig.openDays.includes(dayIndex)) {
          return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
      }

      // 3. Contrôle des cibles spécifiques au service (si configurées)
      if (serviceConfig) {
          // Priorité 3.1: Cible spécifique par jour pour ce code
          const daySpecificTarget = serviceConfig.shiftTargets?.[dayIndex]?.[code];
          if (daySpecificTarget !== undefined) {
              if (count < daySpecificTarget) return ALERT_CLASS;
              return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
          }
          
          // Priorité 3.2: Requis générique par compétence (minStaff)
          const skillReq = serviceConfig.skillRequirements?.find(r => r.skillCode === code);
          if (skillReq) {
              if (count < skillReq.minStaff) return ALERT_CLASS;
              return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
          }
      }
      
      // 4. Règles de repli par défaut (Dialyse) si aucune cible n'est configurée
      if (!activeServiceId || (serviceConfig && serviceConfig.fteConstraintMode === 'DIALYSIS_STANDARD')) {
          // En dialyse standard, le dimanche (0) est fermé par défaut
          if (dayIndex === 0) return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
          
          if (code === 'IT' && count < 4) return ALERT_CLASS;
          if (code === 'T5' && count < 1) return ALERT_CLASS;
          if (code === 'T6' && count < 1) return ALERT_CLASS;
          if (code === 'S') {
              const target = [1, 3, 5].includes(dayIndex) ? 2 : 1;
              if (count < target) return ALERT_CLASS;
          }
      }

      return count === 0 ? 'text-slate-300' : 'text-slate-700 font-medium';
  };

  const detailLists = useMemo(() => {
      if (!selectedDateDetail) return null;
      
      const present: { emp: Employee, code: ShiftCode }[] = [];
      const absent: { emp: Employee, code: ShiftCode }[] = [];
      const rest: { emp: Employee, code: ShiftCode }[] = [];

      employees.forEach(emp => {
          const code = emp.shifts[selectedDateDetail.dateStr];
          const def = code ? (defs[code] || defs['OFF']) : defs['OFF'];

          if (code && def?.isWork) {
              present.push({ emp, code });
          } else if (code && !def?.isWork && code !== 'OFF' && code !== 'RH' && code !== 'NT' && code !== 'RC') {
              absent.push({ emp, code });
          } else {
              rest.push({ emp, code: code || 'OFF' });
          }
      });

      present.sort((a,b) => a.emp.name.localeCompare(b.emp.name));
      absent.sort((a,b) => a.emp.name.localeCompare(b.emp.name));
      rest.sort((a,b) => a.emp.name.localeCompare(b.emp.name));

      return { present, absent, rest };
  }, [selectedDateDetail, employees, defs]);

  const renderTable = (title: string, icon: React.ReactNode, codes: ShiftCode[], isWorkTable: boolean) => (
    <div className="mb-6 last:mb-0">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
            {icon} {title}
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 border-r border-b border-slate-200 bg-slate-50 min-w-[200px] text-left text-slate-500 font-bold sticky left-0 z-10">
                            Type de Poste (Code & Horaires)
                        </th>
                        {dates.map(d => (
                            <th 
                                key={d.dateStr} 
                                title="Cliquez pour voir le détail nominatif"
                                onClick={() => setSelectedDateDetail({ dateStr: d.dateStr, dateObj: d.dateObj })}
                                className={`p-1 border-r border-b border-slate-200 text-center min-w-[34px] cursor-pointer hover:brightness-95 transition-all ${
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
                        const def = defs[code];
                        if (!def) return null; 
                        return (
                            <tr key={code} className="hover:bg-slate-50">
                                <td className="p-2 border-r border-b border-slate-200 font-bold flex items-center gap-2 sticky left-0 bg-white z-10">
                                    <span className={`w-2.5 h-2.5 rounded-sm ${def.color} border border-black/10`}></span>
                                    <div className="flex flex-col">
                                        <span className="text-slate-900">{def.code}</span>
                                        {def.isWork && def.startHour !== undefined && (
                                            <span className="text-[9px] text-blue-600 font-medium">
                                                {formatHour(def.startHour)} - {formatHour(def.endHour)}
                                            </span>
                                        )}
                                    </div>
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
                    
                    <tr className={`${isWorkTable ? 'bg-blue-50/50' : 'bg-orange-50/50'} font-bold border-t-2 border-slate-200`}>
                        <td className={`p-2 border-r border-slate-200 text-right sticky left-0 z-10 ${isWorkTable ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                            {isWorkTable ? 'TOTAL PRÉSENTS' : 'TOTAL ABSENTS'}
                        </td>
                        {dates.map(d => {
                            const total = employees.reduce((acc, emp) => {
                                const c = emp.shifts[d.dateStr];
                                if (!c || c === 'OFF') return acc;
                                const isWorkShift = defs[c]?.isWork;
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
                    <p className="text-[11px] text-slate-400 mb-4 italic flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-100">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-500"/> Cliquez sur un jour ou un total pour voir le détail nominatif (Présents / Absents / Repos). Les horaires sont indicatifs.
                    </p>
                    {renderTable("Postes en Service", <Briefcase className="w-4 h-4 text-blue-600" />, workCodes, true)}
                    {renderTable("Absences & Indisponibilités", <UserX className="w-4 h-4 text-orange-600" />, absenceCodes, false)}
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
                        <button onClick={() => setSelectedDateDetail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-6 h-6"/></button>
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
                                        const def = defs[item.code] || defs['OFF'];
                                        return (
                                            <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                <span className="font-medium text-slate-700 text-sm truncate max-w-[140px]">{item.emp.name}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${def.color} ${def.textColor}`}>
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
                                        const def = defs[item.code] || defs['OFF'];
                                        return (
                                            <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                <span className="font-medium text-slate-700 text-sm truncate max-w-[140px]">{item.emp.name}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${def.color} ${def.textColor}`}>
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
