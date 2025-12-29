
import { Employee, ConstraintViolation, ServiceConfig } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';

export const checkConstraints = (
    employees: Employee[], 
    startDate: Date, 
    days: number,
    serviceConfig?: ServiceConfig
): ConstraintViolation[] => {
    const list: ConstraintViolation[] = [];
    
    // Helper to get day of week (0 = Sunday, 1 = Monday, ...)
    const getDayOfWeek = (d: Date) => d.getDay();

    const infirmiers = employees.filter(e => e.role === 'Infirmier' || e.role === 'Sage-Femme');
    const isDialysisMode = serviceConfig?.fteConstraintMode === 'DIALYSIS_STANDARD';
    const isMaternityMode = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';
    
    // 1. Check Daily Staffing Rules
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        // FORCE LOCAL DATE STRING
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayOfWeek = getDayOfWeek(d); // 0=Sun, 1=Mon...

        // Check if service is open
        const isOpen = (serviceConfig && Array.isArray(serviceConfig.openDays)) 
            ? serviceConfig.openDays.includes(dayOfWeek) 
            : dayOfWeek !== 0;

        // Si le service est FERMÉ ce jour-là
        if (!isOpen) {
            employees.forEach(emp => {
                const code = emp.shifts[dateStr];
                // Si travail alors que fermé => Erreur
                if (code && SHIFT_TYPES[code]?.isWork) {
                    list.push({
                        employeeId: emp.id,
                        date: dateStr,
                        type: 'INVALID_ROTATION',
                        message: `${emp.name} : Service fermé ce jour (Travail interdit)`,
                        severity: 'error'
                    });
                } 
            });
            continue;
        }

        // --- STAFFING CHECKS (Default or custom) ---
        if (!isMaternityMode) {
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
                list.push({ employeeId: 'ALL', date: dateStr, type: 'INVALID_ROTATION', message: `Manque d'Infirmiers en IT (${countIT}/4)`, severity: 'error' });
            }
            // Rule: 1 IDE en T5
            if (countT5 < 1) {
                 list.push({ employeeId: 'ALL', date: dateStr, type: 'INVALID_ROTATION', message: `Manque d'Infirmier en T5 (${countT5}/1)`, severity: 'warning' });
            }
            // Rule: 1 IDE en T6
            if (countT6 < 1) {
                 list.push({ employeeId: 'ALL', date: dateStr, type: 'INVALID_ROTATION', message: `Manque d'Infirmier en T6 (${countT6}/1)`, severity: 'warning' });
            }
            // Rule: Lundi, Mercredi, Vendredi -> 2 IDE en S
            if ((dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) && countS < 2) {
                list.push({ employeeId: 'ALL', date: dateStr, type: 'INVALID_ROTATION', message: `Besoin de 2 Infirmiers en Soir (${countS}/2)`, severity: 'error' });
            }
        }
    }

    // 2. Check Individual Patterns
    employees.forEach(emp => {
      
      // A. S -> Work pattern (Forbidden)
      for (let i = 0; i < days - 1; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);
        const nextDateStr = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`;

        if (emp.shifts[dateStr] === 'S') {
            const nextCode = emp.shifts[nextDateStr];
            if (nextCode && SHIFT_TYPES[nextCode]?.isWork) {
                list.push({
                    employeeId: emp.id,
                    date: nextDateStr,
                    type: 'INVALID_ROTATION',
                    message: `${emp.name}: Enchaînement Soir (S) -> Travail interdit (Repos ou Absence requis)`,
                    severity: 'error',
                    priority: 'HIGH'
                });
            }
        }
      }

      // B. Weekly Rest & Max Consecutive
      for (let i = 0; i <= days - 7; i++) {
          let rhCount = 0;
          let totalHours = 0;
          let consecutiveWorkDays = 0;
          let maxConsecutiveObserved = 0;

          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i + j);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              
              const code = emp.shifts[dateStr];
              const isWork = code && SHIFT_TYPES[code]?.isWork;

              if (code && !isWork && code !== 'OFF') rhCount++;
              
              if (isWork) {
                  consecutiveWorkDays++;
                  totalHours += (SHIFT_HOURS[code] || 0);
              } else {
                  maxConsecutiveObserved = Math.max(maxConsecutiveObserved, consecutiveWorkDays);
                  consecutiveWorkDays = 0; 
              }
          }
          maxConsecutiveObserved = Math.max(maxConsecutiveObserved, consecutiveWorkDays);

          const startWindow = new Date(startDate);
          startWindow.setDate(startWindow.getDate() + i);
          const dateLabel = `${startWindow.getFullYear()}-${String(startWindow.getMonth() + 1).padStart(2, '0')}-${String(startWindow.getDate()).padStart(2, '0')}`;

          if (rhCount < 2) {
              list.push({ employeeId: emp.id, date: dateLabel, type: 'CONSECUTIVE_DAYS', message: `${emp.name}: Moins de 2 jours de repos/absence sur 7 jours glissants`, severity: 'warning' });
          }

          if ((isDialysisMode || isMaternityMode) && maxConsecutiveObserved > 2) {
              list.push({
                  employeeId: emp.id,
                  date: dateLabel,
                  type: 'CONSECUTIVE_DAYS',
                  message: `${emp.name}: ${maxConsecutiveObserved} jours consécutifs (Max 2 autorisé en mode strict)`,
                  severity: 'error',
                  priority: 'HIGH'
              });
          }

          if (totalHours > 48) {
             list.push({ employeeId: emp.id, date: dateLabel, type: 'CONSECUTIVE_DAYS', message: `${emp.name}: > 48h sur 7 jours glissants (${totalHours}h)`, severity: 'error' });
          }
      }

      // C. Saturday Rotation (Default 1/2)
      if (!isMaternityMode && (emp.role === 'Infirmier' || emp.role === 'Sage-Femme')) {
         for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            if (d.getDay() === 6) { 
               const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
               const currentCode = emp.shifts[dateStr];
               if (currentCode && SHIFT_TYPES[currentCode]?.isWork) {
                  const prevSat = new Date(d); prevSat.setDate(d.getDate() - 7);
                  const prevSatStr = `${prevSat.getFullYear()}-${String(prevSat.getMonth() + 1).padStart(2, '0')}-${String(prevSat.getDate()).padStart(2, '0')}`;
                  if (emp.shifts[prevSatStr] && SHIFT_TYPES[emp.shifts[prevSatStr]]?.isWork) {
                     list.push({ employeeId: emp.id, date: dateStr, type: 'INVALID_ROTATION', message: `${emp.name}: Travail deux Samedis consécutifs`, severity: 'warning' });
                  }
               }
            }
         }
      }

      // D. MATERNITY SPECIFIC RULES
      if (isMaternityMode) {
          const analysisStart = new Date(startDate);
          const startDay = analysisStart.getDay();
          const diffToMon = startDay === 0 ? -6 : 1 - startDay; 
          analysisStart.setDate(analysisStart.getDate() + diffToMon);

          // 100% Rule: 1 Week-end sur 2
          if (emp.fte >= 1.0) {
              for (let w = 0; w < Math.ceil(days / 7) - 1; w++) {
                  const sat1 = new Date(analysisStart); sat1.setDate(analysisStart.getDate() + (w * 7) + 5);
                  const sun1 = new Date(analysisStart); sun1.setDate(analysisStart.getDate() + (w * 7) + 6);
                  const sat2 = new Date(analysisStart); sat2.setDate(analysisStart.getDate() + ((w + 1) * 7) + 5);
                  const sun2 = new Date(analysisStart); sun2.setDate(analysisStart.getDate() + ((w + 1) * 7) + 6);

                  const w1Worked = (emp.shifts[sat1.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat1.toISOString().split('T')[0]]]?.isWork) ||
                                  (emp.shifts[sun1.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sun1.toISOString().split('T')[0]]]?.isWork);
                  const w2Worked = (emp.shifts[sat2.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat2.toISOString().split('T')[0]]]?.isWork) ||
                                  (emp.shifts[sun2.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sun2.toISOString().split('T')[0]]]?.isWork);
                  
                  if (w1Worked && w2Worked) {
                      list.push({
                          employeeId: emp.id,
                          date: sat2.toISOString().split('T')[0],
                          type: 'INVALID_ROTATION',
                          message: `${emp.name} (Maternité 100%): 2 week-ends consécutifs (Cible: 1/2)`,
                          severity: 'error',
                          priority: 'HIGH'
                      });
                  }
              }
          }

          // 80% Rule: Specific 4-stage pattern
          // - Wk A: Weekend
          // - Wk B: RH
          // - Wk C: Friday Night
          // - Wk D: RH
          if (emp.fte >= 0.75 && emp.fte < 0.9) {
              // This rule is usually validated over the whole cycle. 
              // For simplicity, we check if they worked a Friday Night but also a Weekend in the same week, etc.
              for (let w = 0; w < Math.ceil(days / 7); w++) {
                  const weekStart = new Date(analysisStart); weekStart.setDate(analysisStart.getDate() + (w * 7));
                  const fri = new Date(weekStart); fri.setDate(weekStart.getDate() + 4);
                  const sat = new Date(weekStart); sat.setDate(weekStart.getDate() + 5);
                  const sun = new Date(weekStart); sun.setDate(weekStart.getDate() + 6);

                  const workedFriNight = emp.shifts[fri.toISOString().split('T')[0]] === 'S';
                  const workedWeekend = (emp.shifts[sat.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sat.toISOString().split('T')[0]]]?.isWork) ||
                                       (emp.shifts[sun.toISOString().split('T')[0]] && SHIFT_TYPES[emp.shifts[sun.toISOString().split('T')[0]]]?.isWork);

                  if (workedFriNight && workedWeekend) {
                      list.push({
                          employeeId: emp.id,
                          date: fri.toISOString().split('T')[0],
                          type: 'FTE_MISMATCH',
                          message: `${emp.name} (Maternité 80%): Vendredi de nuit ET Week-end travaillés la même semaine (Interdit)`,
                          severity: 'error'
                      });
                  }
              }
          }
      }

      // E. DIALYSIS SPECIFIC FTE RULE
      if (isDialysisMode) {
          const analysisStart = new Date(startDate);
          const startDay = analysisStart.getDay();
          const diffToMon = startDay === 0 ? -6 : 1 - startDay; 
          analysisStart.setDate(analysisStart.getDate() + diffToMon);

          for (let w = 0; w < Math.ceil(days / 7); w++) {
              const weekStart = new Date(analysisStart); weekStart.setDate(analysisStart.getDate() + (w * 7));
              let daysWorkedCount = 0;
              for (let d = 0; d < 7; d++) {
                  const current = new Date(weekStart); current.setDate(weekStart.getDate() + d);
                  const shift = emp.shifts[current.toISOString().split('T')[0]];
                  if (shift && SHIFT_TYPES[shift]?.isWork && d < 6) daysWorkedCount++;
              }
              let violationMsg = null;
              if (emp.fte >= 0.8 && emp.fte < 0.9 && (daysWorkedCount < 2 || daysWorkedCount > 3)) {
                  violationMsg = `${emp.name} (80%): ${daysWorkedCount}j travaillés (Lun-Sam). Cible: 2 à 3.`;
              } else if (emp.fte >= 1.0 && (daysWorkedCount < 3 || daysWorkedCount > 4)) {
                  violationMsg = `${emp.name} (100%): ${daysWorkedCount}j travaillés (Lun-Sam). Cible: 3 à 4.`;
              }
              if (violationMsg) {
                  list.push({ employeeId: emp.id, date: weekStart.toISOString().split('T')[0], type: 'FTE_MISMATCH', message: violationMsg, severity: 'warning', priority: 'HIGH' });
              }
          }
      }
    });

    return list;
};
