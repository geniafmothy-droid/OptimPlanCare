
import React, { useMemo } from 'react';
import { Employee, ConstraintViolation } from '../types';
import { checkConstraints } from '../utils/validation';
import { Users, AlertTriangle, CheckCircle2, TrendingUp, AlertOctagon, ShieldAlert, CalendarX } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SHIFT_TYPES } from '../constants';

interface DashboardProps {
  employees: Employee[];
  startDate: Date;
  days: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ employees, startDate, days }) => {
  
  // 1. Calcul des Violations sur la période
  const violations = useMemo(() => {
    return checkConstraints(employees, startDate, days);
  }, [employees, startDate, days]);

  // 2. Indicateurs Clés
  const stats = useMemo(() => {
    const staffingIssues = violations.filter(v => v.employeeId === 'ALL').length;
    const ruleBreaks = violations.filter(v => v.employeeId !== 'ALL').length;
    const criticalErrors = violations.filter(v => v.severity === 'error').length;
    
    // Répartition par rôle
    const roles: Record<string, number> = {};
    employees.forEach(e => {
      roles[e.role] = (roles[e.role] || 0) + 1;
    });
    const roleData = Object.keys(roles).map(key => ({ name: key, value: roles[key] }));

    // Taux de couverture (Jours sans alerte d'effectif / Total jours)
    // On compte le nombre de jours uniques ayant une erreur 'ALL'
    const daysWithIssues = new Set(violations.filter(v => v.employeeId === 'ALL').map(v => v.date)).size;
    const coverageRate = days > 0 ? Math.round(((days - daysWithIssues) / days) * 100) : 0;

    return { staffingIssues, ruleBreaks, criticalErrors, roleData, coverageRate };
  }, [employees, violations, days]);

  // 3. Top des violations récurrentes
  const topViolations = useMemo(() => {
      const counts: Record<string, number> = {};
      violations.forEach(v => {
          // On simplifie le message pour grouper (ex: enlever le nom de l'employé au début)
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                Carnet de Bord
            </h2>
            <p className="text-slate-500">Synthèse de l'activité et de la conformité pour la période affichée.</p>
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
                    <div className="text-sm text-slate-500 font-medium uppercase">Jours en Sous-effectif</div>
                    <div className={`text-3xl font-bold ${stats.staffingIssues > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {stats.staffingIssues}
                    </div>
                    <div className="text-xs text-slate-400">sur {days} jours affichés</div>
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
                    <div className="text-xs text-slate-400">Jours sans incident majeur</div>
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
                        Aucune violation détectée
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
                                <div className="text-sm font-medium text-slate-800">{v.employeeId === 'ALL' ? 'Service Dialyse' : 'Employé #' + v.employeeId.slice(0,4)}</div>
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
