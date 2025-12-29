
import React, { useState } from 'react';
import { Skill } from '../types';
import { Plus, Trash2, Tag, Save, Loader2, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Pencil, X, Palette, Edit2 } from 'lucide-react';
import * as db from '../services/db';

const PRESET_BG_COLORS = [
    'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 
    'bg-green-100', 'bg-green-200', 'bg-emerald-200',
    'bg-red-100', 'bg-red-200', 'bg-red-600',
    'bg-orange-100', 'bg-orange-300', 'bg-orange-400',
    'bg-yellow-100', 'bg-amber-200', 
    'bg-purple-100', 'bg-indigo-200',
    'bg-pink-100', 'bg-rose-200',
    'bg-slate-100', 'bg-slate-200', 'bg-white', 'bg-black'
];

const PRESET_TEXT_COLORS = [
    'text-blue-900', 'text-blue-600',
    'text-green-900', 'text-green-600',
    'text-red-900', 'text-red-600',
    'text-orange-900',
    'text-amber-900',
    'text-purple-900',
    'text-slate-900', 'text-slate-600', 'text-slate-400',
    'text-white', 'text-gray-300'
];

interface SkillsSettingsProps {
    skills: Skill[];
    onReload: () => void;
}

export const SkillsSettings: React.FC<SkillsSettingsProps> = ({ skills, onReload }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Add State
    const [newCode, setNewCode] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDuration, setNewDuration] = useState<string>('7.5');
    const [newBreak, setNewBreak] = useState<string>('0.5');
    const [newColor, setNewColor] = useState('bg-blue-100');
    const [newTextColor, setNewTextColor] = useState('text-blue-900');
    
    // Edit State
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [editCode, setEditCode] = useState('');
    const [editLabel, setEditLabel] = useState('');
    const [editDuration, setEditDuration] = useState('');
    const [editBreak, setEditBreak] = useState('');
    const [editColor, setEditColor] = useState('bg-blue-100');
    const [editTextColor, setEditTextColor] = useState('text-blue-900');

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
            await db.createSkill(
                newCode.trim(), 
                newLabel.trim(), 
                parseFloat(newDuration), 
                parseFloat(newBreak),
                newColor,
                newTextColor
            );
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

    const handleEditClick = (skill: Skill) => {
        setEditingSkill(skill);
        setEditCode(skill.code);
        setEditLabel(skill.label);
        setEditDuration(skill.defaultDuration?.toString() || '7.5');
        setEditBreak(skill.defaultBreak?.toString() || '0.5');
        setEditColor(skill.color || 'bg-blue-100');
        setEditTextColor(skill.textColor || 'text-blue-900');
    };

    const handleUpdate = async () => {
        if (!editingSkill || !editCode || !editLabel) return;
        setIsLoading(true);
        try {
            await db.updateSkill(
                editingSkill.id,
                editCode.trim(),
                editLabel.trim(),
                parseFloat(editDuration),
                parseFloat(editBreak),
                editColor,
                editTextColor
            );
            setEditingSkill(null);
            setSuccessMsg("Compétence mise à jour.");
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
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[1200px]' : 'h-16'}`}>
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" /> Paramétrage des Compétences & Horaires
                </h3>
                <div className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                </div>
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-slate-200 overflow-hidden ${!isExpanded && 'hidden'}`}>
                {/* Form Add */}
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

                        {/* COULEURS AJOUT */}
                        <div className="p-3 bg-white border rounded-lg space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Palette className="w-3 h-3"/> Aspect Visuel</label>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-10 rounded shadow-sm flex items-center justify-center font-bold text-xs ${newColor} ${newTextColor}`}>
                                    {newCode || 'ABC'}
                                </div>
                                <div className="text-[10px] text-slate-400">Cliquez pour modifier l'aspect dans la modale d'édition.</div>
                            </div>
                        </div>

                        {error && <div className="text-red-600 text-xs">{error}</div>}
                        {successMsg && <div className="text-green-600 text-xs">{successMsg}</div>}

                        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded">Enregistrer</button>
                    </form>
                </div>

                {/* List */}
                <div className="lg:col-span-2 flex flex-col max-h-[700px] overflow-y-auto relative">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3">Code / Aspect</th>
                                <th className="px-6 py-3">Libellé</th>
                                <th className="px-6 py-3">Temps (Présence / Pause)</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {skills.map((skill) => (
                                <tr key={skill.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-3">
                                        <div className={`inline-flex items-center justify-center px-3 py-1.5 rounded font-bold text-xs shadow-sm ${skill.color || 'bg-blue-50'} ${skill.textColor || 'text-blue-700'}`}>
                                            {skill.code}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 font-medium text-slate-700">{skill.label}</td>
                                    <td className="px-6 py-3 text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3"/> 
                                            {skill.defaultDuration || '7.5'}h / {skill.defaultBreak || '0.5'}h
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditClick(skill)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(skill.id, skill.code)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* EDIT MODAL WITH COLOR PICKER */}
            {editingSkill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-3">
                            {/* Fixed: Added missing Edit2 icon from lucide-react */}
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600"/> Modifier Compétence</h3>
                            <button onClick={() => setEditingSkill(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                                    <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())} className="w-full p-2 border rounded font-bold bg-slate-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Libellé</label>
                                    <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-full p-2 border rounded" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Durée (h)</label>
                                    <input type="number" step="0.5" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pause (h)</label>
                                    <input type="number" step="0.25" value={editBreak} onChange={(e) => setEditBreak(e.target.value)} className="w-full p-2 border rounded" />
                                </div>
                            </div>

                            {/* NUANCIER COULEURS */}
                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Palette className="w-4 h-4" /> Style Visuel (Nuancier)</label>
                                    <div className={`px-4 py-1.5 rounded font-bold text-sm shadow-sm min-w-[70px] text-center ${editColor} ${editTextColor}`}>
                                        {editCode || 'TEST'}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Couleur de fond</label>
                                    <div className="grid grid-cols-7 sm:grid-cols-11 gap-1.5">
                                        {PRESET_BG_COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                type="button"
                                                onClick={() => setEditColor(c)}
                                                className={`w-7 h-7 rounded border-2 transition-all ${c} ${editColor === c ? 'border-blue-600 scale-110 shadow-md z-10' : 'border-transparent hover:scale-110'}`}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Couleur du texte</label>
                                    <div className="grid grid-cols-7 sm:grid-cols-11 gap-1.5">
                                        {PRESET_TEXT_COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                type="button"
                                                onClick={() => setEditTextColor(c)}
                                                className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-all bg-white text-[10px] font-bold ${c} ${editTextColor === c ? 'border-blue-600 scale-110 shadow-md z-10' : 'border-slate-200 hover:scale-110'}`}
                                                title={c}
                                            >
                                                Ab
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-8 pt-4 border-t">
                            <button onClick={() => setEditingSkill(null)} className="px-4 py-2 border rounded hover:bg-slate-50 text-sm font-medium transition-colors">Annuler</button>
                            <button onClick={handleUpdate} disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition-all flex items-center gap-2">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
