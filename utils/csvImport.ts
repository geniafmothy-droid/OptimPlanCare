import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';

/**
 * Parses a CSV string and updates the employees' shifts.
 * Expected format:
 * Header: Nom;01/01/2024;02/01/2024...
 * Rows: Name;ShiftCode;ShiftCode...
 */
export const parseScheduleCSV = (csvText: string, existingEmployees: Employee[]): Employee[] => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return existingEmployees;

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const headers = firstLine.split(delimiter).map(h => h.trim());
  
  // Identify date columns
  const dateColumns: { index: number; date: string }[] = [];
  
  headers.forEach((header, index) => {
    // Regex for DD/MM/YYYY
    const ddmmyyyy = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/;
    const match = header.match(ddmmyyyy);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      // Create normalized YYYY-MM-DD string
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dateColumns.push({ index, date: dateStr });
    }
  });

  if (dateColumns.length === 0) {
    alert("Aucune colonne de date valide (JJ/MM/AAAA) trouvée dans l'en-tête du CSV.");
    return existingEmployees;
  }

  // Process rows
  const newEmployees = JSON.parse(JSON.stringify(existingEmployees)) as Employee[];
  let updatedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(c => c.trim());
    if (row.length === 0 || !row[0]) continue;
    
    const empName = row[0];
    
    // Find employee by name (case insensitive matching)
    const empIndex = newEmployees.findIndex(e => e.name.toLowerCase() === empName.toLowerCase());
    
    if (empIndex >= 0) {
      const emp = newEmployees[empIndex];
      let hasUpdates = false;
      
      dateColumns.forEach(col => {
        if (col.index < row.length) {
          const rawValue = row[col.index].toUpperCase();
          
          // Validate shift code against known types
          if (Object.keys(SHIFT_TYPES).includes(rawValue)) {
            emp.shifts[col.date] = rawValue as ShiftCode;
            hasUpdates = true;
          }
        }
      });
      
      if (hasUpdates) updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    alert(`${updatedCount} planning(s) collaborateur(s) mis à jour avec succès.`);
  } else {
    alert("Aucun collaborateur correspondant trouvé dans le fichier.");
  }

  return newEmployees;
};