import { supabase } from '../lib/supabase';
import { Employee, ShiftCode, Skill, Service, ServiceAssignment } from '../types';
import { MOCK_EMPLOYEES } from '../constants';

// --- Services Management ---
export const fetchServices = async (): Promise<Service[]> => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error fetching services:', JSON.stringify(error, null, 2));
        if (error.code === '42P01') return []; 
        throw new Error(error.message);
    }
    return data || [];
};

export const updateServiceConfig = async (id: string, config: any) => {
    const { error } = await supabase
        .from('services')
        .update({ config })
        .eq('id', id);
    
    if (error) {
        console.error('Error updating service config:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const createService = async (name: string, config: any = { openDays: [1,2,3,4,5,6] }) => {
    const { error } = await supabase
        .from('services')
        .insert([{ name, config }]);

    if (error) {
        console.error('Error creating service:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const deleteService = async (id: string) => {
    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting service:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const updateService = async (id: string, name: string) => {
    const { error } = await supabase
        .from('services')
        .update({ name })
        .eq('id', id);

    if (error) {
        console.error('Error updating service:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

// --- Service Assignments Management ---

export const fetchServiceAssignments = async (): Promise<ServiceAssignment[]> => {
    const { data, error } = await supabase
        .from('service_assignments')
        .select('*');
    
    if (error) {
        // Silent fail if table doesn't exist yet (migration)
        if (error.code === '42P01') return [];
        console.error('Error fetching assignments:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
    
    return data?.map((d: any) => ({
        id: d.id,
        employeeId: d.employee_id,
        serviceId: d.service_id,
        startDate: d.start_date,
        endDate: d.end_date
    })) || [];
};

export const createServiceAssignment = async (employeeId: string, serviceId: string, startDate: string, endDate?: string) => {
    const { error } = await supabase
        .from('service_assignments')
        .insert([{ 
            employee_id: employeeId, 
            service_id: serviceId, 
            start_date: startDate, 
            end_date: endDate || null 
        }]);

    if (error) {
        console.error('Error creating assignment:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const deleteServiceAssignment = async (id: string) => {
    const { error } = await supabase
        .from('service_assignments')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting assignment:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};


// --- Skills Management ---

export const fetchSkills = async (): Promise<Skill[]> => {
    const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('code');
    
    if (error) {
        console.error('Error fetching skills:', JSON.stringify(error, null, 2));
        if (error.code === '42P01') return []; 
        throw new Error(error.message);
    }
    return data || [];
};

export const createSkill = async (code: string, label: string) => {
    const { error } = await supabase
        .from('skills')
        .insert([{ code, label }]);
    
    if (error) {
        console.error('Error creating skill:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const deleteSkill = async (id: string) => {
    const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting skill:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

// --- Employees Management ---

export const fetchEmployeesWithShifts = async (): Promise<Employee[]> => {
  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select(`
      id,
      matricule,
      name,
      role,
      fte,
      leave_balance,
      leave_data,
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
      leaveBalance: emp.leave_balance || 0,
      leaveData: emp.leave_data,
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

export const saveLeaveRange = async (employeeId: string, startDate: string, endDate: string, type: ShiftCode) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shiftsToInsert = [];

    // Iterate through dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const isSunday = d.getDay() === 0;
        const codeToApply = isSunday ? 'RH' : type;

        shiftsToInsert.push({
            employee_id: employeeId,
            date: dateStr,
            shift_code: codeToApply
        });
    }

    if (shiftsToInsert.length > 0) {
        const { error } = await supabase
            .from('shifts')
            .upsert(shiftsToInsert, { onConflict: 'employee_id,date' });
        
        if (error) {
             console.error('Error saving leave range:', JSON.stringify(error, null, 2));
             throw new Error(error.message);
        }
    }
};

export const deleteLeaveRange = async (employeeId: string, startDate: string, endDate: string) => {
    const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (error) {
        console.error('Error deleting leave range:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const updateEmployeeBalance = async (employeeId: string, newBalance: number) => {
    const { error } = await supabase
        .from('employees')
        .update({ leave_balance: newBalance })
        .eq('id', employeeId);
    
    if (error) {
        console.error('Error updating balance:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const updateEmployeeLeaveData = async (employeeId: string, leaveData: any) => {
    const { error } = await supabase
        .from('employees')
        .update({ leave_data: leaveData })
        .eq('id', employeeId);

    if (error) {
        console.error('Error updating leave data:', JSON.stringify(error, null, 2));
        throw new Error(error.message);
    }
};

export const upsertEmployee = async (employee: Employee) => {
  const payload: any = {
      matricule: employee.matricule,
      name: employee.name,
      role: employee.role,
      fte: employee.fte,
      leave_balance: employee.leaveBalance,
      leave_data: employee.leaveData,
      skills: employee.skills
  };

  let conflictTarget = 'matricule';

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
    const { data, error } = await supabase
      .from('employees')
      .upsert({
        matricule: emp.matricule,
        name: emp.name,
        role: emp.role,
        fte: emp.fte,
        leave_balance: 25, // Default initial balance
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
    if (emp.id.length < 10) continue; 

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

export const bulkUpsertShifts = async (shifts: {employee_id: string, date: string, shift_code: string}[]) => {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < shifts.length; i += BATCH_SIZE) {
        const batch = shifts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('shifts')
            .upsert(batch, { onConflict: 'employee_id,date' });
        
        if (error) {
            console.error('Error bulk upserting shifts:', JSON.stringify(error, null, 2));
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
                 leave_balance: emp.leaveBalance,
                 leave_data: emp.leaveData,
                 skills: emp.skills
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
