
import React, { useState, useMemo } from 'react';
import { Employee, ShiftCode, LeaveData } from '../types';
import { Calendar, Upload, Save, FileText, CheckCircle2, AlertTriangle, Loader2, Calculator, History, RotateCcw, Settings } from 'lucide-react';
import * as db from '../services/db';
import { parseLeaveCSV } from '../utils/csvImport';

interface LeaveManagerProps {
    employees: Employee[];
    onReload: () => void;
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, onReload }) => {
    const [mode, setMode] = useState<'manual' | 'import' | 'counters'>('manual');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Manual Form State
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [leaveType, setLeaveType] = useState<string>('CA'); // String to handle generic types keys
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deductFromBalance, setDeductFromBalance] = useState(false);

    // Counters State
    const [resetYear, setResetYear] = useState(new Date().getFullYear() + 1);

    // Calculate duration in days
    const durationDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        if (end < start) return 0;

        // Difference in milliseconds
        const diffTime = Math.abs(end.getTime() - start.getTime());
        // Convert to days (inclusive)
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate]);

    const getLeaveDataOrDefault = (emp: Employee): LeaveData => {
        if (emp.leaveData && emp.leaveData.counters) return emp.leaveData;
        
        // Return default structure if missing
        return {
            year: new Date().getFullYear(),
            counters: {
                "CA": { allowed: 25, taken: 0, reliquat: 0 },
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
            // 1. Save Shifts
            // Cast string back to ShiftCode if it matches, otherwise default to CA for code
            const codeForSchedule = ['CA', 'RH', 'NT', 'FO'].includes(leaveType) ? leaveType as ShiftCode : 'CA';
            await db.saveLeaveRange(selectedEmpId, startDate, endDate, codeForSchedule);
            
            // 2. Update Balance & History if requested
            if (deductFromBalance && durationDays > 0) {
                const emp = employees.find(e => e.id === selectedEmpId);
                if (emp) {
                    // Legacy Balance
                    const currentBalance = Number(emp.leaveBalance) || 0;
                    const newBalance = currentBalance - durationDays;
                    await db.updateEmployeeBalance(emp.id, newBalance);

                    // Advanced Leave Data (JSON)
                    const leaveData = getLeaveDataOrDefault(emp);
                    
                    // Initialize counter if not exists
                    if (!leaveData.counters[leaveType]) {
                        leaveData.counters[leaveType] = { allowed: 0, taken: 0, reliquat: 0 };
                    }
                    
                    // Update counters
                    leaveData.counters[leaveType].taken += durationDays;
                    
                    // Add History
                    leaveData.history.unshift({
                        date: new Date().toISOString().split('T')[0],
                        action: 'PRIS',
                        details: `Prise de ${durationDays} jours (${leaveType}) du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                    });

                    // Save JSON
                    await db.updateEmployeeLeaveData(emp.id, leaveData);
                }
            }

            setMessage({ 
                text: deductFromBalance 
                    ? `Congés enregistrés, solde déduit et historique mis à jour.` 
                    : 'Congés enregistrés avec succès (solde inchangé).', 
                type: 'success' 
            });

            // Reset form
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
        if (!confirm(`Confirmer la réinitialisation annuelle pour l'année ${resetYear} ?\nCela va basculer le solde restant en reliquat et remettre les compteurs 'Pris' à zéro.`)) return;

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

            // Logic: 
            // New Reliquat = Old Reliquat + (Old Allowed - Old Taken)
            // New Taken = 0
            // New Allowed = Old Allowed (Default carry over rights)
            
            Object.keys(currentData.counters).forEach(key => {
                const oldCounter = currentData.counters[key];
                const remainder = Math.max(0, oldCounter.allowed - oldCounter.taken);
                
                newData.counters[key] = {
                    allowed: oldCounter.allowed, // Keep same rights
                    taken: 0,
                    reliquat: oldCounter.reliquat + remainder
                };
            });

            // Add History Entry
            newData.history.unshift({
                date: new Date().toISOString().split('T')[0],
                action: 'RESET',
                details: `Initialisation Année ${resetYear}. Reliquats calculés.`
            });

            await db.updateEmployeeLeaveData(emp.id, newData);
            setMessage({ text: "Compteurs réinitialisés avec succès.", type: "success" });
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
                    if (requests.length === 0) {
                        throw new Error("Aucune demande valide trouvée dans le CSV.");
                    }

                    let successCount = 0;
                    for (const req of requests) {
                        const emp = employees.find(e => e.matricule === req.matricule);
                        if (emp) {
                            // Save shifts
                            await db.saveLeaveRange(emp.id, req.startDate, req.endDate, req.type);
                            
                            // Update balance if provided in CSV (Legacy)
                            if (req.balance !== undefined) {
                                await db.updateEmployeeBalance(emp.id, req.balance);
                            }
                            successCount++;
                        }
                    }
                    setMessage({ text: `Import terminé : ${successCount} congés traités.`, type: 'success' });
                    onReload();
                } catch (error: any) {
                    setMessage({ text: `Erreur Import: ${error.message}`, type: 'error' });
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

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Gestion des Congés
            </h2>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setMode('manual')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Settings className="w-4 h-4" /> Saisie
                </button>
                <button 
                    onClick={() => setMode('counters')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'counters' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <History className="w-4 h-4" /> Compteurs & Historique
                </button>
                <button 
                    onClick={() => setMode('import')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Upload className="w-4 h-4" /> Import CSV
                </button>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 min-h-[400px]">
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* --- MODE MANUAL --- */}
                {mode === 'manual' && (
                    <form onSubmit={handleSubmitManual} className="space-y-6 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Employé</label>
                                <select 
                                    value={selectedEmpId} 
                                    onChange={(e) => setSelectedEmpId(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">-- Sélectionner --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.matricule})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type de Congé</label>
                                <select 
                                    value={leaveType} 
                                    onChange={(e) => setLeaveType(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="CA">Congés Annuels (CA)</option>
                                    <option value="RTT">RTT</option>
                                    <option value="RH">Repos Compensateur (RH/RC)</option>
                                    <option value="NT">Maladie (NT)</option>
                                    <option value="FO">Formation (FO)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin (incluse)</label>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={deductFromBalance}
                                        onChange={(e) => setDeductFromBalance(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-slate-700 block">Déduire du compteur</span>
                                    <span className="text-xs text-slate-500">Met à jour les compteurs et l'historique</span>
                                </div>
                            </label>

                            {startDate && endDate && durationDays > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded border border-slate-200">
                                    <Calculator className="w-4 h-4 text-slate-400" />
                                    <span>Durée : <strong>{durationDays} jours</strong></span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                type="submit" 
                                disabled={isLoading || !selectedEmpId}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Enregistrer
                            </button>
                        </div>
                    </form>
                )}

                {/* --- MODE COUNTERS & HISTORY --- */}
                {mode === 'counters' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sélectionner un employé pour voir ses compteurs</label>
                            <select 
                                value={selectedEmpId} 
                                onChange={(e) => setSelectedEmpId(e.target.value)}
                                className="w-full md:w-1/2 p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Choisir un collaborateur --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedEmployeeData ? (
                            <div className="space-y-8">
                                {/* Header / Reset */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">Situation Année {selectedEmployeeData.year}</h3>
                                        <p className="text-sm text-slate-500">Aperçu global des droits et prises</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-600">Nouvelle année :</span>
                                        <input 
                                            type="number" 
                                            value={resetYear} 
                                            onChange={(e) => setResetYear(parseInt(e.target.value))}
                                            className="w-20 p-1.5 border border-slate-300 rounded text-sm"
                                        />
                                        <button 
                                            onClick={handleAnnualReset}
                                            className="bg-white border border-slate-300 hover:bg-red-50 hover:text-red-700 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-all"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Réinitialisation Annuelle
                                        </button>
                                    </div>
                                </div>

                                {/* Counters Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                                        <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3 text-center text-blue-700 bg-blue-50">Droits Annuel</th>
                                                <th className="px-4 py-3 text-center text-orange-700 bg-orange-50">Pris</th>
                                                <th className="px-4 py-3 text-center text-green-700 bg-green-50">Reliquat N-1</th>
                                                <th className="px-4 py-3 text-right font-bold">Solde Disponible</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {Object.entries(selectedEmployeeData.counters).map(([key, val]) => {
                                                const balance = val.allowed + val.reliquat - val.taken;
                                                return (
                                                    <tr key={key} className="bg-white hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium text-slate-900">{key}</td>
                                                        <td className="px-4 py-3 text-center text-slate-600">{val.allowed}</td>
                                                        <td className="px-4 py-3 text-center text-orange-600 font-medium">{val.taken}</td>
                                                        <td className="px-4 py-3 text-center text-green-600">{val.reliquat}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-blue-600 bg-slate-50/50">
                                                            {balance} j
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* History List */}
                                <div>
                                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <History className="w-4 h-4 text-slate-400" /> Historique des mouvements
                                    </h4>
                                    <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto bg-slate-50">
                                        {selectedEmployeeData.history.length === 0 ? (
                                            <div className="p-4 text-center text-slate-400 text-sm italic">Aucun historique disponible.</div>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                    {selectedEmployeeData.history.map((h, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-slate-500 w-32 font-mono text-xs">
                                                                {h.date}
                                                            </td>
                                                            <td className="px-4 py-2 w-24">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                    h.action === 'RESET' ? 'bg-purple-100 text-purple-700' :
                                                                    h.action === 'PRIS' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {h.action}
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
                        ) : (
                            selectedEmpId && <div className="p-8 text-center text-slate-400">Chargement des données...</div>
                        )}
                    </div>
                )}

                {/* --- MODE IMPORT --- */}
                {mode === 'import' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Format CSV Attendu
                            </h4>
                            <p>Le fichier doit contenir les colonnes suivantes (séparateur point-virgule ou virgule) :</p>
                            <code className="block bg-white p-2 mt-2 border border-slate-200 rounded font-mono text-xs">
                                Nom;Matricule;Type;Compteur;Debut;Fin
                            </code>
                            <p className="mt-2 text-xs italic">Exemple: DUPONT;M042;CA;23.5;01/05/2025;15/05/2025</p>
                        </div>

                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10 hover:bg-slate-50 transition-colors">
                            <Upload className="w-12 h-12 text-slate-300 mb-4" />
                            <label className="cursor-pointer">
                                <span className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm inline-block transition-colors">
                                    Sélectionner un fichier CSV
                                </span>
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                            </label>
                            <p className="text-sm text-slate-500 mt-2">ou glissez-déposez le fichier ici</p>
                        </div>
                        
                        {isLoading && (
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Traitement en cours...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
