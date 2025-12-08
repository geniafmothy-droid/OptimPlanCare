
import React, { useState } from 'react';
import { ShiftDefinition } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Palette, Edit2, ChevronDown, ChevronUp, Clock, AlertTriangle, X, Check, Trash2, Save, Plus } from 'lucide-react';

export const ShiftCodeSettings: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    // Local state for UI demo purposes (since constant file is read-only in browser)
    const [codes, setCodes] = useState<ShiftDefinition[]>(Object.values(SHIFT_TYPES));
    
    // Edit/Create Modal State
    const [editingCode, setEditingCode] = useState<ShiftDefinition | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form fields
    const [formCode, setFormCode] = useState('');
    const [formLabel, setFormLabel] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formColor, setFormColor] = useState('bg-slate-100');
    const [formTextColor, setFormTextColor] = useState('text-slate-800');
    const [formIsWork, setFormIsWork] = useState(false);
    const [formDuration, setFormDuration] = useState(0);
    const [formBreak, setFormBreak] = useState(0);
    const [formStart, setFormStart] = useState(0);
    const [formEnd, setFormEnd] = useState(0);

    const resetForm = () => {
        setFormCode('');
        setFormLabel('');
        setFormDesc('');
        setFormColor('bg-slate-100');
        setFormTextColor('text-slate-800');
        setFormIsWork(false);
        setFormDuration(0);
        setFormBreak(0);
        setFormStart(0);
        setFormEnd(0);
    };

    const handleCreateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCreating(true);
        setEditingCode(null);
        resetForm();
        setIsModalOpen(true);
    };

    const handleEditClick = (def: ShiftDefinition) => {
        setIsCreating(false);
        setEditingCode(def);
        setFormCode(def.code);
        setFormLabel(def.label);
        setFormDesc(def.description);
        setFormColor(def.color);
        setFormTextColor(def.textColor);
        setFormIsWork(def.isWork);
        setFormDuration(def.duration || 0);
        setFormBreak(def.breakDuration || 0);
        setFormStart(def.startHour || 0);
        setFormEnd(def.endHour || 0);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (isCreating) {
            if (!formCode || !formLabel) {
                alert("Le code et le libellé sont obligatoires.");
                return;
            }
            if (codes.some(c => c.code === formCode)) {
                alert("Ce code existe déjà.");
                return;
            }

            const newCode: ShiftDefinition = {
                code: formCode as any,
                label: formLabel,
                description: formDesc,
                color: formColor,
                textColor: formTextColor,
                isWork: formIsWork,
                duration: formIsWork ? formDuration : 0,
                breakDuration: formIsWork ? formBreak : 0,
                startHour: formIsWork ? formStart : undefined,
                endHour: formIsWork ? formEnd : undefined
            };

            setCodes([...codes, newCode]);
        } else {
            if (!editingCode) return;
            // Update local list
            setCodes(prev => prev.map(c => c.code === editingCode.code ? {
                ...c,
                label: formLabel,
                description: formDesc,
                color: formColor,
                textColor: formTextColor,
                isWork: formIsWork,
                duration: formIsWork ? formDuration : 0,
                breakDuration: formIsWork ? formBreak : 0,
                startHour: formIsWork ? formStart : undefined,
                endHour: formIsWork ? formEnd : undefined
            } : c));
        }

        setIsModalOpen(false);
        setEditingCode(null);
        setIsCreating(false);
        alert(isCreating ? "Nouveau code créé." : "Modifications enregistrées.");
    };

    const handleDelete = (code: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le code "${code}" ?\nAttention : Cela peut impacter l'historique des plannings.`)) {
            setCodes(prev => prev.filter(c => c.code !== code));
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[800px]' : 'h-16'}`}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    <div className="bg-teal-100 p-2 rounded-lg text-teal-700"><Palette className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Codes Horaires & Absences</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCreateClick}
                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-100 shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nouveau Code
                    </button>
                    <div className="text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-0 ${!isExpanded && 'hidden'}`}>
                <div className="p-4 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Ces codes sont utilisés pour la génération du planning et le calcul des heures. Les modifications impactent tout l'historique.</span>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 w-20 text-center">Code</th>
                            <th className="px-6 py-3">Libellé & Description</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Horaires</th>
                            <th className="px-6 py-3 w-24 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {codes.map(def => (
                            <tr key={def.code} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 text-center">
                                    <div className={`w-10 h-8 flex items-center justify-center rounded font-bold text-xs shadow-sm ${def.color} ${def.textColor}`}>
                                        {def.code}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{def.label}</div>
                                    <div className="text-xs text-slate-500">{def.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {def.isWork ? (
                                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-bold">TRAVAIL</span>
                                    ) : (
                                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-bold">ABSENCE / REPOS</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {def.isWork && def.duration ? (
                                        <div className="flex flex-col text-xs text-slate-600">
                                            <div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {def.duration}h (Pause: {def.breakDuration}h)</div>
                                            {def.startHour && <div>Plage: {def.startHour}h - {def.endHour}h</div>}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEditClick(def)}
                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(def.code)}
                                            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL EDIT / CREATE */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                {isCreating ? <Plus className="w-5 h-5 text-blue-600"/> : <Edit2 className="w-5 h-5 text-blue-600"/>}
                                {isCreating ? 'Créer un nouveau Code' : `Modifier : ${editingCode?.code}`}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code (ex: CM)</label>
                                    <input 
                                        type="text" 
                                        value={formCode} 
                                        onChange={e => setFormCode(e.target.value.toUpperCase())} 
                                        className="w-full p-2 border rounded font-bold uppercase"
                                        disabled={!isCreating}
                                        maxLength={5}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type d'activité</label>
                                    <select 
                                        value={formIsWork ? 'WORK' : 'ABSENCE'} 
                                        onChange={e => setFormIsWork(e.target.value === 'WORK')}
                                        className="w-full p-2 border rounded bg-white"
                                    >
                                        <option value="ABSENCE">Absence / Repos</option>
                                        <option value="WORK">Travail / Poste</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Libellé (ex: Congé Maternité)</label>
                                <input type="text" value={formLabel} onChange={e => setFormLabel(e.target.value)} className="w-full p-2 border rounded"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full p-2 border rounded"/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Couleur Fond (Tailwind)</label>
                                    <input type="text" value={formColor} onChange={e => setFormColor(e.target.value)} className="w-full p-2 border rounded font-mono text-xs" placeholder="bg-blue-200"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Couleur Texte (Tailwind)</label>
                                    <input type="text" value={formTextColor} onChange={e => setFormTextColor(e.target.value)} className="w-full p-2 border rounded font-mono text-xs" placeholder="text-blue-900"/>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-center">
                                <div className={`w-16 h-10 flex items-center justify-center rounded font-bold text-sm shadow-sm ${formColor} ${formTextColor}`}>
                                    {formCode || 'APERÇU'}
                                </div>
                            </div>
                            
                            {formIsWork && (
                                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                                    <div className="col-span-2 text-xs font-bold text-blue-600 mb-1 border-b border-blue-200 pb-1">Paramètres Horaires</div>
                                    <div>
                                        <label className="block text-[10px] uppercase text-slate-500">Durée Totale (h)</label>
                                        <input type="number" step="0.5" value={formDuration} onChange={e => setFormDuration(parseFloat(e.target.value))} className="w-full p-1 border rounded"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase text-slate-500">Dont Pause (h)</label>
                                        <input type="number" step="0.5" value={formBreak} onChange={e => setFormBreak(parseFloat(e.target.value))} className="w-full p-1 border rounded"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase text-slate-500">Début (ex: 7.5 pour 7h30)</label>
                                        <input type="number" step="0.5" value={formStart} onChange={e => setFormStart(parseFloat(e.target.value))} className="w-full p-1 border rounded"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase text-slate-500">Fin (ex: 15.0 pour 15h)</label>
                                        <input type="number" step="0.5" value={formEnd} onChange={e => setFormEnd(parseFloat(e.target.value))} className="w-full p-1 border rounded"/>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">Annuler</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium flex items-center gap-2">
                                <Save className="w-4 h-4"/> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
