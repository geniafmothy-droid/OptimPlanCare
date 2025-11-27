
import React, { useState } from 'react';
import { Employee, ShiftCode } from '../types';
import { Calendar, Upload, Save, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import * as db from '../services/db';
import { parseLeaveCSV } from '../utils/csvImport';

interface LeaveManagerProps {
    employees: Employee[];
    onReload: () => void;
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({ employees, onReload }) => {
    const [mode, setMode] = useState<'manual' | 'import'>('manual');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Manual Form State
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [leaveType, setLeaveType] = useState<ShiftCode>('CA');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleSubmitManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpId || !startDate || !endDate) return;

        setIsLoading(true);
        setMessage(null);
        try {
            await db.saveLeaveRange(selectedEmpId, startDate, endDate, leaveType);
            setMessage({ text: 'Congés enregistrés avec succès.', type: 'success' });
            // Reset form
            setStartDate('');
            setEndDate('');
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
                            
                            // Update balance if provided
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

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Gestion des Congés
            </h2>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setMode('manual')}
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${mode === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Saisie Manuelle
                </button>
                <button 
                    onClick={() => setMode('import')}
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${mode === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Import CSV
                </button>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {mode === 'manual' ? (
                    <form onSubmit={handleSubmitManual} className="space-y-6">
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
                                            {emp.name} ({emp.matricule}) - Solde: {emp.leaveBalance}j
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type de Congé</label>
                                <select 
                                    value={leaveType} 
                                    onChange={(e) => setLeaveType(e.target.value as ShiftCode)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="CA">Congés Annuels (CA)</option>
                                    <option value="RH">Récupération (RH/RTT)</option>
                                    <option value="FO">Formation (FO)</option>
                                    <option value="NT">Maladie / Absent (NT)</option>
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
                ) : (
                    <div className="space-y-6">
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
