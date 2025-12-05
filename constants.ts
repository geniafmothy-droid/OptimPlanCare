
import { ShiftDefinition, Employee, ShiftCode } from './types';

// Updated with Duration and Break
export const SHIFT_TYPES: Record<ShiftCode, ShiftDefinition> = {
  'IT': { 
    code: 'IT', 
    label: 'IT', 
    color: 'bg-blue-200', 
    textColor: 'text-blue-900', 
    description: '06h30-18h30 (Journée)', 
    isWork: true, 
    startHour: 6.5, 
    endHour: 18.5,
    duration: 12,
    breakDuration: 0.5 
  },
  'T5': { 
    code: 'T5', 
    label: 'T5', 
    color: 'bg-orange-300', 
    textColor: 'text-orange-900', 
    description: '07h00-17h30', 
    isWork: true, 
    startHour: 7.0, 
    endHour: 17.5,
    duration: 10.5,
    breakDuration: 0.5 
  },
  'T6': { 
    code: 'T6', 
    label: 'T6', 
    color: 'bg-orange-400', 
    textColor: 'text-orange-900', 
    description: '07h30-18h00', 
    isWork: true, 
    startHour: 7.5, 
    endHour: 18.0,
    duration: 10.5,
    breakDuration: 0.5 
  },
  'S': { 
    code: 'S', 
    label: 'S', 
    color: 'bg-amber-200', 
    textColor: 'text-amber-900', 
    description: '17h30-00h00 (Soir)', 
    isWork: true, 
    startHour: 17.5, 
    endHour: 24.0,
    duration: 6.5,
    breakDuration: 0.5 
  },
  'NT': { code: 'NT', label: 'NT', color: 'bg-slate-200', textColor: 'text-slate-600', description: 'Non Travaillé (Cycle)', isWork: false, duration: 0 },
  'MAL': { code: 'MAL', label: 'MAL', color: 'bg-red-200', textColor: 'text-red-900', description: 'Arrêt Maladie', isWork: false, duration: 0 },
  'AT': { code: 'AT', label: 'AT', color: 'bg-red-300', textColor: 'text-red-900', description: 'Accident de Travail', isWork: false, duration: 0 },
  'ABS': { code: 'ABS', label: 'ABS', color: 'bg-red-600', textColor: 'text-white', description: 'Absence Injustifiée', isWork: false, duration: 0 },
  'RC': { code: 'RC', label: 'RC', color: 'bg-gray-100', textColor: 'text-gray-500', description: 'Repos Cycle', isWork: false, duration: 0 },
  'CA': { code: 'CA', label: 'CA', color: 'bg-blue-400', textColor: 'text-white', description: 'Congés Annuels', isWork: false, duration: 0 },
  'RH': { code: 'RH', label: 'RH', color: 'bg-green-200', textColor: 'text-green-900', description: 'Repos Hebdo', isWork: false, duration: 0 },
  'HS': { code: 'HS', label: 'HS', color: 'bg-teal-400', textColor: 'text-white', description: 'Hors Saison', isWork: false, duration: 0 },
  'FO': { code: 'FO', label: 'FO', color: 'bg-gray-300', textColor: 'text-gray-800', description: 'Formation', isWork: true, startHour: 9.0, endHour: 17.0, duration: 7, breakDuration: 1 },
  'ETP': { code: 'ETP', label: 'ETP', color: 'bg-yellow-100', textColor: 'text-yellow-800', description: 'Temps Partiel', isWork: false, duration: 0 },
  'DP': { code: 'DP', label: 'DP', color: 'bg-pink-200', textColor: 'text-pink-900', description: 'Déplacement', isWork: true, startHour: 8.0, endHour: 16.0, duration: 7, breakDuration: 1 },
  'M': { code: 'M', label: 'M', color: 'bg-sky-200', textColor: 'text-sky-900', description: 'Matin (Générique)', isWork: true, startHour: 7.0, endHour: 14.5, duration: 7.5, breakDuration: 0.5 },
  'F': { code: 'F', label: 'F', color: 'bg-fuchsia-200', textColor: 'text-fuchsia-900', description: 'Férié', isWork: false, duration: 0 },
  'RTT': { code: 'RTT', label: 'RTT', color: 'bg-emerald-200', textColor: 'text-emerald-900', description: 'RTT', isWork: false, duration: 0 },
  'INT': { code: 'INT', label: 'INT', color: 'bg-rose-200', textColor: 'text-rose-900', description: 'Intérim', isWork: true, startHour: 7.0, endHour: 19.0, duration: 12, breakDuration: 0.5 },
  'OFF': { code: 'OFF', label: '', color: 'bg-white', textColor: 'text-gray-300', description: 'Vide', isWork: false, duration: 0 },
};

// Effective work hours mapping (Duration - Break)
export const SHIFT_HOURS: Record<string, number> = {};
Object.values(SHIFT_TYPES).forEach(s => {
    SHIFT_HOURS[s.code] = Math.max(0, (s.duration || 0) - (s.breakDuration || 0));
});

// DIALYSIS TEAM GENERATION
// 16 IDEs: 7 @ 80%, 9 @ 100%
const NAMES_100 = [
  'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau'
];
const NAMES_80 = [
  'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David'
];

const generateDialysisTeam = (): Employee[] => {
    const emps: Employee[] = [];
    let idCounter = 100;

    // Director
    emps.push({
        id: 'dir-001', matricule: 'D001', name: 'Mme La Directrice', role: 'Directeur', fte: 1.0,
        leaveBalance: 0, leaveCounters: { CA:30, RTT:10, HS:0, RC:0 }, skills: ['Management'], shifts: {}
    });

    // Cadre
    emps.push({
        id: 'cad-001', matricule: 'C001', name: 'M. Le Cadre', role: 'Cadre', fte: 1.0,
        leaveBalance: 0, leaveCounters: { CA:28, RTT:14, HS:0, RC:0 }, skills: ['Management', 'Dialyse'], shifts: {}
    });

    // 100% IDEs
    NAMES_100.forEach((name, i) => {
        emps.push({
            id: `ide-100-${i}`,
            matricule: `IDE${idCounter++}`,
            name: `${name} (100%)`,
            role: 'Infirmier',
            fte: 1.0,
            leaveBalance: 0,
            leaveCounters: { CA: 25, RTT: 0, HS: 0, RC: 0 },
            skills: ['Dialyse', 'IT', 'T5', 'T6', 'S'],
            shifts: {}
        });
    });

    // 80% IDEs
    NAMES_80.forEach((name, i) => {
        emps.push({
            id: `ide-80-${i}`,
            matricule: `IDE${idCounter++}`,
            name: `${name} (80%)`,
            role: 'Infirmier',
            fte: 0.8,
            leaveBalance: 0,
            leaveCounters: { CA: 20, RTT: 0, HS: 0, RC: 0 }, // Adjusted CA roughly
            skills: ['Dialyse', 'IT', 'T5', 'T6', 'S'],
            shifts: {}
        });
    });

    return emps;
};

export const MOCK_EMPLOYEES = generateDialysisTeam();