
import React, { useState } from 'react';
import { ValidationRule } from '../types';
import { DEFAULT_RULES } from '../constants';
import { ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Save } from 'lucide-react';

export const RuleSettings: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [rules, setRules] = useState<ValidationRule[]>(DEFAULT_RULES);
    const [isSaved, setIsSaved] = useState(false);

    const toggleActive = (id: string) => {
        setRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
        setIsSaved(false);
    };

    const changePriority = (id: string, prio: 'HIGH' | 'MEDIUM' | 'LOW') => {
        setRules(rules.map(r => r.id === id ? { ...r, priority: prio } : r));
        setIsSaved(false);
    };

    const handleSave = () => {
        // In a real app, save to DB/Context
        console.log("Saving rules config", rules);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const getPriorityBadge = (p: string) => {
        switch(p) {
            case 'HIGH': return <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700">HAUTE</span>;
            case 'MEDIUM': return <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 text-orange-700">MOYENNE</span>;
            case 'LOW': return <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">BASSE</span>;
            default: return null;
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[800px]' : 'h-16'}`}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-700"><ShieldAlert className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Règles Actives & Priorités</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {isSaved ? 'Enregistré' : 'Enregistrer'}
                    </button>
                    <div className="text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-0 ${!isExpanded && 'hidden'}`}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 w-16 text-center">Actif</th>
                            <th className="px-6 py-3">Règle</th>
                            <th className="px-6 py-3">Catégorie</th>
                            <th className="px-6 py-3">Priorité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rules.map(rule => (
                            <tr key={rule.id} className={`hover:bg-slate-50 transition-colors ${!rule.isActive ? 'opacity-50 grayscale' : ''}`}>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={rule.isActive} 
                                        onChange={() => toggleActive(rule.id)}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{rule.label}</div>
                                    <div className="text-xs text-slate-500">{rule.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 font-medium">
                                        {rule.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <select 
                                            value={rule.priority} 
                                            onChange={(e) => changePriority(rule.id, e.target.value as any)}
                                            className="text-xs border border-slate-200 rounded p-1 bg-white outline-none focus:border-blue-500"
                                            disabled={!rule.isActive}
                                        >
                                            <option value="HIGH">HAUTE</option>
                                            <option value="MEDIUM">MOYENNE</option>
                                            <option value="LOW">BASSE</option>
                                        </select>
                                        {getPriorityBadge(rule.priority)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
