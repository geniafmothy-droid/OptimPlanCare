
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES } from '../constants';

/**
 * Parses a CSV string and updates the employees' shifts and metadata.
 * If an employee does not exist, they are created.
 * Expected format:
 * Header: Nom;Prénom;Matricule;Fonction;Quotité;01/12/2024;02/12/2024...
 * Rows: CHEVALLET;D;24050;IDE;100;RH;S;...
 */
export const parseScheduleCSV = (csvText: string, existingEmployees: Employee[]): Employee[] => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return existingEmployees;

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const headers = firstLine.split(delimiter).map(h => h.trim());
  
  // We expect at least 5 metadata columns + dates
  // Metadata indices
  const IDX_NOM = 0;
  const IDX_PRENOM = 1;
  const IDX_MATRICULE = 2;
  const IDX_FONCTION = 3;
  const IDX_QUOTITE = 4;
  const IDX_DATE_START = 5;

  // Identify date columns starting from index 5
  const dateColumns: { index: number; date: string; isSunday: boolean }[] = [];
  
  headers.forEach((header, index) => {
    if (index < IDX_DATE_START) return;

    // Regex for DD/MM/YYYY or YYYY-MM-DD
    const ddmmyyyy = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/;
    const yyyymmdd = /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/;
    
    let match = header.match(ddmmyyyy);
    let dateObj: Date | null = null;
    let dateStr = '';

    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      dateObj = new Date(year, month - 1, day);
      dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
        match = header.match(yyyymmdd);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);
            dateObj = new Date(year, month - 1, day);
            dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    
    if (dateObj && dateStr) {
      dateColumns.push({ 
          index, 
          date: dateStr,
          isSunday: dateObj.getDay() === 0
      });
    }
  });

  if (dateColumns.length === 0) {
    alert("Aucune colonne de date valide trouvée (format attendu après les 5 premières colonnes : Nom;Prénom;Matricule;Fonction;Quotité;Date1...).");
    return existingEmployees;
  }

  // Process rows
  const newEmployees = [...existingEmployees]; // Clone array
  let updatedCount = 0;
  let createdCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(c => c.trim());
    if (row.length < IDX_DATE_START || !row[IDX_NOM]) continue;
    
    const nomRaw = row[IDX_NOM];
    const prenomRaw = row[IDX_PRENOM];
    const matriculeRaw = row[IDX_MATRICULE];
    const fonctionRaw = row[IDX_FONCTION]?.toUpperCase();
    const quotiteStr = row[IDX_QUOTITE];

    // Determine normalized values
    const fullName = prenomRaw 
        ? `${nomRaw.toUpperCase()} ${prenomRaw.charAt(0).toUpperCase()}${prenomRaw.slice(1).toLowerCase()}` 
        : nomRaw.toUpperCase();
    
    let role: Employee['role'] = 'Infirmier'; // Default
    if (fonctionRaw) {
        if (fonctionRaw === 'IDE' || fonctionRaw === 'INFIRMIER') role = 'Infirmier';
        else if (['AS', 'ASD', 'AIDE-SOIGNANT'].includes(fonctionRaw)) role = 'Aide-Soignant';
        else if (fonctionRaw === 'CADRE') role = 'Cadre';
        else if (fonctionRaw === 'MANAGER') role = 'Manager';
    }

    let fte = 1.0;
    if (quotiteStr) {
        const val = parseFloat(quotiteStr.replace(',', '.'));
        if (!isNaN(val)) {
            fte = val > 1 ? val / 100 : val;
        }
    }

    // Try to find existing employee
    const empIndex = newEmployees.findIndex(e => 
        (matriculeRaw && e.matricule === matriculeRaw) || 
        e.name.toLowerCase() === fullName.toLowerCase() ||
        e.name.toLowerCase().includes(nomRaw.toLowerCase())
    );
    
    let targetEmp: Employee;

    if (empIndex >= 0) {
      // UPDATE existing
      targetEmp = { ...newEmployees[empIndex] };
      // Update metadata
      targetEmp.name = fullName;
      if (matriculeRaw) targetEmp.matricule = matriculeRaw;
      targetEmp.role = role;
      targetEmp.fte = fte;
      
      updatedCount++;
      // Re-insert into array
      newEmployees[empIndex] = targetEmp;
    } else {
      // CREATE new
      targetEmp = {
          id: crypto.randomUUID(), // Generate temporary ID
          matricule: matriculeRaw || `TEMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          name: fullName,
          role: role,
          fte: fte,
          skills: [], // Default empty skills
          shifts: {}
      };
      newEmployees.push(targetEmp);
      createdCount++;
    }

    // Apply Shifts (Shared logic)
    dateColumns.forEach(col => {
        if (col.index < row.length) {
            const rawValue = row[col.index].toUpperCase();
            
            // Rule: Service Dialyse -> Sunday is ALWAYS RH
            if (col.isSunday) {
                targetEmp.shifts[col.date] = 'RH';
            } else {
                // Validate shift code
                if (Object.keys(SHIFT_TYPES).includes(rawValue)) {
                    targetEmp.shifts[col.date] = rawValue as ShiftCode;
                } else if (rawValue === '' || rawValue === '-') {
                    // Optional: delete targetEmp.shifts[col.date];
                }
            }
        }
    });
  }
  
  if (updatedCount > 0 || createdCount > 0) {
    alert(`Import terminé.\n- Mis à jour : ${updatedCount}\n- Créés : ${createdCount}`);
  } else {
    alert("Aucune donnée valide trouvée dans le CSV.");
  }

  return newEmployees;
};
