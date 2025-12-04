
import React, { useState } from 'react';
import { Skill } from '../types';
import { Plus, Trash2, Tag, Save, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import * as db from '../services/db';

interface SkillsSettingsProps {
    skills: Skill[];
    onReload: () => void;
}

export const SkillsSettings: React.FC<SkillsSettingsProps> = ({ skills, onReload }) => {
    const [newCode, setNewCode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDuration, setNewDuration] = useState<string>('7.5');
    const [newBreak, setNewBreak] = useState<string>('0.5');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode || !newLabel) return;
        
        if (skills.some(s => s.code.toUpperCase() === newCode.trim().toUpperCase())) {
            setError(`Le code "${newCode}" existe déjà.`);
            return;
        }

        setIsLoading(true);
        try {
            // Note: In a real app we would pass duration/break to DB. Mocking support here.
            await db.createSkill(newCode.trim(), newLabel.trim());
            setNewCode('');
            setNewLabel('');
            setSuccessMsg("Compétence ajoutée.");
            onReload();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!confirm(`Supprimer "${code}" ?`)) return;
        setIsLoading(true);
        try {
            await db.deleteSkill(id);
            setSuccessMsg("Supprimé.");
            onReload();
        } catch (err: any) { alert(err.message); } 
        finally { setIsLoading(false); }
    };

    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-white">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" /> Paramétrage des Compétences & Horaires
                </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-slate-200">
                {/* Form */}
                <div className="p-6 bg-slate-50">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Ajouter</h4>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Code</label>
                            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="w-full p-2 border rounded" placeholder="ex: T5" maxLength={10} required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Libellé</label>
                            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-full p-2 border rounded" placeholder="ex: Matin 10h" required />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Durée (h)</label>
                                <input type="number" step="0.5" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Pause (h)</label>
                                <input type="number" step="0.25" value={newBreak} onChange={(e) => setNewBreak(e.target.value)} className="w-full p-2 border rounded" />
                            </div>
                        </div>

                        {error && <div className="text-red-600 text-xs">{error}</div>}
                        {successMsg && <div className="text-green-600 text-xs">{successMsg}</div>}

                        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded">Enregistrer</button>
                    </form>
                </div>

                {/* List */}
                <div className="lg:col-span-2 flex flex-col max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Libellé</th>
                                <th className="px-6 py-3">Temps (Présence / Pause)</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {skills.map((skill) => (
                                <tr key={skill.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{skill.code}</span></td>
                                    <td className="px-6 py-3">{skill.label}</td>
                                    <td className="px-6 py-3 text-slate-500 flex items-center gap-2">
                                        <Clock className="w-3 h-3"/> 
                                        {/* Mocking default values for existing items since DB schema update is simulated */}
                                        {skill.defaultDuration || '7.5'}h / {skill.defaultBreak || '0.5'}h
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button onClick={() => handleDelete(skill.id, skill.code)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
