
import { ShiftDefinition, Employee, ShiftCode } from './types';
import { generateMonthlySchedule } from './utils/scheduler';

// Parsing the colors and codes from the image and user rules
export const SHIFT_TYPES: Record<ShiftCode, ShiftDefinition> = {
  'IT': { code: 'IT', label: 'IT', color: 'bg-blue-200', textColor: 'text-blue-900', description: 'Jour (06h30-18h30) [11.5h]', isWork: true },
  'NT': { code: 'NT', label: 'NT', color: 'bg-slate-200', textColor: 'text-slate-600', description: 'Non Travaillé', isWork: false },
  'RC': { code: 'RC', label: 'RC', color: 'bg-gray-100', textColor: 'text-gray-500', description: 'Repos Cycle', isWork: false },
  'T5': { code: 'T5', label: 'T5', color: 'bg-orange-300', textColor: 'text-orange-900', description: 'Matin Long (07h00-17h30) [10h]', isWork: true },
  'T6': { code: 'T6', label: 'T6', color: 'bg-orange-400', textColor: 'text-orange-900', description: 'Journée (07h30-18h00) [10h]', isWork: true },
  'S': { code: 'S', label: 'S', color: 'bg-amber-200', textColor: 'text-amber-900', description: 'Soir (17h30-00h00) [6h]', isWork: true },
  'CA': { code: 'CA', label: 'CA', color: 'bg-blue-400', textColor: 'text-white', description: 'Congés Annuels', isWork: false },
  'RH': { code: 'RH', label: 'RH', color: 'bg-green-200', textColor: 'text-green-900', description: 'Repos Hebdo', isWork: false },
  'FO': { code: 'FO', label: 'FO', color: 'bg-gray-300', textColor: 'text-gray-800', description: 'Formation', isWork: true },
  'ETP': { code: 'ETP', label: 'ETP', color: 'bg-yellow-100', textColor: 'text-yellow-800', description: 'Temps Partiel', isWork: false },
  'DP': { code: 'DP', label: 'DP', color: 'bg-pink-200', textColor: 'text-pink-900', description: 'Déplacement', isWork: true },
  'M': { code: 'M', label: 'M', color: 'bg-sky-200', textColor: 'text-sky-900', description: 'Matin', isWork: true },
  'OFF': { code: 'OFF', label: '', color: 'bg-white', textColor: 'text-gray-300', description: 'Vide', isWork: false },
};

// Effective work hours mapping (Duration - 30min break)
export const SHIFT_HOURS: Record<string, number> = {
  'IT': 11.5, // 12h - 30m
  'T6': 10,   // 10.5h - 30m
  'T5': 10,   // 10.5h - 30m
  'S': 6,     // 6.5h - 30m
  'FO': 0,    // Non comptabilisé
  'NT': 0,
  'RH': 0,
  'CA': 0,
  'RC': 0,
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
  // Adjusted logic to ensure we have enough Infirmiers (at least 8 needed for the rotation)
  // Index 0: Cadre
  // Index 1,2: Infirmier
  // Index 3: AS
  role: index % 4 === 0 ? 'Cadre' : (index % 3 === 0 ? 'Aide-Soignant' : 'Infirmier'),
  fte: 1.0, // Default quotité 100%
  skills: index < 5 ? ['Senior', 'Tutorat'] : ['Junior'],
  shifts: {}
}));

// Apply generator for Dec 2024 and Jan 2025 to have populated initial data
let initializedEmployees = generateMonthlySchedule(BASE_EMPLOYEES, 2024, 11); // Dec 2024
initializedEmployees = generateMonthlySchedule(initializedEmployees, 2025, 0); // Jan 2025

export const MOCK_EMPLOYEES = initializedEmployees;
