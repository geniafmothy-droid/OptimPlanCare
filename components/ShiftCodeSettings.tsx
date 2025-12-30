
import React, { useState, useEffect, useMemo } from 'react';
import { ShiftDefinition, Service } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Palette, Edit2, ChevronDown, ChevronUp, Clock, AlertTriangle, X, Check, Trash2, Save, Plus, Filter, Briefcase, Umbrella, Store } from 'lucide-react';
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

export const ShiftCodeSettings: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [codes, setCodes] = useState<ShiftDefinition[]>(Object.values(SHIFT_TYPES));
    const [services, setServices] = useState<Service[]>([]);
    
    // Filters
    const [filterType, setFilterType] = useState<'ALL' | 'WORK' | 'ABSENCE'>('ALL');

    const [editingCode, setEditingCode] = useState<ShiftDefinition | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

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
    const [formServiceId, setFormServiceId] = useState('');

    useEffect(() => {
        const loadServices = async () => {
            const s = await db.fetchServices();
            setServices(s);
        };
        loadServices();
    }, []);

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
        setFormServiceId('');
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
        setFormServiceId(def.serviceId || '');
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
                endHour: formIsWork ? formEnd : undefined,
                serviceId: formServiceId || undefined
            };

            setCodes([...codes, newCode]);
        } else {
            if (!editingCode) return;
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
                endHour: formIsWork ? formEnd : undefined,
                serviceId: formServiceId || undefined
            } : c));
        }

        setIsModalOpen(false);
        setEditingCode(null);
        setIsCreating(false);
    };

    const handleDelete = (code: string) => {
        if (confirm(`Supprimer le code "${code}" ?`)) {
            setCodes(prev => prev.filter(c => c.code !== code));
        }
    };

    const filteredCodes = useMemo(() => {
        return codes.filter(c => {
            if (filterType === 'ALL') return true;
            if (filterType === 'WORK') return c.isWork;
            if (filterType === 'ABSENCE') return !c.isWork;
            return true;
        });
    }, [codes, filterType]);

    return (
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[1000px]' : 'h-16'}`}>
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
                {/* FILTRES BAR */}
                <div className="p-4 bg-slate-50 border-b flex flex-wrap items-center gap-4 justify-between">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => setFilterType('ALL')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${filterType === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Tout
                        </button>
                        <button 
                            onClick={() => setFilterType('WORK')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${filterType === 'WORK' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Briefcase className="w-3.5 h-3.5" /> Travail / Poste
                        </button>
                        <button 
                            onClick={() => setFilterType('ABSENCE')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${filterType === 'ABSENCE' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Umbrella className="w-3.5 h-3.5" /> Absence / Repos
                        </button>
                    </div>
                    <div className="text-xs text-slate-400 italic">
                        {filteredCodes.length} codes affichés
                    </div>
                </div>

                <div className="p-4 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-800 flex gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Ces codes sont utilisés pour la génération du planning et le calcul des heures. Les codes peuvent être restreints à un service.</span>
                </div>

                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 w-20 text-center">Code</th>
                            <th className="px-6 py-3">Libellé & Service</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Horaires</th>
                            <th className="px-6 py-3 w-24 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredCodes.map(def => (
                            <tr key={def.code} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 text-center">
                                    <div className={`w-10 h-8 flex items-center justify-center rounded font-bold text-xs shadow-sm ${def.color} ${def.textColor}`}>
                                        {def.code}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{def.label}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="text-[10px] text-slate-400 line-clamp-1">{def.description}</div>
                                        {def.serviceId && (
                                            <div className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                                                <Store className="w-2.5 h-2.5" />
                                                {services.find(s => s.id === def.serviceId)?.name || 'Service inconnu'}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {def.isWork ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-bold border border-green-200">TRAVAIL</span>
                                    ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">ABSENCE</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {def.isWork && def.duration ? (
                                        <div className="flex flex-col text-xs text-slate-600">
                                            <div className="flex items-center gap-1 font-medium"><Clock className="w-3 h-3 text-slate-400"/> {def.duration}h</div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditClick(def)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(def.code)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredCodes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic bg-white">
                                    Aucun code ne correspond à ce filtre.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                {isCreating ? <Plus className="w-5 h-5 text-blue-600"/> : <Edit2 className="w-5 h-5 text-blue-600"/>}
                                {isCreating ? 'Créer un nouveau Code' : `Modifier : ${editingCode?.code}`}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                                    <input type="text" value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())} className="w-full p-2 border rounded font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none" disabled={!isCreating} maxLength={5} placeholder="ex: IT"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                    <select value={formIsWork ? 'WORK' : 'ABSENCE'} onChange={e => setFormIsWork(e.target.value === 'WORK')} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="ABSENCE">Absence / Repos</option>
                                        <option value="WORK">Travail / Poste</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Libellé</label>
                                    <input type="text" value={formLabel} onChange={e => setFormLabel(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: Inter-Tranche"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5"><Store className="w-3 h-3 text-blue-500" /> Service Affecté</label>
                                    <select 
                                        value={formServiceId} 
                                        onChange={e => setFormServiceId(e.target.value)} 
                                        className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="">Tous les services</option>
                                        {services.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description d'affichage</label>
                                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="ex: 06h30 - 18h30"/>
                            </div>

                            {/* NUANCIER COULEURS */}
                            <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Couleur de fond</label>
                                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                                        {PRESET_BG_COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                onClick={() => setFormColor(c)}
                                                className={`w-8 h-8 rounded border-2 transition-all ${c} ${formColor === c ? 'border-blue-600 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Couleur du texte</label>
                                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                                        {PRESET_TEXT_COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                onClick={() => setFormTextColor(c)}
                                                className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-all bg-white ${c} ${formTextColor === c ? 'border-blue-600 scale-110 shadow-md' : 'border-slate-200 hover:scale-105'}`}
                                                title={c}
                                            >
                                                Ab
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Aperçu :</span>
                                    <div className={`px-4 py-2 rounded font-bold text-sm shadow-sm min-w-[60px] text-center ${formColor} ${formTextColor}`}>
                                        {formCode || 'ABC'}
                                    </div>
                                </div>
                            </div>
                            
                            {formIsWork && (
                                <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded border border-blue-100">
                                    <div className="col-span-2 text-[10px] font-bold text-blue-600 mb-1 border-b border-blue-200 pb-1 uppercase tracking-wider">Paramètres Horaires (Calcul Heures)</div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Durée Présence (h)</label>
                                        <input type="number" step="0.5" value={formDuration} onChange={e => setFormDuration(parseFloat(e.target.value))} className="w-full p-1.5 border rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Temps de Pause (h)</label>
                                        <input type="number" step="0.5" value={formBreak} onChange={e => setFormBreak(parseFloat(e.target.value))} className="w-full p-1.5 border rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Heure de Début</label>
                                        <input type="number" step="0.5" value={formStart} onChange={e => setFormStart(parseFloat(e.target.value))} className="w-full p-1.5 border rounded text-sm" placeholder="ex: 7.5 pour 07:30"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Heure de Fin</label>
                                        <input type="number" step="0.5" value={formEnd} onChange={e => setFormEnd(parseFloat(e.target.value))} className="w-full p-1.5 border rounded text-sm" placeholder="ex: 15 pour 15:00"/>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium transition-colors">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
                                <Save className="w-4 h-4"/> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
