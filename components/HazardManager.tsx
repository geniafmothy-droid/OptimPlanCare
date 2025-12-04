
import React, { useState } from 'react';
import { Employee, ShiftCode } from '../types';
import { AlertTriangle, ArrowRight, UserX, UserCheck, Calendar, RefreshCcw } from 'lucide-react';

interface HazardManagerProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    currentDate: Date;
    onResolve: () => void;
}

export const HazardManager: React.FC<HazardManagerProps> = ({ isOpen, onClose, employees, currentDate, onResolve }) => {
    const [step, setStep] = useState(1);
    const [absentEmpId, setAbsentEmpId] = useState('');
    const [hazardDate, setHazardDate] = useState(currentDate.toISOString().split('T')[0]);
    const [solution, setSolution] = useState<'AUTO' | 'MANUAL' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleAnalyze = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setStep(2);
        }, 1500);
    };

    const handleApply = () => {
        alert("Solution appliquée : Planning mis à jour.");
        onResolve();
        onClose();
    };

    // Find candidates for replacement (mock logic)
    const candidates = employees.filter(e => e.id !== absentEmpId && e.role === 'Infirmier').slice(0, 3);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6"/> Gestion d'Aléa</h3>
                    <button onClick={onClose} className="hover:bg-amber-600 p-1 rounded"><UserX className="w-5 h-5"/></button>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-slate-600 mb-4">Déclarez un événement imprévu pour déclencher le moteur de replanification.</p>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Type d'Aléa</label>
                                <select className="w-full p-2 border rounded bg-slate-50">
                                    <option>Absence Imprévue (Maladie courte)</option>
                                    <option>Surcroît d'activité</option>
                                    <option>Urgence Familiale</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Employé concerné</label>
                                <select className="w-full p-2 border rounded" value={absentEmpId} onChange={e => setAbsentEmpId(e.target.value)}>
                                    <option value="">Sélectionner...</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                <input type="date" value={hazardDate} onChange={e => setHazardDate(e.target.value)} className="w-full p-2 border rounded"/>
                            </div>

                            <button onClick={handleAnalyze} disabled={!absentEmpId || isProcessing} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold shadow flex justify-center items-center gap-2 mt-4">
                                {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin"/> : <ArrowRight className="w-5 h-5"/>}
                                {isProcessing ? 'Analyse des solutions...' : 'Rechercher Solutions'}
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h4 className="font-bold text-lg text-slate-800 mb-4">Solutions Proposées</h4>
                            <div className="space-y-3 mb-6">
                                {candidates.map((c, idx) => (
                                    <div key={c.id} className="border p-3 rounded-lg flex justify-between items-center hover:bg-slate-50 cursor-pointer" onClick={() => setSolution('AUTO')}>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-green-100 text-green-700 font-bold px-2 py-1 rounded text-xs">Recommandé</div>
                                            <div>
                                                <div className="font-bold text-slate-700">{c.name}</div>
                                                <div className="text-xs text-slate-500">Disponible (Repos ce jour)</div>
                                            </div>
                                        </div>
                                        <input type="radio" name="sol" />
                                    </div>
                                ))}
                                <div className="border p-3 rounded-lg flex justify-between items-center hover:bg-slate-50 cursor-pointer text-slate-500 border-dashed">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded text-xs">Intérim</div>
                                        <div>
                                            <div className="font-bold">Demander Intérimaire</div>
                                            <div className="text-xs">Coût supplémentaire</div>
                                        </div>
                                    </div>
                                    <input type="radio" name="sol" />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 py-2 border rounded hover:bg-slate-50">Retour</button>
                                <button onClick={handleApply} className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Appliquer</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
