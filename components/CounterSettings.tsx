
import React, { useState } from 'react';
import { CounterRule } from '../types';
import { Calculator, Plus, Save, Trash2, HelpCircle } from 'lucide-react';

const MOCK_RULES: CounterRule[] = [
    { id: '1', label: 'Indemnité de Nuit', code: 'IND_NUIT', type: 'PREMIUM', value: 1.07, unit: 'EUROS', condition: 'Par heure travaillée entre 21h et 6h' },
    { id: '2', label: 'Indemnité Dimanche/Férié', code: 'IND_DJF', type: 'PREMIUM', value: 48, unit: 'EUROS', condition: 'Forfait pour 8h de travail le dimanche' },
    { id: '3', label: 'Temps d\'habillage', code: 'TPS_HAB', type: 'OVERTIME', value: 10, unit: 'HOURS', condition: 'Minutes ajoutées par jour travaillé' },
    { id: '4', label: 'Heures Sup. Nuit', code: 'HS_NUIT', type: 'OVERTIME', value: 25, unit: 'PERCENT', condition: 'Majoration des heures > 35h réalisées de nuit' },
];

export const CounterSettings: React.FC = () => {
    const [rules, setRules] = useState<CounterRule[]>(MOCK_RULES);
    const [isCreating, setIsCreating] = useState(false);
    
    // New Rule State
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<CounterRule['type']>('PREMIUM');
    const [newValue, setNewValue] = useState<string>('0');
    const [newUnit, setNewUnit] = useState<CounterRule['unit']>('EUROS');
    const [newCondition, setNewCondition] = useState('');

    const handleCreate = () => {
        if (!newLabel || !newCondition) return;
        
        const newRule: CounterRule = {
            id: crypto.randomUUID(),
            label: newLabel,
            code: `RULE_${Date.now()}`,
            type: newType,
            value: parseFloat(newValue),
            unit: newUnit,
            condition: newCondition
        };
        
        setRules([...rules, newRule]);
        setIsCreating(false);
        setNewLabel('');
        setNewCondition('');
        setNewValue('0');
    };

    const handleDelete = (id: string) => {
        if (confirm("Supprimer cette règle ?")) {
            setRules(rules.filter(r => r.id !== id));
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-600" />
                        Règles & Compteurs Horaires
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Définissez ici les règles de calcul pour les indemnités et compteurs spécifiques.
                    </p>
                </div>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nouvelle Règle
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                {isCreating && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                        <h4 className="font-bold text-slate-800 dark:text-white mb-4">Nouvelle Règle</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Libellé</label>
                                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Ex: Prime Dimanche" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                                <select value={newType} onChange={e => setNewType(e.target.value as any)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                    <option value="PREMIUM">Prime / Indemnité</option>
                                    <option value="OVERTIME">Heures Sup / Récup</option>
                                    <option value="DEDUCTION">Déduction</option>
                                    <option value="INFO">Information</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Valeur</label>
                                <div className="flex gap-2">
                                    <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} className="flex-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    <select value={newUnit} onChange={e => setNewUnit(e.target.value as any)} className="w-32 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                        <option value="EUROS">€</option>
                                        <option value="HOURS">Heures</option>
                                        <option value="PERCENT">%</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Condition d'application</label>
                                <input type="text" value={newCondition} onChange={e => setNewCondition(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Ex: Travail le dimanche" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">Annuler</button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Enregistrer</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rules.map(rule => (
                        <div key={rule.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group relative">
                            <button 
                                onClick={() => handleDelete(rule.id)}
                                className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            
                            <div className="flex items-start justify-between mb-2">
                                <div className={`p-2 rounded-lg ${
                                    rule.type === 'PREMIUM' ? 'bg-green-100 text-green-700' : 
                                    rule.type === 'OVERTIME' ? 'bg-purple-100 text-purple-700' :
                                    rule.type === 'DEDUCTION' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {rule.type === 'PREMIUM' ? '€' : rule.type === 'OVERTIME' ? 'H+' : rule.type === 'DEDUCTION' ? '-' : 'i'}
                                </div>
                                <span className="text-xs font-mono text-slate-400">{rule.code}</span>
                            </div>
                            
                            <h4 className="font-bold text-slate-800 dark:text-white mb-1">{rule.label}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 min-h-[32px]">{rule.condition}</p>
                            
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-400 uppercase">Valeur</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {rule.value} 
                                    <span className="ml-1 text-xs text-slate-500 font-normal">
                                        {rule.unit === 'EUROS' ? '€' : rule.unit === 'HOURS' ? 'h' : '%'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
