
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

    const infirmiers = employees.filter(e => e.role === 'Infirmier');
    
    // 1. Check Daily Staffing Rules
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        // FORCE LOCAL DATE STRING
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayOfWeek = getDayOfWeek(d); // 0=Sun, 1=Mon...

        // Check if service is open
        // FIX: Safely check for openDays existence
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

        // Si ouvert, vérifications d'effectifs
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
            // If there is a code assigned next day AND it is defined as WORK
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

      // B. Weekly Rest (RH) - Simplified checking (per sliding 7 days)
      for (let i = 0; i <= days - 7; i++) {
          let rhCount = 0;
          let totalHours = 0;

          for (let j = 0; j < 7; j++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i + j);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              
              const code = emp.shifts[dateStr];
              // Count all forms of Rest or Absences as "Non-Work" days for the 2-day rest rule
              if (code && !SHIFT_TYPES[code]?.isWork && code !== 'OFF') {
                  rhCount++;
              }
              
              // Sum hours for 48h check
              totalHours += (SHIFT_HOURS[code] || 0);
          }

          const startWindow = new Date(startDate);
          startWindow.setDate(startWindow.getDate() + i);
          const dateLabel = `${startWindow.getFullYear()}-${String(startWindow.getMonth() + 1).padStart(2, '0')}-${String(startWindow.getDate()).padStart(2, '0')}`;

          if (rhCount < 2) {
              list.push({
                  employeeId: emp.id,
                  date: dateLabel,
                  type: 'CONSECUTIVE_DAYS',
                  message: `${emp.name}: Moins de 2 jours de repos/absence sur 7 jours glissants`,
                  severity: 'warning'
              });
          }

          // Rule: Max 48h on 7 sliding days
          if (emp.role === 'Infirmier' && totalHours > 48) {
             list.push({
                  employeeId: emp.id,
                  date: dateLabel,
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
               const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
               const currentCode = emp.shifts[dateStr];
               
               if (currentCode && SHIFT_TYPES[currentCode]?.isWork) {
                  // Check previous Saturday
                  const prevSat = new Date(d);
                  prevSat.setDate(d.getDate() - 7);
                  const prevSatStr = `${prevSat.getFullYear()}-${String(prevSat.getMonth() + 1).padStart(2, '0')}-${String(prevSat.getDate()).padStart(2, '0')}`;
                  const prevCode = emp.shifts[prevSatStr];

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

      // D. SPECIAL FTE RULE (Dialysis)
      // 80% FTE => 2 to 3 days worked (Mon-Sat)
      // 100% FTE => 3 to 4 days worked (Mon-Sat)
      // We iterate by chunks of weeks (Mon-Sun) within the visible range
      
      // Align to first Monday of the current range for analysis
      const analysisStart = new Date(startDate);
      const startDay = analysisStart.getDay();
      const diffToMon = startDay === 0 ? -6 : 1 - startDay; // Adjust to Monday
      analysisStart.setDate(analysisStart.getDate() + diffToMon);

      // Analyze for 4 weeks ahead from start
      for (let w = 0; w < Math.ceil(days / 7); w++) {
          const weekStart = new Date(analysisStart);
          weekStart.setDate(weekStart.getDate() + (w * 7));
          
          // Count worked days Mon-Sat (exclude Sun)
          let daysWorkedCount = 0;
          let hasSundayWork = false;

          for (let d = 0; d < 7; d++) {
              const current = new Date(weekStart);
              current.setDate(weekStart.getDate() + d);
              const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
              const shift = emp.shifts[dateStr];
              
              // Only count if within the visible range requested to avoid false positives at edges
              // (Optional: remove this check if we want strict enforcement even on partial views)
              
              if (shift && SHIFT_TYPES[shift]?.isWork) {
                  if (d < 6) { // Mon (0) to Sat (5) relative to weekStart (Mon)
                      daysWorkedCount++;
                  } else if (d === 6) {
                      hasSundayWork = true; // Sunday is separate
                  }
              }
          }

          // Rule Check
          // Only check if employee is "Infirmier" (target population)
          if (emp.role === 'Infirmier') {
              let violationMsg = null;
              
              if (emp.fte === 0.8) {
                  if (daysWorkedCount < 2 || daysWorkedCount > 3) {
                      violationMsg = `${emp.name} (80%): ${daysWorkedCount} jours travaillés (Lun-Sam). Cible: 2 à 3.`;
                  }
              } else if (emp.fte >= 1.0) {
                  if (daysWorkedCount < 3 || daysWorkedCount > 4) {
                      violationMsg = `${emp.name} (100%): ${daysWorkedCount} jours travaillés (Lun-Sam). Cible: 3 à 4.`;
                  }
              }

              if (violationMsg) {
                  const weekLabel = `${weekStart.toLocaleDateString()} - ${new Date(weekStart.getTime() + 6*24*3600*1000).toLocaleDateString()}`;
                  list.push({
                      employeeId: emp.id,
                      date: weekStart.toISOString().split('T')[0], // Mark start of week
                      type: 'FTE_MISMATCH',
                      message: `${violationMsg} [Semaine: ${weekLabel}]`,
                      severity: 'warning', // Warning because sometimes necessary for service continuity
                      priority: 'MEDIUM'
                  });
              }
          }
      }

    });

    // Filter by Active Rules logic could go here if we passed the full list of active rules to this function.
    // For now, we return all, and the UI can filter or we assume these are the hardcoded active rules.
    // The ServiceConfig param allows for extensibility.

    return list;
};
