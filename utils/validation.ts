import { Employee, ConstraintViolation } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';

export const checkConstraints = (employees: Employee[], startDate: Date, days: number): ConstraintViolation[] => {
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
                if (code && SHIFT_TYPES[code]?.isWork) {
                    list.push({
                        employeeId: emp.id,
                        date: dateStr,
                        type: 'INVALID_ROTATION',
                        message: `${emp.name} : Service fermé le dimanche (Travail interdit)`,
                        severity: 'error'
                    });
                } else if (code && code !== 'RH' && code !== 'CA' && code !== 'OFF' && code !== 'RC') {
                    // Added RC as acceptable for Sunday (as per nurse matrix)
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
            const nextCode = emp.shifts[nextDateStr];
            if (nextCode && nextCode !== 'NT' && nextCode !== 'RH' && nextCode !== 'RC' && nextCode !== 'CA') {
                list.push({
                    employeeId: emp.id,
                    date: nextDateStr,
                    type: 'INVALID_ROTATION',
                    message: `${emp.name}: Après un Soir (S), doit être en repos (NT/RH/RC)`,
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
              if (code === 'RH' || code === 'RC' || code === 'NT' || code === 'CA') rhCount++;
              
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
                  message: `${emp.name}: Moins de 2 jours de repos sur 7 jours`,
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
};