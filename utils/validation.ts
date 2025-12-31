
import { Employee, ConstraintViolation, ServiceConfig, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { getEffectiveTargets, getWeekNumber } from './scheduler';

export const checkConstraints = (
    employees: Employee[], 
    startDate: Date, 
    days: number,
    serviceConfig?: ServiceConfig
): ConstraintViolation[] => {
    const list: ConstraintViolation[] = [];
    const isMaternityMode = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';
    
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayOfWeek = d.getDay(); 
        const weekNum = getWeekNumber(d);
        const isOdd = weekNum % 2 !== 0;

        const targets = getEffectiveTargets(d, serviceConfig);

        // Validation parité Maternité (CPF)
        if (isMaternityMode && (dayOfWeek === 3 || dayOfWeek === 5)) {
            const required = isOdd ? 2 : 1;
            ['CPF M', 'CPF C'].forEach(code => {
                const count = employees.filter(e => e.shifts[dateStr] === code).length;
                if (count < required) {
                    list.push({ 
                        employeeId: 'ALL', 
                        date: dateStr, 
                        type: 'PARITY_MISMATCH', 
                        message: `Effectif CPF insuffisant : ${count}/${required} (${code})`, 
                        severity: 'error' 
                    });
                }
            });
        }

        // Validation effectifs globaux
        Object.entries(targets).forEach(([code, target]) => {
            if (isMaternityMode && (code === 'CPF M' || code === 'CPF C') && (dayOfWeek === 3 || dayOfWeek === 5)) return;
            const count = employees.filter(e => e.shifts[dateStr] === code).length;
            if (count < (target as number)) {
                list.push({ employeeId: 'ALL', date: dateStr, type: 'MISSING_SKILL', message: `Alerte sous-effectif : ${count}/${target} agents en poste ${code}`, severity: 'warning' });
            }
        });
    }

    employees.forEach(emp => {
      // Règle 48h
      for (let i = 0; i <= days - 7; i++) {
          let totalHours = 0;
          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate); d.setDate(d.getDate() + i + j);
              const code = emp.shifts[d.toISOString().split('T')[0]];
              if (code && SHIFT_TYPES[code]?.isWork) totalHours += (SHIFT_HOURS[code] || 0);
          }
          if (totalHours > 48) {
              const d = new Date(startDate); d.setDate(d.getDate() + i);
              list.push({ employeeId: emp.id, date: d.toISOString().split('T')[0], type: 'CONSECUTIVE_DAYS', message: `${emp.name}: Dépassement 48h/7j (${totalHours}h)`, severity: 'error' });
          }
      }

      // Règle Maternité Cycles
      if (isMaternityMode) {
          if (emp.fte >= 1.0) { // 100% : 1 WE sur 2
              for (let i = 0; i < days - 14; i++) {
                  const d1 = new Date(startDate); d1.setDate(d1.getDate() + i);
                  if (d1.getDay() === 6) {
                      const d2 = new Date(d1); d2.setDate(d2.getDate() + 7);
                      const s1 = d1.toISOString().split('T')[0];
                      const s2 = d2.toISOString().split('T')[0];
                      if (emp.shifts[s1] && SHIFT_TYPES[emp.shifts[s1]]?.isWork && emp.shifts[s2] && SHIFT_TYPES[emp.shifts[s2]]?.isWork) {
                          list.push({ employeeId: emp.id, date: s2, type: 'INVALID_ROTATION', message: `${emp.name} (100%): Cumul de 2 week-ends travaillés`, severity: 'error' });
                      }
                  }
              }
          }
          if (emp.fte >= 0.75 && emp.fte < 0.9) { // 80% : Cycle strict
              for (let i = 0; i < days; i++) {
                  const d = new Date(startDate); d.setDate(d.getDate() + i);
                  if (d.getDay() === 5 && emp.shifts[d.toISOString().split('T')[0]] === 'S') {
                      const sat = new Date(d); sat.setDate(sat.getDate() + 1);
                      if (emp.shifts[sat.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat.toISOString().split('T')[0]]]?.isWork) {
                          list.push({ employeeId: emp.id, date: d.toISOString().split('T')[0], type: 'INVALID_ROTATION', message: `${emp.name} (80%): Cycle rompu (Poste S interdit avec WE travaillé)`, severity: 'error' });
                      }
                  }
              }
          }
      }
    });

    return list;
};
