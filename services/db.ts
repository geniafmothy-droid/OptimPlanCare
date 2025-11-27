
import { supabase } from '../lib/supabase';
import { Employee, ShiftCode } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

// --- Types mapping to DB ---

export const fetchEmployeesWithShifts = async (): Promise<Employee[]> => {
  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select(`
      id,
      matricule,
      name,
      role,
      fte,
      skills,
      shifts (
        date,
        shift_code
      )
    `)
    .order('name');

  if (empError) {
    console.error('Error fetching employees:', JSON.stringify(empError, null, 2));
    throw new Error(empError.message);
  }

  if (!employeesData) return [];

  // Transform DB structure to App structure
  return employeesData.map((emp: any) => {
    const shiftsRecord: Record<string, ShiftCode> = {};
    if (emp.shifts && Array.isArray(emp.shifts)) {
      emp.shifts.forEach((s: any) => {
        shiftsRecord[s.date] = s.shift_code as ShiftCode;
      });
    }

    return {
      id: emp.id,
      matricule: emp.matricule,
      name: emp.name,
      role: emp.role,
      fte: emp.fte,
      skills: emp.skills || [],
      shifts: shiftsRecord
    };
  });
};

export const upsertShift = async (employeeId: string, date: string, shiftCode: ShiftCode) => {
  if (shiftCode === 'OFF') {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .match({ employee_id: employeeId, date: date });
    
    if (error) {
        console.error('Error deleting shift:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
  } else {
    const { error } = await supabase
      .from('shifts')
      .upsert(
        { employee_id: employeeId, date: date, shift_code: shiftCode },
        { onConflict: 'employee_id,date' }
      );
    
    if (error) {
        console.error('Error upserting shift:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
  }
};

export const upsertEmployee = async (employee: Employee) => {
  const payload: any = {
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role,
      fte: employee.fte,
      skills: employee.skills
  };

  let conflictTarget = 'matricule';

  // Only send ID and use it for conflict resolution if it looks like a valid UUID 
  // (length check > 10 distinguishes from mock 'emp-0' or similar if legacy data exists)
  if (employee.id && employee.id.length > 10) {
      payload.id = employee.id;
      conflictTarget = 'id';
  }

  const { error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: conflictTarget })
    .select();

  if (error) {
      console.error('Error upserting employee:', JSON.stringify(error, null, 2));
      throw new Error(error.message);
  }
};

export const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase
        .from('employees')
        .delete()
        .match({ id: employeeId });
    
    if (error) {
        console.error('Error deleting employee:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
}

export const seedDatabase = async () => {
  console.log("Seeding database...");
  
  // 1. Insert Employees
  for (const emp of MOCK_EMPLOYEES) {
    // Insert employee and get ID
    const { data, error } = await supabase
      .from('employees')
      .upsert({
        matricule: emp.matricule,
        name: emp.name,
        role: emp.role,
        fte: emp.fte,
        skills: emp.skills
      }, { onConflict: 'matricule' })
      .select()
      .single();

    if (error) {
      console.error("Error seeding employee", emp.name, JSON.stringify(error, null, 2));
      continue;
    }

    const newId = data.id;

    // 2. Insert Shifts
    const shiftsToInsert = Object.entries(emp.shifts).map(([date, code]) => ({
      employee_id: newId,
      date: date,
      shift_code: code
    }));

    // Batch insert shifts
    if (shiftsToInsert.length > 0) {
      const { error: shiftError } = await supabase
        .from('shifts')
        .upsert(shiftsToInsert, { onConflict: 'employee_id,date' });
      
      if (shiftError) console.error("Error seeding shifts for", emp.name, JSON.stringify(shiftError, null, 2));
    }
  }
};

export const bulkSaveSchedule = async (employees: Employee[]) => {
  const allShifts: any[] = [];

  for (const emp of employees) {
    // We strictly need a real DB ID to save shifts. 
    // If the employee only exists locally/mock, we can't save shifts easily without upserting employee first.
    // Assuming employees passed here have valid IDs.
    if (emp.id.length < 10) continue; // Skip mock IDs

    Object.entries(emp.shifts).forEach(([date, code]) => {
      if (code !== 'OFF') {
        allShifts.push({
          employee_id: emp.id,
          date: date,
          shift_code: code
        });
      }
    });
  }

  // Upsert in batches of 1000
  const BATCH_SIZE = 1000;
  for (let i = 0; i < allShifts.length; i += BATCH_SIZE) {
    const batch = allShifts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('shifts')
      .upsert(batch, { onConflict: 'employee_id,date' });
    
    if (error) {
        console.error('Error bulk saving schedule:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
  }
};

export const clearShiftsInRange = async (year: number, month: number) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { error } = await supabase
        .from('shifts')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr);
    
    if (error) {
        console.error('Error clearing shifts:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const bulkImportEmployees = async (employees: Employee[]) => {
    for (const emp of employees) {
        const { data: dbEmp, error } = await supabase
             .from('employees')
             .upsert({
                 matricule: emp.matricule,
                 name: emp.name,
                 role: emp.role,
                 fte: emp.fte,
                 skills: emp.skills // Persist skills if present
             }, { onConflict: 'matricule' })
             .select()
             .single();
        
        if (error) {
            console.error("Error importing employee", emp.name, JSON.stringify(error, null, 2));
            continue;
        }

        const empId = dbEmp.id;

        const shifts = Object.entries(emp.shifts).map(([date, code]) => ({
             employee_id: empId,
             date,
             shift_code: code
        }));

        if (shifts.length > 0) {
            const { error: sError } = await supabase
                .from('shifts')
                .upsert(shifts, { onConflict: 'employee_id,date' });
            
            if (sError) console.error("Error importing shifts for", emp.name, JSON.stringify(sError, null, 2));
        }
    }
}
