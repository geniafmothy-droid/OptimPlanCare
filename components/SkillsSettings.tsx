
import React, { useState } from 'react';
import { Skill } from '../types';
import { Plus, Trash2, Tag, Save, Loader2, CheckCircle2 } from 'lucide-react';
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
        
        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
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

    const handleDelete = async (id: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cette compétence ? Cette action est irréversible.")) return;
        
        setIsLoading(true);
        setSuccessMsg(null);
        try {
            await db.deleteSkill(id);
            setSuccessMsg("Suppression réussie.");
            onReload();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccessMsg(null), 3000);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <Tag className="w-6 h-6 text-blue-600" />
                Paramétrage des Compétences
            </h2>

            {successMsg && (
                <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> {successMsg}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Formulaire d'ajout */}
                <div className="bg-white p-6 rounded-xl shadow border border-slate-200 h-fit">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Nouvelle Compétence
                    </h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Code Court</label>
                            <input 
                                type="text" 
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ex: IT, Senior"
                                maxLength={10}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Libellé</label>
                            <input 
                                type="text" 
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ex: Infirmier Titulaire"
                                required
                            />
                        </div>
                        {error && <div className="text-xs text-red-600">{error}</div>}
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Ajouter
                        </button>
                    </form>
                </div>

                {/* Liste existante */}
                <div className="md:col-span-2 bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <h3 className="font-semibold text-slate-800">Liste des Compétences ({skills.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0 max-h-[500px]">
                        {skills.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 italic">Aucune compétence définie.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3">Code</th>
                                        <th className="px-6 py-3">Libellé</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {skills.map((skill) => (
                                        <tr key={skill.id} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                                                    {skill.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">{skill.label}</td>
                                            <td className="px-6 py-3 text-right">
                                                <button 
                                                    onClick={() => handleDelete(skill.id)}
                                                    className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded"
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
