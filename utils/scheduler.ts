import { Employee, ShiftCode, ServiceConfig } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS, NURSE_CYCLE_MATRIX } from '../constants';
import { checkConstraints } from './validation';

// Helper to shuffle array for random distribution of shifts
const shuffle = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Helper to get ISO week number to determine cycle rotation
const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const generateMonthlySchedule = (
  currentEmployees: Employee[],
  year: number,
  month: number,
  serviceConfig?: ServiceConfig
): Employee[] => {
  // Clone employees to avoid direct mutation issues during calculation
  const employees = JSON.parse(JSON.stringify(currentEmployees)) as Employee[];
  
  // Clear shifts for the target month but KEEP existing CA/FO/NT (Preserve manual inputs)
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month
  
  // Separate by roles
  const infirmiers = employees.filter(e => e.role === 'Infirmier');
  const aidesSoignants = employees.filter(e => e.role === 'Aide-Soignant');
  const cadresAndManagers = employees.filter(e => e.role === 'Cadre' || e.role === 'Manager');

  // --- INFIRMIERS LOGIC (MATRIX CYCLE) ---
  // Apply the 7-week cycle based on the matrix
  infirmiers.forEach((emp, index) => {
    // Determine offset for this employee so they fall on different lines
    const cycleOffset = index % 7;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        // Force local string format YYYY-MM-DD
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        // Preserve existing manual inputs (Congés, Maladie, Formation)
        const currentCode = emp.shifts[dateStr];
        if (currentCode === 'CA' || currentCode === 'FO' || currentCode === 'NT' || currentCode === 'RH') {
            continue;
        }

        const jsDay = d.getDay(); 
        const matrixDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert Sun(0)->6, Mon(1)->0

        // Determine Week Number to rotate lines
        const weekNum = getWeekNumber(d);
        
        // Calculate which row of the matrix to use
        const matrixRowIndex = (weekNum + cycleOffset) % 7;

        // Assign Code
        emp.shifts[dateStr] = NURSE_CYCLE_MATRIX[matrixRowIndex][matrixDayIndex];
    }
  });


  // --- AIDE-SOIGNANTS & CADRES/MANAGERS (SMART RANDOM) ---
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
    
    // SERVICE OPENING RULE
    // Use config if available, otherwise default to closed on Sunday (backward compat)
    const isOpen = serviceConfig ? serviceConfig.openDays.includes(dayOfWeek) : dayOfWeek !== 0;

    if (!isOpen) {
      [...aidesSoignants, ...cadresAndManagers].forEach(emp => {
        if (!['CA', 'FO', 'NT'].includes(emp.shifts[dateStr])) {
            emp.shifts[dateStr] = 'RH';
        }
      });
      continue;
    }

    // --- AIDE-SOIGNANTS ---
    // Try to assign shifts while respecting constraints (48h, etc.)
    let availableAS = shuffle(aidesSoignants);
    const asWorkCount = Math.min(2, availableAS.length); // Need ~2 AS per day
    let assignedCount = 0;

    for(let i=0; i<availableAS.length; i++) {
        const emp = availableAS[i];
        
        if (['CA', 'FO', 'NT', 'RH'].includes(emp.shifts[dateStr])) continue;

        // Check if employee needs rest due to previous 'S' shift
        // Get yesterday
        const prevD = new Date(d);
        prevD.setDate(d.getDate() - 1);
        const prevStr = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
        if (emp.shifts[prevStr] === 'S') {
            emp.shifts[dateStr] = 'NT';
            continue;
        }

        // Try to assign Work if needed
        if (assignedCount < asWorkCount) {
             const candidateShift = Math.random() > 0.5 ? 'IT' : 'M';
             emp.shifts[dateStr] = candidateShift;
             
             // Check constraints validation locally for this employee
             // We check a window around today to see if this shift causes a violation (like 48h limit)
             const violations = checkConstraints([emp], d, 1, serviceConfig); // Check just this day/window
             const hasError = violations.some(v => v.severity === 'error');

             if (hasError) {
                 // Revert to NT if violation
                 emp.shifts[dateStr] = 'NT';
             } else {
                 assignedCount++;
             }
        } else {
             emp.shifts[dateStr] = 'NT';
        }
    }

    // --- CADRES & MANAGERS ---
    cadresAndManagers.forEach(c => {
        if (['CA', 'FO', 'NT'].includes(c.shifts[dateStr])) return;

        // Standard Mon-Fri work week if service is open
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            c.shifts[dateStr] = 'IT';
        } else {
            c.shifts[dateStr] = 'RH';
        }
    });
  }
  
  return employees;
};