
import React, { useState, useMemo } from 'react';
import { Employee, ShiftCode, LeaveData, ViewMode } from '../types';
import { Calendar, Upload, CheckCircle2, AlertTriangle, History, Settings, LayoutGrid, Filter, ChevronLeft, ChevronRight, CalendarDays, LayoutList, Trash2, Save } from 'lucide-react';
import * as db from '../services/db';
import { parseLeaveCSV } from '../utils/csvImport';
import { LeaveCalendar } from './LeaveCalendar';

interface LeaveManagerProps {
    employees: Employee[];
    onReload: () => void;
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, onReload }) => {
    const [mode, setMode] = useState<'manual' | 'import' | 'counters' | 'calendar'>('manual');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Manual Form State
    const [actionType, setActionType] = useState<'add' | 'delete'>('add');
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [leaveType, setLeaveType] = useState<string>('CA'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deductFromBalance, setDeductFromBalance] = useState(false);

    // Counters State
    const [resetYear, setResetYear] = useState(new Date().getFullYear() + 1);
    const [historyFilter, setHistoryFilter] = useState<string>('ALL');

    // Calendar Filter State
    const [calViewMode, setCalViewMode] = useState<ViewMode>('month');
    const [calDate, setCalDate] = useState(new Date());

    // Calculate duration in days
    const durationDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        if (end < start) return 0;
        
        let days = 0;
        // Logic specific to non-nurses (Mon-Fri) vs Nurses (Mon-Sat)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            const emp = employees.find(e => e.id === selectedEmpId);
            const isInfirmier = emp?.role === 'Infirmier';
            
            // Jours ouvrés (Lun-Ven) pour non-infirmiers, Ouvrables (Lun-Sam) pour infirmiers
            if (isInfirmier) {
                if (day !== 0) days++; // Skip Dimanche
            } else {
                if (day !== 0 && day !== 6) days++; // Skip Samedi Dimanche
            }
        }
        return days;
    }, [startDate, endDate, selectedEmpId, employees]);

    const getLeaveDataOrDefault = (emp: Employee): LeaveData => {
        if (emp.leaveData && emp.leaveData.counters) return emp.leaveData;
        return {
            year: new Date().getFullYear(),
            counters: {
                "CA": { allowed: 25, taken: 0, reliquat: 0 },
                "HS": { allowed: 0, taken: 0, reliquat: 0 },
                "RTT": { allowed: 0, taken: 0, reliquat: 0 },
                "RC": { allowed: 0, taken: 0, reliquat: 0 }
            },
            history: []
        };
    };

    const handleSubmitManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpId || !startDate || !endDate) return;

        setIsLoading(true);
        setMessage(null);
        try {
            const emp = employees.find(e => e.id === selectedEmpId);
            if (!emp) throw new Error("Employé introuvable");

            if (actionType === 'add') {
                const codeForSchedule = ['CA', 'RH', 'NT', 'FO', 'HS', 'RC'].includes(leaveType) ? leaveType as ShiftCode : 'CA';
                await db.saveLeaveRange(selectedEmpId, startDate, endDate, codeForSchedule);
                
                if (deductFromBalance && durationDays > 0) {
                    const currentBalance = Number(emp.leaveBalance) || 0;
                    const newBalance = currentBalance - durationDays;
                    await db.updateEmployeeBalance(emp.id, newBalance);

                    const leaveData = getLeaveDataOrDefault(emp);
                    if (!leaveData.counters[leaveType]) {
                        leaveData.counters[leaveType] = { allowed: 0, taken: 0, reliquat: 0 };
                    }
                    leaveData.counters[leaveType].taken += durationDays;
                    
                    leaveData.history.unshift({
                        date: new Date().toISOString().split('T')[0],
                        action: 'PRIS',
                        type: leaveType,
                        details: `Prise de ${durationDays} jours du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                    });
                    
                    await db.updateEmployeeLeaveData(emp.id, leaveData);
                }
                setMessage({ text: deductFromBalance ? `Congés enregistrés et déduits.` : 'Congés enregistrés.', type: 'success' });
            } else {
                // DELETE MODE
                if (!window.confirm(`Êtes-vous sûr de vouloir supprimer les congés de ${emp.name} du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()} ?\nCette action libérera les jours dans le planning.`)) {
                    setIsLoading(false);
                    return;
                }

                await db.deleteLeaveRange(selectedEmpId, startDate, endDate);

                // Option to re-credit
                if (deductFromBalance && durationDays > 0) {
                    const leaveData = getLeaveDataOrDefault(emp);
                    if (leaveData.counters[leaveType]) {
                        leaveData.counters[leaveType].taken = Math.max(0, leaveData.counters[leaveType].taken - durationDays);
                    }
                    // Legacy balance
                    const currentBalance = Number(emp.leaveBalance) || 0;
                    await db.updateEmployeeBalance(emp.id, currentBalance + durationDays);

                    leaveData.history.unshift({
                        date: new Date().toISOString().split('T')[0],
                        action: 'ANNUL',
                        type: leaveType,
                        details: `Annulation de ${durationDays} jours du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                    });
                    await db.updateEmployeeLeaveData(emp.id, leaveData);
                }
                setMessage({ text: deductFromBalance ? `Congés supprimés et recrédités.` : 'Congés supprimés du planning.', type: 'success' });
            }

            setStartDate('');
            setEndDate('');
            setDeductFromBalance(false);
            onReload();
        } catch (error: any) {
            setMessage({ text: `Erreur: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnnualReset = async () => {
        if (!selectedEmpId) return;
        if (!confirm(`Confirmer la réinitialisation pour ${resetYear} ?`)) return;

        setIsLoading(true);
        try {
            const emp = employees.find(e => e.id === selectedEmpId);
            if (!emp) throw new Error("Employé introuvable");

            const currentData = getLeaveDataOrDefault(emp);
            const newData: LeaveData = {
                year: resetYear,
                counters: {},
                history: [...currentData.history]
            };
            
            Object.keys(currentData.counters).forEach(key => {
                const oldCounter = currentData.counters[key];
                const remainder = Math.max(0, oldCounter.allowed - oldCounter.taken);
                newData.counters[key] = {
                    allowed: oldCounter.allowed,
                    taken: 0,
                    reliquat: oldCounter.reliquat + remainder
                };
            });

            newData.history.unshift({
                date: new Date().toISOString().split('T')[0],
                action: 'RESET',
                type: 'SYSTEM',
                details: `Init Année ${resetYear}. Bascule des reliquats.`
            });

            await db.updateEmployeeLeaveData(emp.id, newData);
            setMessage({ text: "Compteurs réinitialisés.", type: "success" });
            onReload();
        } catch (error: any) {
            setMessage({ text: `Erreur: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        setMessage(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            if (content) {
                try {
                    const requests = parseLeaveCSV(content);
                    if (requests.length === 0) throw new Error("CSV invalide/vide");
                    for (const req of requests) {
                        const emp = employees.find(e => e.matricule === req.matricule);
                        if (emp) {
                            await db.saveLeaveRange(emp.id, req.startDate, req.endDate, req.type);
                            if (req.balance !== undefined) await db.updateEmployeeBalance(emp.id, req.balance);
                        }
                    }
                    setMessage({ text: `Import terminé.`, type: 'success' });
                    onReload();
                } catch (error: any) {
                    setMessage({ text: `Erreur: ${error.message}`, type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            }
        };
        reader.readAsText(file);
    };

    const selectedEmployeeData = useMemo(() => {
        const emp = employees.find(e => e.id === selectedEmpId);
        return emp ? getLeaveDataOrDefault(emp) : null;
    }, [selectedEmpId, employees]);

    const filteredHistory = useMemo(() => {
        if (!selectedEmployeeData) return [];
        if (historyFilter === 'ALL') return selectedEmployeeData.history;
        return selectedEmployeeData.history.filter(h => h.type === historyFilter || (!h.type && historyFilter === 'ALL'));
    }, [selectedEmployeeData, historyFilter]);

    // Calendar Calculations
    const { calStartDate, calDays, calLabel } = useMemo(() => {
        const d = new Date(calDate);
        if (calViewMode === 'day') {
            return { calStartDate: d, calDays: 1, calLabel: d.toLocaleDateString() };
        }
        if (calViewMode === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d);
            monday.setDate(diff);
            return { calStartDate: monday, calDays: 7, calLabel: `Semaine du ${monday.getDate()}` };
        }
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return { calStartDate: start, calDays: days, calLabel: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
    }, [calDate, calViewMode]);

    const handleCalNavigate = (dir: 'prev' | 'next') => {
        const newD = new Date(calDate);
        if (calViewMode === 'month') newD.setMonth(newD.getMonth() + (dir === 'next' ? 1 : -1));
        else if (calViewMode === 'week') newD.setDate(newD.getDate() + (dir === 'next' ? 7 : -7));
        else newD.setDate(newD.getDate() + (dir === 'next' ? 1 : -1));
        setCalDate(newD);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Gestion des Congés
            </h2>

            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button onClick={() => setMode('manual')} className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <Settings className="w-4 h-4" /> Saisie / Suppression
                </button>
                <button onClick={() => setMode('counters')} className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'counters' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <History className="w-4 h-4" /> Compteurs
                </button>
                <button onClick={() => setMode('import')} className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <Upload className="w-4 h-4" /> Import CSV
                </button>
                <button onClick={() => setMode('calendar')} className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <LayoutGrid className="w-4 h-4" /> Planning Absences
                </button>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 flex-1 overflow-y-auto">
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {mode === 'calendar' && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button onClick={() => setCalViewMode('month')} className={`px-3 py-1 text-xs rounded font-medium ${calViewMode === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Mois</button>
                                <button onClick={() => setCalViewMode('week')} className={`px-3 py-1 text-xs rounded font-medium ${calViewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Semaine</button>
                                <button onClick={() => setCalViewMode('day')} className={`px-3 py-1 text-xs rounded font-medium ${calViewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Jour</button>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border">
                                <button onClick={() => handleCalNavigate('prev')}><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-sm font-semibold min-w-[150px] text-center capitalize">{calLabel}</span>
                                <button onClick={() => handleCalNavigate('next')}><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LeaveCalendar employees={employees} startDate={calStartDate} days={calDays} />
                        </div>
                    </div>
                )}

                {mode === 'manual' && (
                    <form onSubmit={handleSubmitManual} className="space-y-6 max-w-2xl mx-auto">
                        <div className="flex justify-center mb-4">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button type="button" onClick={() => setActionType('add')} className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${actionType === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Save className="w-4 h-4" /> Poser</button>
                                <button type="button" onClick={() => setActionType('delete')} className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${actionType === 'delete' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}><Trash2 className="w-4 h-4" /> Supprimer</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Employé</label>
                                <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="w-full p-2 border border-slate-300 rounded" required>
                                    <option value="">-- Sélectionner --</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type de congé</label>
                                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full p-2 border border-slate-300 rounded">
                                    <option value="CA">Congés Annuels (CA)</option>
                                    <option value="HS">Hors Saison (HS)</option>
                                    <option value="RTT">RTT</option>
                                    <option value="RC">Repos Cycle (RC)</option>
                                    <option value="RH">Repos Compensateur</option>
                                    <option value="NT">Maladie</option>
                                </select>
                            </div>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded" required />
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded" required />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded border">
                            <input type="checkbox" checked={deductFromBalance} onChange={(e) => setDeductFromBalance(e.target.checked)} />
                            <span>{actionType === 'add' ? 'Déduire du compteur' : 'Recréditer le compteur'}</span>
                        </label>
                        <button type="submit" disabled={isLoading} className={`w-full py-2.5 rounded text-white font-medium shadow-sm ${actionType === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>{actionType === 'add' ? 'Enregistrer' : 'Supprimer'}</button>
                    </form>
                )}

                {mode === 'counters' && (
                    <div className="space-y-6">
                        <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="w-full p-2 border rounded">
                            <option value="">-- Choisir un collaborateur --</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                        {selectedEmployeeData && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded">
                                    <h3 className="font-bold">Année {selectedEmployeeData.year}</h3>
                                    <button onClick={handleAnnualReset} className="text-red-600 border border-red-200 px-3 py-1 rounded bg-white hover:bg-red-50">Réinitialiser Annuelle</button>
                                </div>
                                
                                {/* Table des compteurs */}
                                <table className="w-full text-sm border rounded overflow-hidden">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-2 text-left">Type</th>
                                            <th className="p-2 text-center">Droits</th>
                                            <th className="p-2 text-center">Pris</th>
                                            <th className="p-2 text-center">Reliquat</th>
                                            <th className="p-2 text-right">Solde Dispo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(selectedEmployeeData.counters).map(([key, val]) => {
                                            const balance = val.allowed + val.reliquat - val.taken;
                                            return (
                                                <tr key={key} className="border-t">
                                                    <td className="p-2 font-medium">{key}</td>
                                                    <td className="p-2 text-center">{val.allowed}</td>
                                                    <td className="p-2 text-center">{val.taken}</td>
                                                    <td className="p-2 text-center">{val.reliquat}</td>
                                                    <td className="p-2 text-right font-bold text-blue-600">{balance}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Historique */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <History className="w-4 h-4 text-slate-400" /> Historique des mouvements
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-4 h-4 text-slate-400" />
                                            <select 
                                                value={historyFilter} 
                                                onChange={(e) => setHistoryFilter(e.target.value)}
                                                className="text-sm p-1 border rounded bg-white"
                                            >
                                                <option value="ALL">Tout voir</option>
                                                {Object.keys(selectedEmployeeData.counters).map(k => (
                                                    <option key={k} value={k}>{k}</option>
                                                ))}
                                                <option value="SYSTEM">Système (Reset)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto bg-slate-50">
                                        {filteredHistory.length === 0 ? (
                                            <div className="p-4 text-center text-slate-400 text-sm italic">Aucun historique pour ce filtre.</div>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                    {filteredHistory.map((h, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-slate-500 w-32 font-mono text-xs">
                                                                {h.date}
                                                            </td>
                                                            <td className="px-4 py-2 w-24">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                    h.action === 'RESET' ? 'bg-purple-100 text-purple-700' :
                                                                    h.action === 'PRIS' ? 'bg-orange-100 text-orange-700' :
                                                                    h.action === 'ANNUL' ? 'bg-red-100 text-red-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {h.type || h.action}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-slate-700">
                                                                {h.details}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {mode === 'import' && (
                     <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10">
                        <Upload className="w-12 h-12 text-slate-300 mb-4" />
                        <input type="file" accept=".csv" onChange={handleFileUpload} />
                     </div>
                )}
            </div>
        </div>
    );
};
