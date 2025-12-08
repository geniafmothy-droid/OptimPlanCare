
import React, { useState } from 'react';
import { ShiftDefinition } from '../types';
import { SHIFT_TYPES } from '../constants';
import { Palette, Edit2, ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';

export const ShiftCodeSettings: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    // Convert const object to array for display (Read-Only in this demo context)
    const codes = Object.values(SHIFT_TYPES);

    return (
        <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-h-[800px]' : 'h-16'}`}>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-3">
                    <div className="bg-teal-100 p-2 rounded-lg text-teal-700"><Palette className="w-5 h-5" /></div>
                    <h3 className="text-lg font-bold text-slate-800">Codes Horaires & Absences</h3>
                </div>
                <div className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
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
                            <th className="px-6 py-3 w-20 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {codes.map(def => (
                            <tr key={def.code} className="hover:bg-slate-50 transition-colors">
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
                                    <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
