
import { Employee, ConstraintViolation, ServiceConfig, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';

const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getMaternityMonthlyCap = (fte: number): number => {
    if (fte >= 1.0) return 161;
    if (fte >= 0.8) return 128.8; // 128h48
    if (fte >= 0.6) return 96.6;  // 96h36
    if (fte >= 0.5) return 80.5;  // 80h30
    return fte * 161;
};

const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
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
        const isEven = weekNum % 2 === 0;

        if (isMaternityMode) {
            // Rule 5: CPF parité
            if (dayOfWeek === 3) { // Mercredi
                const countCPFM = employees.filter(e => e.shifts[dateStr] === 'CPF M').length;
                const target = isEven ? 1 : 2;
                if (countCPFM < target) {
                    list.push({ employeeId: 'ALL', date: dateStr, type: 'PARITY_MISMATCH', message: `Mercredi ${isEven ? 'Pair' : 'Impair'} : Besoin de ${target} CPF M (${countCPFM}/${target})`, severity: 'error' });
                }
            }
            if (dayOfWeek === 5) { // Vendredi
                const countCPFM = employees.filter(e => e.shifts[dateStr] === 'CPF M').length;
                const target = isEven ? 2 : 1;
                if (countCPFM < target) {
                    list.push({ employeeId: 'ALL', date: dateStr, type: 'PARITY_MISMATCH', message: `Vendredi ${isEven ? 'Pair' : 'Impair'} : Besoin de ${target} CPF M (${countCPFM}/${target})`, severity: 'error' });
                }
            }

            // Rule 3: Respect targets from config
            if (serviceConfig?.shiftTargets?.[dayOfWeek]) {
                const targets = serviceConfig.shiftTargets[dayOfWeek];
                Object.entries(targets).forEach(([code, target]) => {
                    const count = employees.filter(e => e.shifts[dateStr] === code).length;
                    if (count < (target as number)) {
                        list.push({ employeeId: 'ALL', date: dateStr, type: 'MISSING_SKILL', message: `Manque de personnel en ${code} (${count}/${target})`, severity: 'warning' });
                    }
                });
            }
        }
    }

    // 2. Check Individual Patterns
    employees.forEach(emp => {
      let totalMonthlyHours = 0;

      for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const code = emp.shifts[dateStr];
          if (code && SHIFT_TYPES[code]?.isWork) {
              totalMonthlyHours += (SHIFT_HOURS[code] || 0);
          }

          // Rule 2: REPOS POST-NUIT (S -> Rest)
          if (code === 'S' && i < days - 1) {
              const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
              const nextDateStr = nextD.toISOString().split('T')[0];
              const nextCode = emp.shifts[nextDateStr];
              if (nextCode && SHIFT_TYPES[nextCode]?.isWork) {
                  list.push({ employeeId: emp.id, date: nextDateStr, type: 'INVALID_ROTATION', message: `${emp.name}: Repos post-nuit obligatoire après un poste S`, severity: 'error' });
              }
          }
      }

      // Check Monthly Quota for Maternity
      if (isMaternityMode) {
          const cap = getMaternityMonthlyCap(emp.fte);
          if (totalMonthlyHours > (cap + 0.01)) { // Marge d'erreur minime pour flottants
              list.push({ 
                  employeeId: emp.id, 
                  date: startDate.toISOString().split('T')[0], 
                  type: 'FTE_MISMATCH', 
                  message: `${emp.name}: Dépassement quota mensuel (${formatDuration(totalMonthlyHours)} / ${formatDuration(cap)})`, 
                  severity: 'error' 
              });
          }
      }

      // Common Rule: 48h / 7 days
      for (let i = 0; i <= days - 7; i++) {
          let totalHours7d = 0;
          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i + j);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const code = emp.shifts[dateStr];
              if (code && SHIFT_TYPES[code]?.isWork) totalHours7d += (SHIFT_HOURS[code] || 0);
          }
          if (totalHours7d > 48) {
              const startWindow = new Date(startDate); startWindow.setDate(startWindow.getDate() + i);
              list.push({ employeeId: emp.id, date: startWindow.toISOString().split('T')[0], type: 'CONSECUTIVE_DAYS', message: `${emp.name}: > 48h sur 7 jours glissants (${totalHours7d}h)`, severity: 'error' });
          }
      }

      // Rule 4: Maternity Specific Cycles
      if (isMaternityMode) {
          // 100% Rule: 1 WE sur 2
          if (emp.fte >= 1.0) {
              for (let i = 0; i < days - 14; i++) {
                  const d1 = new Date(startDate); d1.setDate(d1.getDate() + i);
                  if (d1.getDay() === 6) { 
                      const d2 = new Date(d1); d2.setDate(d2.getDate() + 7);
                      const workedW1 = (emp.shifts[d1.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[d1.toISOString().split('T')[0]]]?.isWork);
                      const workedW2 = (emp.shifts[d2.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[d2.toISOString().split('T')[0]]]?.isWork);
                      if (workedW1 && workedW2) {
                          list.push({ employeeId: emp.id, date: d2.toISOString().split('T')[0], type: 'INVALID_ROTATION', message: `${emp.name} (100%): Travail 2 WE consécutifs`, severity: 'error' });
                      }
                  }
              }
          }

          // 80% Rule: WE -> Friday Night cycle
          if (emp.fte >= 0.75 && emp.fte < 0.9) {
              for (let i = 0; i < days; i++) {
                  const d = new Date(startDate); d.setDate(d.getDate() + i);
                  const dateStr = d.toISOString().split('T')[0];
                  if (d.getDay() === 5 && emp.shifts[dateStr] === 'S') {
                      const sat = new Date(d); sat.setDate(sat.getDate() + 1);
                      if (emp.shifts[sat.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat.toISOString().split('T')[0]]]?.isWork) {
                          list.push({ employeeId: emp.id, date: dateStr, type: 'INVALID_ROTATION', message: `${emp.name} (80%): Cycle non respecté (Vendredi Nuit + WE)`, severity: 'error' });
                      }
                  }
              }
          }
      }
    });

    return list;
};
