import { ShiftDefinition, Employee, ShiftCode } from './types';

// Parsing the colors and codes from the image and user rules
// Added startHour and endHour for Hourly View rendering
export const SHIFT_TYPES: Record<ShiftCode, ShiftDefinition> = {
  'IT': { 
    code: 'IT', 
    label: 'IT', 
    color: 'bg-blue-200', 
    textColor: 'text-blue-900', 
    description: '06h30-18h30 (Pause 30m, Total 11h30)', 
    isWork: true, 
    startHour: 6.5, 
    endHour: 18.5 
  },
  'T5': { 
    code: 'T5', 
    label: 'T5', 
    color: 'bg-orange-300', 
    textColor: 'text-orange-900', 
    description: '07h00-17h30 (Pause 30m, Total 10h00)', 
    isWork: true, 
    startHour: 7.0, 
    endHour: 17.5 
  },
  'T6': { 
    code: 'T6', 
    label: 'T6', 
    color: 'bg-orange-400', 
    textColor: 'text-orange-900', 
    description: '07h30-18h00 (Pause 30m, Total 10h00)', 
    isWork: true, 
    startHour: 7.5, 
    endHour: 18.0 
  },
  'S': { 
    code: 'S', 
    label: 'S', 
    color: 'bg-amber-200', 
    textColor: 'text-amber-900', 
    description: '17h30-00h00 (Pause 30m, Total 6h00)', 
    isWork: true, 
    startHour: 17.5, 
    endHour: 24.0 
  },
  'NT': { code: 'NT', label: 'NT', color: 'bg-slate-200', textColor: 'text-slate-600', description: 'Non Travaillé', isWork: false },
  'RC': { code: 'RC', label: 'RC', color: 'bg-gray-100', textColor: 'text-gray-500', description: 'Repos Cycle', isWork: false },
  'CA': { code: 'CA', label: 'CA', color: 'bg-blue-400', textColor: 'text-white', description: 'Congés Annuels', isWork: false },
  'RH': { code: 'RH', label: 'RH', color: 'bg-green-200', textColor: 'text-green-900', description: 'Repos Hebdo', isWork: false },
  'HS': { code: 'HS', label: 'HS', color: 'bg-teal-400', textColor: 'text-white', description: 'Hors Saison', isWork: false },
  'FO': { code: 'FO', label: 'FO', color: 'bg-gray-300', textColor: 'text-gray-800', description: 'Formation', isWork: true, startHour: 9.0, endHour: 17.0 },
  'ETP': { code: 'ETP', label: 'ETP', color: 'bg-yellow-100', textColor: 'text-yellow-800', description: 'Temps Partiel', isWork: false },
  'DP': { code: 'DP', label: 'DP', color: 'bg-pink-200', textColor: 'text-pink-900', description: 'Déplacement', isWork: true, startHour: 8.0, endHour: 16.0 },
  'M': { code: 'M', label: 'M', color: 'bg-sky-200', textColor: 'text-sky-900', description: 'Matin (Générique)', isWork: true, startHour: 7.0, endHour: 14.5 },
  'OFF': { code: 'OFF', label: '', color: 'bg-white', textColor: 'text-gray-300', description: 'Vide', isWork: false },
};

// Effective work hours mapping (Duration - 30min break)
export const SHIFT_HOURS: Record<string, number> = {
  'IT': 11.5, // 12h (06h30-18h30) - 30m = 11h30
  'T6': 10.0, // 10.5h (07h30-18h00) - 30m = 10h00
  'T5': 10.0, // 10.5h (07h00-17h30) - 30m = 10h00
  'S': 6.0,   // 6.5h (17h30-00h00) - 30m = 6h00
  'FO': 0,    // Non comptabilisé
  'NT': 0,
  'RH': 0,
  'CA': 0,
  'RC': 0,
  'HS': 0,
  'M': 7,     // Estimation pour Matin standard si utilisé
  'DP': 7,
  'ETP': 0,
  'OFF': 0
};

// Cycle de travail 7 lignes (Lundi -> Dimanche)
// Basé sur l'image fournie
export const NURSE_CYCLE_MATRIX: ShiftCode[][] = [
  // Lun, Mar, Mer, Jeu, Ven, Sam, Dim
  ['RC', 'IT', 'IT', 'RC', 'IT', 'RH', 'RH'], // Ligne 1
  ['S', 'RC', 'IT', 'T5', 'RH', 'IT', 'RH'],  // Ligne 2
  ['RC', 'IT', 'T5', 'RC', 'IT', 'RH', 'RH'], // Ligne 3
  ['RC', 'T5', 'S', 'RH', 'T5', 'T5', 'RH'],  // Ligne 4
  ['IT', 'RC', 'RC', 'IT', 'S', 'RH', 'RH'],  // Ligne 5
  ['T5', 'RC', 'IT', 'IT', 'RC', 'RH', 'RH'], // Ligne 6
  ['IT', 'IT', 'RC', 'RH', 'IT', 'IT', 'RH'], // Ligne 7
];

// Names extracted from OCR
const NAMES = [
  'Chevallet', 'Courtois', 'Damiens', 'Ducret', 'Duvernoy', 
  'Ester', 'Ferey', 'Gagnaire', 'Glomon', 'Keddous', 
  'Le Jeune', 'Lubin', 'Michaud', 'Miguet', 'Rey', 'Beaume'
];

// Initial structure without shifts
const BASE_EMPLOYEES: Employee[] = NAMES.map((name, index) => ({
  id: `emp-${index}`,
  matricule: `M${(index + 1).toString().padStart(3, '0')}`, // Génération d'un matricule
  name,
  role: index % 4 === 0 ? 'Cadre' : (index % 3 === 0 ? 'Aide-Soignant' : 'Infirmier'),
  fte: 1.0, // Default quotité 100%
  leaveBalance: 0,
  skills: index < 5 ? ['Senior', 'Tutorat'] : ['Junior'],
  shifts: {}
}));

export const MOCK_EMPLOYEES = BASE_EMPLOYEES;
