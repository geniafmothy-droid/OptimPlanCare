
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

export const StatsPanel: React.FC<StatsPanelProps> = ({ employees, startDate, days }) => {
  
  // Calculate distribution of shift types across the period
  const shiftDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      // Limit analysis to the visible period
      for(let i=0; i<days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const code = emp.shifts[dateStr];
          if (code && code !== 'OFF') {
              counts[code] = (counts[code] || 0) + 1;
          }
      }
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value);
  }, [employees, startDate, days]);

  // Calculate daily coverage
  const dailyCoverage = React.useMemo(() => {
    const data = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
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
        date: `${day}/${month}`,
        Présents: present,
      });
    }
    return data;
  }, [employees, startDate, days]);

  const totalEstimatedHours = React.useMemo(() => {
    return employees.reduce((total: number, emp) => {
      let empHours = 0;
      for(let i=0; i<days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const code = emp.shifts[dateStr];
          if (code) empHours += (SHIFT_HOURS[code] || 0);
      }
      return total + empHours;
    }, 0);
  }, [employees, startDate, days]);

  // Hours per person
  const personHours = React.useMemo(() => {
      return employees.map(emp => {
          let hours = 0;
          for(let i=0; i<days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const code = emp.shifts[dateStr];
            if (code) hours += (SHIFT_HOURS[code] || 0);
          }
          return { name: emp.name, hours, fte: emp.fte };
      }).sort((a,b) => b.hours - a.hours);
  }, [employees, startDate, days]);

  // Advanced Stats: Absenteeism & Interim
  const { absenteeismRate, interimRate } = React.useMemo(() => {
      let totalWorkableDays = 0;
      let absenceDays = 0;
      let interimDays = 0;
      let totalWorkedDays = 0;

      employees.forEach(emp => {
          for(let i=0; i<days; i++) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + i);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const code = emp.shifts[dateStr];
              
              if (code && code !== 'OFF') {
                  const isWork = SHIFT_TYPES[code]?.isWork;
                  const isAbsence = ['NT', 'Maladie'].includes(code); // Maladie pure
                  const isInterim = emp.role === 'Intérimaire'; // Or check if code is INT

                  if (isWork || isAbsence) totalWorkableDays++;
                  if (isAbsence) absenceDays++;
                  
                  if (isWork) {
                      totalWorkedDays++;
                      if (isInterim || code === 'INT') interimDays++;
                  }
              }
          }
      });

      return {
          absenteeismRate: totalWorkableDays > 0 ? (absenceDays / totalWorkableDays) * 100 : 0,
          interimRate: totalWorkedDays > 0 ? (interimDays / totalWorkedDays) * 100 : 0
      };
  }, [employees, startDate, days]);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-y-auto">
      
      {/* Distribution Chart */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Répartition des Postes (Période Affichée)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shiftDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                outerRadius={80}
                dataKey="value"
              >
                {shiftDistribution.map((entry, index) => {
                    // USE CONSTANT COLORS DIRECTLY
                    // Hack: Use hardcoded mapping based on typical tailwind values for visual consistency.
                    let color = '#94a3b8'; // default slate-400
                    if (entry.name === 'IT') color = '#60a5fa'; // blue-400
                    if (entry.name === 'T5') color = '#fdba74'; // orange-300
                    if (entry.name === 'T6') color = '#fb923c'; // orange-400
                    if (entry.name === 'S') color = '#fde68a'; // amber-200
                    if (entry.name === 'NT') color = '#e2e8f0'; // slate-200
                    if (entry.name === 'RH') color = '#bbf7d0'; // green-200
                    if (entry.name === 'CA') color = '#60a5fa'; // blue-400 (darker)
                    if (entry.name === 'RC') color = '#f1f5f9'; // gray-100
                    if (entry.name === 'INT') color = '#f43f5e'; // rose-500
                    
                    return <Cell key={`cell-${index}`} fill={color} stroke="#fff" />;
                })}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coverage Chart */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Couverture Journalière</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyCoverage}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
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
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Effectif Total</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{employees.length}</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800">
          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total Heures (Période)</div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">
            {totalEstimatedHours.toLocaleString()}h
          </div>
          <div className="text-xs text-orange-400 mt-1">Pauses déduites</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
          <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Postes de Nuit/Repos</div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">
             {(shiftDistribution.find(x => x.name === 'NT')?.value || 0) + (shiftDistribution.find(x => x.name === 'RC')?.value || 0)}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
           <div className="text-sm text-green-600 dark:text-green-400 font-medium">Taux Repos Total</div>
           <div className="text-2xl font-bold text-green-900 dark:text-green-200">
             {(() => {
               const total = shiftDistribution.reduce((a, b) => a + b.value, 0);
               const off = shiftDistribution.filter(x => ['CA', 'RH', 'NT', 'RC', 'OFF', 'HS'].includes(x.name)).reduce((a, b) => a + b.value, 0);
               return total ? Math.round((off / total) * 100) : 0;
             })()}%
           </div>
        </div>
      </div>

      {/* Advanced Stats */}
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Taux d'Absentéisme (Maladie)</h4>
              <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-slate-800 dark:text-white">{absenteeismRate.toFixed(1)}%</div>
                  <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${Math.min(absenteeismRate, 100)}%` }}></div>
                  </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Calculé sur les arrêts maladies (NT) vs jours ouvrés.</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Recours à l'Intérim</h4>
              <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-slate-800 dark:text-white">{interimRate.toFixed(1)}%</div>
                  <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${Math.min(interimRate, 100)}%` }}></div>
                  </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Pourcentage de jours travaillés par des intérimaires.</p>
          </div>
      </div>

       {/* Hours Per Person Table */}
       <div className="md:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Heures par collaborateur (Période)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 uppercase font-medium text-xs">
                      <tr>
                          <th className="p-3 rounded-tl-lg">Nom</th>
                          <th className="p-3">Quotité</th>
                          <th className="p-3 rounded-tr-lg text-right">Heures Planifiées</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {personHours.map(p => (
                          <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                              <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{p.name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.fte < 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {Math.round(p.fte * 100)}%
                                </span>
                              </td>
                              <td className="p-3 font-bold text-blue-600 dark:text-blue-400 text-right">{p.hours}h</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
       </div>

    </div>
  );
};
