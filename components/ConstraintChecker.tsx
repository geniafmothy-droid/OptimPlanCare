
import React from 'react';
import { Employee, ConstraintViolation } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface ConstraintCheckerProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

export const ConstraintChecker: React.FC<ConstraintCheckerProps> = ({ employees, startDate, days }) => {
  const violations: ConstraintViolation[] = React.useMemo(() => {
    const list: ConstraintViolation[] = [];
    
    // Helper to get day of week (0 = Sunday, 1 = Monday, ...)
    const getDayOfWeek = (d: Date) => d.getDay();

    const infirmiers = employees.filter(e => e.role === 'Infirmier');
    
    // 1. Check Daily Staffing Rules
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeek(d); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

        // Rule: Service Dialyse FERMÉ le dimanche
        // STRICT: Le code DOIT être RH
        if (dayOfWeek === 0) {
            employees.forEach(emp => {
                const code = emp.shifts[dateStr];
                // Si le code n'est pas RH (on tolère éventuellement CA s'il est en congés, mais la consigne dit "par défaut RH")
                // On va être strict : Si c'est du travail OU si ce n'est pas RH/CA
                if (SHIFT_TYPES[code]?.isWork) {
                    list.push({
                        employeeId: emp.id,
                        date: dateStr,
                        type: 'INVALID_ROTATION',
                        message: `${emp.name} : Service fermé le dimanche (Travail interdit)`,
                        severity: 'error'
                    });
                } else if (code !== 'RH' && code !== 'CA' && code !== 'OFF') {
                     list.push({
                        employeeId: emp.id,
                        date: dateStr,
                        type: 'INVALID_ROTATION',
                        message: `${emp.name} : Dimanche doit être marqué 'RH'`,
                        severity: 'warning'
                    });
                }
            });
            // Skip staffing checks for Sunday as the service is closed
            continue;
        }

        let countIT = 0;
        let countT5 = 0;
        let countT6 = 0;
        let countS = 0;

        infirmiers.forEach(emp => {
            const shift = emp.shifts[dateStr];
            if (shift === 'IT') countIT++;
            if (shift === 'T5') countT5++;
            if (shift === 'T6') countT6++;
            if (shift === 'S') countS++;
        });

        // Rule: 4 IDE en IT
        if (countIT < 4) {
            list.push({
                employeeId: 'ALL',
                date: dateStr,
                type: 'INVALID_ROTATION',
                message: `Manque d'Infirmiers en IT (${countIT}/4)`,
                severity: 'error'
            });
        }

        // Rule: 1 IDE en T5
        if (countT5 < 1) {
             list.push({
                employeeId: 'ALL',
                date: dateStr,
                type: 'INVALID_ROTATION',
                message: `Manque d'Infirmier en T5 (${countT5}/1)`,
                severity: 'warning'
            });
        }

        // Rule: 1 IDE en T6
        if (countT6 < 1) {
             list.push({
                employeeId: 'ALL',
                date: dateStr,
                type: 'INVALID_ROTATION',
                message: `Manque d'Infirmier en T6 (${countT6}/1)`,
                severity: 'warning'
            });
        }

        // Rule: Lundi, Mercredi, Vendredi -> 2 IDE en S
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
            if (countS < 2) {
                list.push({
                    employeeId: 'ALL',
                    date: dateStr,
                    type: 'INVALID_ROTATION',
                    message: `Besoin de 2 Infirmiers en Soir (${countS}/2)`,
                    severity: 'error'
                });
            }
        }
    }

    // 2. Check Individual Patterns
    employees.forEach(emp => {
      
      // A. S -> NT pattern
      for (let i = 0; i < days - 1; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);
        const nextDateStr = nextD.toISOString().split('T')[0];

        if (emp.shifts[dateStr] === 'S') {
            if (emp.shifts[nextDateStr] !== 'NT') {
                list.push({
                    employeeId: emp.id,
                    date: nextDateStr,
                    type: 'INVALID_ROTATION',
                    message: `${emp.name}: Après un Soir (S), doit être en NT`,
                    severity: 'error'
                });
            }
        }
      }

      // B. Weekly Rest (RH) - Simplified checking (per sliding 7 days)
      for (let i = 0; i <= days - 7; i++) {
          let rhCount = 0;
          let totalHours = 0;

          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i + j);
              const dateStr = d.toISOString().split('T')[0];
              
              const code = emp.shifts[dateStr];
              if (code === 'RH') rhCount++;
              
              // Sum hours for 48h check
              totalHours += (SHIFT_HOURS[code] || 0);
          }

          const startWindow = new Date(startDate);
          startWindow.setDate(startWindow.getDate() + i);
          const endWindow = new Date(startWindow);
          endWindow.setDate(endWindow.getDate() + 6);

          if (rhCount < 2) {
              list.push({
                  employeeId: emp.id,
                  date: startWindow.toISOString().split('T')[0],
                  type: 'CONSECUTIVE_DAYS',
                  message: `${emp.name}: Moins de 2 RH sur 7 jours (${startWindow.getDate()}-${endWindow.getDate()})`,
                  severity: 'warning'
              });
          }

          // Rule: Max 48h on 7 sliding days
          if (emp.role === 'Infirmier' && totalHours > 48) {
             list.push({
                  employeeId: emp.id,
                  date: startWindow.toISOString().split('T')[0],
                  type: 'CONSECUTIVE_DAYS',
                  message: `${emp.name}: > 48h sur 7 jours glissants (${totalHours}h)`,
                  severity: 'error'
              });
          }
      }

      // C. Saturday Rotation (1 out of 2) for Infirmiers
      if (emp.role === 'Infirmier') {
         for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dayOfWeek = getDayOfWeek(d);

            if (dayOfWeek === 6) { // Saturday
               const dateStr = d.toISOString().split('T')[0];
               const currentCode = emp.shifts[dateStr];
               
               if (currentCode && SHIFT_TYPES[currentCode]?.isWork) {
                  // Check previous Saturday
                  const prevSat = new Date(d);
                  prevSat.setDate(d.getDate() - 7);
                  const prevSatStr = prevSat.toISOString().split('T')[0];
                  const prevCode = emp.shifts[prevSatStr];

                  // Only check if previous Saturday is within our known data (shifts object)
                  if (prevCode && SHIFT_TYPES[prevCode]?.isWork) {
                     list.push({
                        employeeId: emp.id,
                        date: dateStr,
                        type: 'INVALID_ROTATION',
                        message: `${emp.name}: Travail deux Samedis consécutifs`,
                        severity: 'warning'
                    });
                  }
               }
            }
         }
      }

    });

    return list;
  }, [employees, startDate, days]);

  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-lg">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
           <AlertTriangle className="w-5 h-5 text-orange-500" />
           Contrôle Métier
        </h3>
        <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">
          {violations.length} Alertes
        </span>
      </div>
      
      <div className="bg-blue-50 p-3 text-xs text-blue-800 border-b border-blue-100 flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0" />
        <div>
          <p className="font-semibold">Règles actives :</p>
          <ul className="list-disc pl-3 mt-1 space-y-0.5">
            <li>Dimanche = RH obligatoire</li>
            <li>48h max / 7 jours glissants</li>
            <li>Max 1 samedi travaillé sur 2</li>
            <li>Poste S suivi impérativement de NT</li>
            <li>Effectifs : 4 IT, 1 T5, 1 T6</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
            <p>Aucune anomalie détectée</p>
          </div>
        ) : (
          violations.slice(0, 50).map((v, idx) => ( 
            <div key={idx} className={`p-3 rounded border text-sm flex items-start gap-3 ${
              v.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <XCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${v.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <div className={`font-semibold ${v.severity === 'error' ? 'text-red-800' : 'text-amber-800'}`}>
                  {v.employeeId === 'ALL' ? 'Effectif Insuffisant' : 'Règle Individuelle'}
                </div>
                <div className="text-slate-600">{v.message}</div>
                {v.employeeId === 'ALL' && (
                    <div className="text-xs text-slate-400 mt-1">{new Date(v.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
