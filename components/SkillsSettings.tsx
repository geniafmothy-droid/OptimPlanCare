
import React, { useState } from 'react';
import { Skill } from '../types';
import { Plus, Trash2, Tag, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as db from '../services/db';

interface SkillsSettingsProps {
    skills: Skill[];
    onReload: () => void;
}

export const SkillsSettings: React.FC<SkillsSettingsProps> = ({ skills, onReload }) => {
    const [newCode, setNewCode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode || !newLabel) return;
        
        // Basic validation
        if (skills.some(s => s.code.toUpperCase() === newCode.trim().toUpperCase())) {
            setError(`Le code "${newCode}" existe déjà.`);
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await db.createSkill(newCode.trim(), newLabel.trim());
            setNewCode('');
            setNewLabel('');
            setSuccessMsg("Compétence ajoutée avec succès.");
            onReload();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la compétence "${code}" ?\nCela ne la retirera pas des employés qui l'ont déjà, mais elle ne sera plus proposée.`)) return;
        
        setIsLoading(true);
        setSuccessMsg(null);
        try {
            await db.deleteSkill(id);
            setSuccessMsg(`Compétence "${code}" supprimée.`);
            onReload();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-white">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" />
                    Paramétrage des Compétences
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    Définissez ici les codes (IT, T5, S...) et compétences (Senior, Dialyse...) disponibles dans l'application.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-slate-200">
                {/* Formulaire d'ajout */}
                <div className="p-6 bg-slate-50">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Ajouter
                    </h4>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Code Court <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                placeholder="ex: T5"
                                maxLength={10}
                                required
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Utilisé dans les filtres et le planning.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Libellé Complet <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="ex: Matin 10h00"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-green-50 text-green-600 text-xs rounded-lg flex items-start gap-2 animate-in fade-in">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{successMsg}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Enregistrer
                        </button>
                    </form>
                </div>

                {/* Liste */}
                <div className="lg:col-span-2 flex flex-col max-h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center sticky top-0 z-10">
                        <span className="text-sm font-semibold text-slate-700">Liste existante ({skills.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {skills.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic flex flex-col items-center">
                                <Tag className="w-12 h-12 mb-2 text-slate-200" />
                                Aucune compétence enregistrée.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Code</th>
                                        <th className="px-6 py-3 font-medium">Libellé</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {skills.map((skill) => (
                                        <tr key={skill.id} className="bg-white hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-3 font-medium text-slate-900">
                                                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 font-mono text-xs">
                                                    {skill.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">{skill.label}</td>
                                            <td className="px-6 py-3 text-right">
                                                <button 
                                                    onClick={() => handleDelete(skill.id, skill.code)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
