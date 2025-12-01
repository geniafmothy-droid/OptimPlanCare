import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Employee, ShiftCode } from '../types';
import { SHIFT_TYPES, SHIFT_HOURS } from '../constants';

interface StatsPanelProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

// Updated vivid color palette for better distinction
const COLORS = [
    '#3B82F6', // Blue-500 (IT/Standard)
    '#F59E0B', // Amber-500 (Soir)
    '#10B981', // Emerald-500 (Matin/T5)
    '#8B5CF6', // Violet-500 (T6)
    '#EF4444', // Red-500 (Absence/Alert)
    '#6366F1', // Indigo-500
    '#EC4899', // Pink-500
    '#64748B'  // Slate-500 (Other)
];

export const StatsPanel: React.FC<StatsPanelProps> = ({ employees, startDate, days }) => {
  
  // Calculate distribution of shift types across the period
  const shiftDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      Object.values(emp.shifts).forEach((code) => {
        if (code !== 'OFF') {
          // Cast code to string to fix TS error "Type 'unknown' cannot be used as an index type"
          const key = code as string;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value);
  }, [employees]);

  // Calculate daily coverage (Modified: Removed Senior logic)
  const dailyCoverage = React.useMemo(() => {
    const data = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      // Force local string format to match keys
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      let present = 0;
      
      employees.forEach(emp => {
        const code = emp.shifts[dateStr];
        if (code && SHIFT_TYPES[code]?.isWork) {
          present++;
        }
      });

      data.push({
        date: `${day}/${month}`, // Short date for XAxis
        Présents: present,
      });
    }
    return data;
  }, [employees, startDate, days]);

  const totalEstimatedHours = React.useMemo(() => {
    return employees.reduce((total: number, emp) => {
      const empHours = (Object.values(emp.shifts) as string[]).reduce((acc: number, code: string) => {
        return acc + (SHIFT_HOURS[code] || 0);
      }, 0);
      return total + empHours;
    }, 0);
  }, [employees]);

  // Hours per person
  const personHours = React.useMemo(() => {
      return employees.map(emp => {
          const hours = (Object.values(emp.shifts) as string[]).reduce((acc: number, code: string) => {
             return acc + (SHIFT_HOURS[code] || 0);
          }, 0);
          return { name: emp.name, hours, fte: emp.fte };
      }).sort((a,b) => b.hours - a.hours);
  }, [employees]);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-y-auto">
      
      {/* Distribution Chart */}
      <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Répartition des Postes</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shiftDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {shiftDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SHIFT_TYPES[entry.name as ShiftCode]?.color.replace('bg-', 'var(--tw-bg-opacity, 1) ') || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coverage Chart */}
      <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Couverture Journalière</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyCoverage}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Legend />
              {/* Removed Senior Bar */}
              <Bar 
                dataKey="Présents" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                name="Effectif Présent"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-sm text-blue-600 font-medium">Effectif Total</div>
          <div className="text-2xl font-bold text-blue-900">{employees.length}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border-orange-100">
          <div className="text-sm text-orange-600 font-medium">Total Heures Travaillées</div>
          <div className="text-2xl font-bold text-orange-900">
            {totalEstimatedHours.toLocaleString()}h
          </div>
          <div className="text-xs text-orange-400 mt-1">Pauses déduites</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border-purple-100">
          <div className="text-sm text-purple-600 font-medium">Postes de Nuit/Repos</div>
          <div className="text-2xl font-bold text-purple-900">
             {(shiftDistribution.find(x => x.name === 'NT')?.value || 0) + (shiftDistribution.find(x => x.name === 'RC')?.value || 0)}
          </div>
          <div className="text-xs text-purple-400 mt-1">NT + RC</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border-green-100">
           <div className="text-sm text-green-600 font-medium">Taux Repos Total</div>
           <div className="text-2xl font-bold text-green-900">
             {(() => {
               const total = shiftDistribution.reduce((a, b) => a + b.value, 0);
               const off = shiftDistribution.filter(x => ['CA', 'RH', 'NT', 'RC', 'OFF', 'HS'].includes(x.name)).reduce((a, b) => a + b.value, 0);
               return total ? Math.round((off / total) * 100) : 0;
             })()}%
           </div>
        </div>
      </div>

       {/* Hours Per Person Table */}
       <div className="md:col-span-2 bg-white p-4 rounded-lg shadow border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Heures par collaborateur</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs">
                      <tr>
                          <th className="p-3 rounded-tl-lg">Nom</th>
                          <th className="p-3">Quotité</th>
                          <th className="p-3 rounded-tr-lg text-right">Heures Planifiées</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {personHours.map(p => (
                          <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-medium text-slate-700">{p.name}</td>
                              <td className="p-3 text-slate-500">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.fte < 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {Math.round(p.fte * 100)}%
                                </span>
                              </td>
                              <td className="p-3 font-bold text-blue-600 text-right">{p.hours}h</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
       </div>

    </div>
  );
};