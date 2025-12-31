
import { Employee, ShiftCode, ServiceConfig, WorkPreference } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';
import { fetchWorkPreferences } from '../services/db';

const toLocalISOString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getWeekNumber = (d: Date): number => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const getHoursLast7Days = (emp: Employee, currentDate: Date, tempShifts: Record<string, ShiftCode>): number => {
    let total = 0;
    for (let k = 0; k < 7; k++) {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - k);
        const dStr = toLocalISOString(d);
        const code = tempShifts[dStr] || emp.shifts[dStr];
        if (code && SHIFT_HOURS[code]) {
            total += SHIFT_HOURS[code];
        }
    }
    return total;
};

export const getEffectiveTargets = (date: Date, config?: ServiceConfig): Record<string, number> => {
    const targets: Record<string, number> = {};
    if (!config) return targets;

    const dayOfWeek = date.getDay();
    const weekNum = getWeekNumber(date);
    const isOddWeek = weekNum % 2 !== 0;

    if (config.skillRequirements) {
        config.skillRequirements.forEach(req => {
            if (req.minStaff > 0) targets[req.skillCode] = req.minStaff;
        });
    }

    // RÈGLE MATERNITÉ : Parité CPF Mercredi et Vendredi
    if (config.fteConstraintMode === 'MATERNITY_STANDARD') {
        if (dayOfWeek === 3 || dayOfWeek === 5) {
            const parityTarget = isOddWeek ? 2 : 1;
            targets['CPF M'] = parityTarget;
            targets['CPF C'] = parityTarget;
        }
    }

    if (config.shiftTargets?.[dayOfWeek]) {
        Object.entries(config.shiftTargets[dayOfWeek]).forEach(([code, val]) => {
            if (val !== undefined) targets[code] = val as number;
        });
    }

    return targets;
};

export const generateMonthlySchedule = async (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Promise<Employee[]> => {
  const employees = currentEmployees.map(emp => ({ ...emp, shifts: { ...emp.shifts } }));
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const numDays = endDate.getDate();

  const isMaternite = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';

  // PHASE 1: PRÉ-AFFECTATION DES REPOS ET CYCLES FIXES
  for (let day = 1; day <= numDays; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = toLocalISOString(currentDate);
    const dayOfWeek = currentDate.getDay();

    employees.forEach(emp => {
      // 1. Priorité aux absences existantes (Congés, Maladie)
      if (emp.shifts[dateStr] && ['CA', 'MAL', 'RTT'].includes(emp.shifts[dateStr])) return;

      // 2. Règle Maternité 100% : 1 week-end sur 2
      if (isMaternite && emp.fte >= 1.0 && (dayOfWeek === 6 || dayOfWeek === 0)) {
        const weekNum = getWeekNumber(currentDate);
        if (weekNum % 2 === 0) emp.shifts[dateStr] = 'RH'; 
      }

      // 3. Règle Maternité 80% : Cycle spécifique
      if (isMaternite && emp.fte >= 0.75 && emp.fte < 0.9) {
        const weekNum = getWeekNumber(currentDate);
        const cyclePos = weekNum % 2; // Alternance sur 2 semaines
        
        if (cyclePos === 0) { // Semaine A : WE Travaillé, Vendredi Repos
           if (dayOfWeek === 5) emp.shifts[dateStr] = 'RH';
        } else { // Semaine B : WE Repos, Vendredi Nuit (S)
           if (dayOfWeek === 6 || dayOfWeek === 0) emp.shifts[dateStr] = 'RH';
           if (dayOfWeek === 5) emp.shifts[dateStr] = 'S';
        }
      }

      // Dimanche fermé par défaut si non spécifié
      if (dayOfWeek === 0 && !serviceConfig?.openDays?.includes(0) && !emp.shifts[dateStr]) {
        emp.shifts[dateStr] = 'RH';
      }
    });
  }

  // PHASE 2: REMPLISSAGE DES POSTES SELON OBJECTIFS
  for (let day = 1; day <= numDays; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = toLocalISOString(currentDate);
    const targets = getEffectiveTargets(currentDate, serviceConfig);

    Object.entries(targets).forEach(([code, needed]) => {
      let currentAssigned = employees.filter(e => e.shifts[dateStr] === code).length;
      
      if (currentAssigned < needed) {
        const candidates = employees
          .filter(e => {
            if (e.shifts[dateStr]) return false; // Déjà pris
            if (!e.skills.includes(code) && code !== 'IT') return false; // Pas compétent
            
            // Check repos post-nuit
            const yesterday = new Date(currentDate); yesterday.setDate(yesterday.getDate() - 1);
            if (e.shifts[toLocalISOString(yesterday)] === 'S') return false;

            // Check 48h
            if ((getHoursLast7Days(e, currentDate, e.shifts) + (SHIFT_HOURS[code] || 7.5)) > 48) return false;

            return true;
          })
          .sort((a, b) => {
            // Priorité à ceux qui ont le moins d'heures sur le mois pour l'équité
            const getMonthHours = (emp: Employee) => Object.values(emp.shifts).reduce((acc, c) => acc + (SHIFT_HOURS[c] || 0), 0);
            return getMonthHours(a) - getMonthHours(b);
          });

        for (let i = 0; i < (needed - currentAssigned) && i < candidates.length; i++) {
          candidates[i].shifts[dateStr] = code as ShiftCode;
        }
      }
    });
  }

  // Remplissage final des jours vides par du repos/non travaillé
  employees.forEach(e => {
    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, month, day);
      const ds = toLocalISOString(d);
      if (!e.shifts[ds]) e.shifts[ds] = (d.getDay() === 0 || d.getDay() === 6) ? 'RH' : 'NT';
    }
  });

  return employees;
};
