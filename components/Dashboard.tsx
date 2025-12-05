
import React, { useMemo, useState, useEffect } from 'react';
import { Employee, ConstraintViolation, ServiceConfig } from '../types';
import { checkConstraints } from '../utils/validation';
import { Users, AlertTriangle, CheckCircle2, TrendingUp, AlertOctagon, ShieldAlert, Calendar, CalendarDays, LayoutList, Wand2, Eye, Clock, ArrowRight, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  employees: Employee[];
  currentDate: Date; // Reference date for calculation
  serviceConfig?: ServiceConfig;
  onNavigateToPlanning?: (violations: ConstraintViolation[]) => void;
  onNavigateToScenarios?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ employees, currentDate, serviceConfig, onNavigateToPlanning, onNavigateToScenarios }) => {
  const [filter, setFilter] = useState<'month' | 'week' | 'day' | 'hourly'>('month');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  // Reset custom range when switching to week mode or when base date changes
  useEffect(() => {
      if (filter === 'week') {
          const d = new Date(currentDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
          const monday = new Date(d);
          monday.setDate(diff);
          
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          
          setCustomRange({
              start: monday.toISOString().split('T')[0],
              end: sunday.toISOString().split('T')[0]
          });
      }
  }, [currentDate, filter]);

  // Handle Week Navigation
  const handleWeekNavigate = (direction: 'prev' | 'next') => {
      if (!customRange.start || !customRange.end) return;
      
      const offset = direction === 'next' ? 7 : -7;
      
      const newStart = new Date(customRange.start);
      newStart.setDate(newStart.getDate() + offset);
      
      const newEnd = new Date(customRange.end);
      newEnd.setDate(newEnd.getDate() + offset);
      
      setCustomRange({
          start: newStart.toISOString().split('T')[0],
          end: newEnd.toISOString().split('T')[0]
      });
  };

  // 1. Calculate effective Date Range based on local filter
  const { startDate, days, label } = useMemo(() => {
    const d = new Date(currentDate);
    
    if (filter === 'day') {
        const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        return { startDate: d, days: 1, label: dateStr };
    }

    if (filter === 'hourly') {
        const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        return { startDate: d, days: 1, label: `${dateStr} (Vue Horaire)` };
    }
    
    if (filter === 'week') {
        // Use custom range if set
        if (customRange.start && customRange.end) {
             const start = new Date(customRange.start);
             const end = new Date(customRange.end);
             const diffTime = Math.abs(end.getTime() - start.getTime());
             const dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
             
             if (!isNaN(dayCount) && dayCount > 0) {
                 return { 
                     startDate: start, 
                     days: dayCount, 
                     label: `Période du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}` 
                 };
             }
        }

        // Fallback default week
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
  }, [currentDate, filter, customRange]);
  
  // 2. Compute Violations on the calculated range
  const violations = useMemo(() => {
    return checkConstraints(employees, startDate, days, serviceConfig);
  }, [employees, startDate, days, serviceConfig]);

  // 3. Key Indicators
  const stats = useMemo(() => {
    const staffingIssues = violations.filter(v => v.employeeId === 'ALL').length;
    const ruleBreaks = violations.filter(v => v.employeeId !== 'ALL').length;
    const criticalErrors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;
    
    // Role Distribution (Global)
    const roles: Record<string, number> = {};
    employees.forEach(e => {
      roles[e.role] = (roles[e.role] || 0) + 1;
    });
    const roleData = Object.keys(roles).map(key => ({ name: key, value: roles[key] }));

    // Coverage Rate
    const daysWithIssues = new Set(violations.filter(v => v.employeeId === 'ALL').map(v => v.date)).size;
    const coverageRate = days > 0 ? Math.round(((days - daysWithIssues) / days) * 100) : 0;

    return { staffingIssues, ruleBreaks, criticalErrors, warnings, roleData, coverageRate };
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

  const criticals = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

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
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Custom Period Inputs with Arrows */}
                {filter === 'week' && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => handleWeekNavigate('prev')} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <input 
                            type="date" 
                            value={customRange.start} 
                            onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))}
                            className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-slate-50 outline-none w-28 focus:border-blue-400 focus:bg-white transition-all"
                        />
                        <span className="text-slate-400"><ArrowRight className="w-3 h-3" /></span>
                        <input 
                            type="date" 
                            value={customRange.end} 
                            onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))}
                            className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-slate-50 outline-none w-28 focus:border-blue-400 focus:bg-white transition-all"
                        />
                        <button onClick={() => handleWeekNavigate('next')} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* IMPROVEMENT BUTTON */}
                {onNavigateToScenarios && (
                    <button 
                        onClick={onNavigateToScenarios}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-purple-700 flex items-center gap-2"
                    >
                        <Wand2 className="w-4 h-4" /> Optimiser
                    </button>
                )}

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
                        <CalendarDays className="w-4 h-4" /> Semaine / Période
                    </button>
                    <button 
                        onClick={() => setFilter('day')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${filter === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutList className="w-4 h-4" /> Jour
                    </button>
                    <button 
                        onClick={() => setFilter('hourly')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${filter === 'hourly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Clock className="w-4 h-4" /> Horaire
                    </button>
                </div>
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

        {/* DETAILED ANOMALY CARDS (Errors & Warnings) */}
        {violations.length > 0 && (
            <div className="space-y-4">
                
                {/* 1. Critical Errors */}
                {criticals.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                        <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Erreurs Bloquantes ({criticals.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {criticals.slice(0, 10).map((v, idx) => (
                                <div key={`crit-${idx}`} className="bg-white p-3 rounded border border-red-100 shadow-sm flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <div className="text-xs text-red-400 font-mono mb-0.5">{v.date}</div>
                                        <div className="text-sm font-medium text-slate-800">
                                            {getEmpName(v.employeeId)}
                                        </div>
                                        <div className="text-xs text-slate-600">{v.message}</div>
                                    </div>
                                    {/* HIGHLIGHT BUTTON */}
                                    {onNavigateToPlanning && (
                                        <button 
                                            onClick={() => onNavigateToPlanning([v])} 
                                            title="Voir dans le planning"
                                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {criticals.length > 10 && (
                                <div className="flex items-center justify-center text-sm text-red-600 font-medium col-span-full">
                                    + {criticals.length - 10} autres erreurs...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Warnings */}
                {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                        <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Avertissements & Points de Vigilance ({warnings.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {warnings.slice(0, 10).map((v, idx) => (
                                <div key={`warn-${idx}`} className="bg-white p-3 rounded border border-amber-100 shadow-sm flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <div className="text-xs text-amber-600 font-mono mb-0.5">{v.date}</div>
                                        <div className="text-sm font-medium text-slate-800">
                                            {getEmpName(v.employeeId)}
                                        </div>
                                        <div className="text-xs text-slate-600">{v.message}</div>
                                    </div>
                                    {/* HIGHLIGHT BUTTON */}
                                    {onNavigateToPlanning && (
                                        <button 
                                            onClick={() => onNavigateToPlanning([v])} 
                                            title="Voir dans le planning"
                                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {warnings.length > 10 && (
                                <div className="flex items-center justify-center text-sm text-amber-700 font-medium col-span-full">
                                    + {warnings.length - 10} autres avertissements...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
