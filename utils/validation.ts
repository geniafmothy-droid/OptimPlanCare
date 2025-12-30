import { Employee, ConstraintViolation, ServiceConfig, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { getEffectiveTargets } from './scheduler';

const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const checkConstraints = (
    employees: Employee[], 
    startDate: Date, 
    days: number,
    serviceConfig?: ServiceConfig
): ConstraintViolation[] => {
    const list: ConstraintViolation[] = [];
    const getDayOfWeek = (d: Date) => d.getDay();
    const isMaternityMode = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';
    
    // 1. Check Daily Staffing Rules
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayOfWeek = getDayOfWeek(d); 
        const weekNum = getWeekNumber(d);
        const isOdd = weekNum % 2 !== 0;

        // IA LOGIC: Fetch dynamically configured targets (includes parity logic)
        const targets = getEffectiveTargets(d, serviceConfig);

        // Specific Maternité Parity Logic for CPF (Rule 5)
        // Alert specifically if targets aren't met on key days
        if (isMaternityMode) {
            // Mercredi (3) et Vendredi (5)
            if (dayOfWeek === 3 || dayOfWeek === 5) {
                const required = isOdd ? 2 : 1;
                const weekLabel = isOdd ? 'Impaire' : 'Paire';
                const dayLabel = dayOfWeek === 3 ? 'Mercredi' : 'Vendredi';

                // Check CPF Matin
                if (!serviceConfig?.shiftTargets?.[dayOfWeek]?.['CPF M']) {
                    const countM = employees.filter(e => e.shifts[dateStr] === 'CPF M').length;
                    if (countM < required) {
                        list.push({ 
                            employeeId: 'ALL', 
                            date: dateStr, 
                            type: 'PARITY_MISMATCH', 
                            message: `Besoin de ${required} poste(s) "CPF Matin" ce ${dayLabel} (Semaine ${weekLabel})`, 
                            severity: 'error' 
                        });
                    }
                }
                // Check CPF Coupure
                if (!serviceConfig?.shiftTargets?.[dayOfWeek]?.['CPF C']) {
                    const countC = employees.filter(e => e.shifts[dateStr] === 'CPF C').length;
                    if (countC < required) {
                        list.push({ 
                            employeeId: 'ALL', 
                            date: dateStr, 
                            type: 'PARITY_MISMATCH', 
                            message: `Besoin de ${required} poste(s) "CPF Coupure" ce ${dayLabel} (Semaine ${weekLabel})`, 
                            severity: 'error' 
                        });
                    }
                }
            }
        }

        // Validate all configured targets for the service
        Object.entries(targets).forEach(([code, target]) => {
            // Skip redundant alerts for CPF if already handled by parity logic above
            if (isMaternityMode && (code === 'CPF M' || code === 'CPF C') && (dayOfWeek === 3 || dayOfWeek === 5)) return;

            const count = employees.filter(e => e.shifts[dateStr] === code).length;
            if (count < (target as number)) {
                list.push({ 
                    employeeId: 'ALL', 
                    date: dateStr, 
                    type: 'MISSING_SKILL', 
                    message: `Alerte effectif : ${count}/${target} agents en poste ${code}`, 
                    severity: 'warning' 
                });
            }
        });
    }

    // 2. Check Individual Patterns
    employees.forEach(emp => {
      // Common Rule: 48h / 7 days
      for (let i = 0; i <= days - 7; i++) {
          let totalHours = 0;
          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i + j);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const code = emp.shifts[dateStr];
              if (code && SHIFT_TYPES[code]?.isWork) totalHours += (SHIFT_HOURS[code] || 0);
          }
          if (totalHours > 48) {
              const startWindow = new Date(startDate); startWindow.setDate(startWindow.getDate() + i);
              list.push({ employeeId: emp.id, date: startWindow.toISOString().split('T')[0], type: 'CONSECUTIVE_DAYS', message: `${emp.name}: Dépassement 48h/sem (${totalHours}h)`, severity: 'error' });
          }
      }

      // Individual Patterns
      for (let i = 0; i < days - 1; i++) {
        const d = new Date(startDate); d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
        const nextDateStr = nextD.toISOString().split('T')[0];

        // Rule 2: S -> Rest (repos obligatoire après nuit/soirée)
        if (emp.shifts[dateStr] === 'S') {
            const nextCode = emp.shifts[nextDateStr];
            if (nextCode && SHIFT_TYPES[nextCode]?.isWork) {
                list.push({ employeeId: emp.id, date: nextDateStr, type: 'INVALID_ROTATION', message: `${emp.name}: Repos post-nuit non respecté après poste S`, severity: 'error' });
            }
        }
      }

      // Rule 4: Maternity Specific Cycles
      if (isMaternityMode) {
          // 100% Rule: 1 WE sur 2
          if (emp.fte >= 1.0) {
              for (let i = 0; i < days - 14; i++) {
                  const d1 = new Date(startDate); d1.setDate(d1.getDate() + i);
                  if (d1.getDay() === 6) { // Samedi
                      const d2 = new Date(d1); d2.setDate(d2.getDate() + 7); // Samedi suivant
                      const workedW1 = (emp.shifts[d1.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[d1.toISOString().split('T')[0]]]?.isWork);
                      const workedW2 = (emp.shifts[d2.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[d2.toISOString().split('T')[0]]]?.isWork);
                      if (workedW1 && workedW2) {
                          list.push({ employeeId: emp.id, date: d2.toISOString().split('T')[0], type: 'INVALID_ROTATION', message: `${emp.name} (100%): Cumul de 2 week-ends travaillés consécutifs`, severity: 'error' });
                      }
                  }
              }
          }

          // 80% Rule: cycle spécifique
          if (emp.fte >= 0.75 && emp.fte < 0.9) {
              for (let i = 0; i < days; i++) {
                  const d = new Date(startDate); d.setDate(d.getDate() + i);
                  const dateStr = d.toISOString().split('T')[0];
                  if (d.getDay() === 5 && emp.shifts[dateStr] === 'S') { // Vendredi Nuit
                      // Ensure not worked next sat/sun
                      const sat = new Date(d); sat.setDate(sat.getDate() + 1);
                      if (emp.shifts[sat.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat.toISOString().split('T')[0]]]?.isWork) {
                          list.push({ employeeId: emp.id, date: dateStr, type: 'INVALID_ROTATION', message: `${emp.name} (80%): Cycle rompu (Poste S le vendredi interdit si WE travaillé)`, severity: 'error' });
                      }
                  }
              }
          }
      }
    });

    return list;
};
