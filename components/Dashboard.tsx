import React, { useMemo, useState } from 'react';
import { Employee, ConstraintViolation, ServiceConfig } from '../types';
import { checkConstraints } from '../utils/validation';
import { Users, AlertTriangle, CheckCircle2, TrendingUp, AlertOctagon, ShieldAlert, Calendar, CalendarDays, LayoutList } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  employees: Employee[];
  currentDate: Date; // Reference date for calculation
  serviceConfig?: ServiceConfig;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ employees, currentDate, serviceConfig }) => {
  const [filter, setFilter] = useState<'month' | 'week' | 'day'>('month');

  // 1. Calculate effective Date Range based on local filter
  const { startDate, days, label } = useMemo(() => {
    const d = new Date(currentDate);
    
    if (filter === 'day') {
        const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        return { startDate: d, days: 1, label: dateStr };
    }
    
    if (filter === 'week') {
        // Calculate Monday
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        
        const endOfWeek = new Date(monday);
        endOfWeek.setDate(monday.getDate() + 6);
        
        const labelStr = `Semaine du ${monday.getDate()} au ${endOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
        return { startDate: monday, days: 7, label: labelStr };
    }

    // Month (Default)
    const startMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const labelStr = startMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    return { startDate: startMonth, days: daysInMonth, label: labelStr };
  }, [currentDate, filter]);
  
  // 2. Compute Violations on the calculated range
  const violations = useMemo(() => {
    return checkConstraints(employees, startDate, days, serviceConfig);
  }, [employees, startDate, days, serviceConfig]);

  // 3. Key Indicators
  const stats = useMemo(() => {
    const staffingIssues = violations.filter(v => v.employeeId === 'ALL').length;
    const ruleBreaks = violations.filter(v => v.employeeId !== 'ALL').length;
    const criticalErrors = violations.filter(v => v.severity === 'error').length;
    
    // Role Distribution (Global)
    const roles: Record<string, number> = {};
    employees.forEach(e => {
      roles[e.role] = (roles[e.role] || 0) + 1;
    });
    const roleData = Object.keys(roles).map(key => ({ name: key, value: roles[key] }));

    // Coverage Rate
    const daysWithIssues = new Set(violations.filter(v => v.employeeId === 'ALL').map(v => v.date)).size;
    const coverageRate = days > 0 ? Math.round(((days - daysWithIssues) / days) * 100) : 0;

    return { staffingIssues, ruleBreaks, criticalErrors, roleData, coverageRate };
  }, [employees, violations, days]);

  // 4. Top Recurring Violations
  const topViolations = useMemo(() => {
      const counts: Record<string, number> = {};
      violations.forEach(v => {
          let key = v.message;
          if (v.employeeId !== 'ALL' && key.includes(':')) {
              key = key.split(':')[1].trim();
          }
          counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
  }, [violations]);

  // Helper to find name from ID
  const getEmpName = (id: string) => {
      if (id === 'ALL') return 'Service Global';
      const emp = employees.find(e => e.id === id);
      return emp ? emp.name : `Employé #${id.substring(0, 6)}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                    Carnet de Bord
                </h2>
                <p className="text-slate-500">Analyse de la conformité : <span className="font-semibold text-slate-700 capitalize">{label}</span></p>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button 
                    onClick={() => setFilter('month')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${filter === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Calendar className="w-4 h-4" /> Mois
                </button>
                <button 
                    onClick={() => setFilter('week')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${filter === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <CalendarDays className="w-4 h-4" /> Semaine
                </button>
                <button 
                    onClick={() => setFilter('day')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${filter === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutList className="w-4 h-4" /> Jour
                </button>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Users className="w-8 h-8" />
                </div>
                <div>
                    <div className="text-sm text-slate-500 font-medium uppercase">Effectif Total</div>
                    <div className="text-3xl font-bold text-slate-800">{employees.length}</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stats.staffingIssues > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <AlertOctagon className="w-8 h-8" />
                </div>
                <div>
                    <div className="text-sm text-slate-500 font-medium uppercase">Jours Sous-effectif</div>
                    <div className={`text-3xl font-bold ${stats.staffingIssues > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {stats.staffingIssues}
                    </div>
                    <div className="text-xs text-slate-400">sur {days} jours analysés</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stats.ruleBreaks > 5 ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                    <div className="text-sm text-slate-500 font-medium uppercase">Alertes Règles</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.ruleBreaks}</div>
                    <div className="text-xs text-slate-400">Violations individuelles</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                    <div className="text-sm text-slate-500 font-medium uppercase">Taux Conformité</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.coverageRate}%</div>
                    <div className="text-xs text-slate-400">Jours sans incident</div>
                </div>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Violations Récurrentes */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Violations les plus fréquentes
                </h3>
                {topViolations.length > 0 ? (
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topViolations} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={220} tick={{fontSize: 11}} />
                                <RechartsTooltip />
                                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-slate-400 italic">
                        Aucune violation détectée sur cette période.
                    </div>
                )}
            </div>

            {/* Répartition Effectif */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">Répartition de l'effectif</h3>
                <div className="h-64 flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.roleData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.roleData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                        {stats.roleData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="font-medium text-slate-700">{entry.name}</span>
                                <span className="text-slate-400">({entry.value})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Critical Alerts List */}
        {stats.criticalErrors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Actions Requises (Critiques)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {violations.filter(v => v.severity === 'error').slice(0, 6).map((v, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-red-100 shadow-sm flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                            <div>
                                <div className="text-xs text-red-400 font-mono mb-0.5">{v.date}</div>
                                <div className="text-sm font-medium text-slate-800">
                                    {getEmpName(v.employeeId)}
                                </div>
                                <div className="text-xs text-slate-600">{v.message}</div>
                            </div>
                        </div>
                    ))}
                    {stats.criticalErrors > 6 && (
                        <div className="flex items-center justify-center text-sm text-red-600 font-medium">
                            + {stats.criticalErrors - 6} autres erreurs critiques...
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};