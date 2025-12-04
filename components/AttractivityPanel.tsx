
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Heart, TrendingUp, Users, Smile, Frown, Meh, Award } from 'lucide-react';

export const AttractivityPanel: React.FC = () => {
    // MOCK DATA for Demo
    const surveyData = [
        { period: 'M+1', satisfaction: 65, workload: 70, balance: 60 },
        { period: 'M+3', satisfaction: 72, workload: 75, balance: 68 },
        { period: 'M+6', satisfaction: 78, workload: 80, balance: 75 },
        { period: 'M+12', satisfaction: 82, workload: 85, balance: 80 },
    ];

    const radarData = [
        { subject: 'Respect Planning', A: 90, fullMark: 100 },
        { subject: 'Équité W-E', A: 85, fullMark: 100 },
        { subject: 'Absence Imprévue', A: 60, fullMark: 100 },
        { subject: 'Satisfaction', A: 80, fullMark: 100 },
        { subject: 'Stabilité', A: 95, fullMark: 100 },
    ];

    const globalScore = 82; // Calculated Mock

    return (
        <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Heart className="w-6 h-6 text-pink-600" /> Attractivité, Fidélisation & QVT
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Score Card */}
                <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">Score d'Attractivité</h3>
                        <Award className="w-8 h-8 opacity-80" />
                    </div>
                    <div className="text-5xl font-bold mb-2">{globalScore}/100</div>
                    <p className="text-pink-100 text-sm">Basé sur le respect des règles, l'équité et les enquêtes.</p>
                </div>

                {/* Equity Card */}
                <div className="bg-white rounded-xl p-6 shadow border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" /> Équité de Charge
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Variance Samedis</span>
                                <span className="font-bold text-green-600">Faible (0.4)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[10%]"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Variance Horaires Nuit</span>
                                <span className="font-bold text-amber-600">Moyenne (1.2)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 w-[40%]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Survey Snapshot */}
                <div className="bg-white rounded-xl p-6 shadow border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Smile className="w-5 h-5 text-green-600" /> Derniers Retours
                    </h3>
                    <div className="flex gap-4 items-center justify-center h-full pb-6">
                        <div className="text-center">
                            <Smile className="w-10 h-10 text-green-500 mx-auto mb-1" />
                            <div className="font-bold text-xl">65%</div>
                            <div className="text-xs text-slate-500">Satisfaits</div>
                        </div>
                        <div className="text-center">
                            <Meh className="w-10 h-10 text-amber-500 mx-auto mb-1" />
                            <div className="font-bold text-xl">25%</div>
                            <div className="text-xs text-slate-500">Neutres</div>
                        </div>
                        <div className="text-center">
                            <Frown className="w-10 h-10 text-red-500 mx-auto mb-1" />
                            <div className="font-bold text-xl">10%</div>
                            <div className="text-xs text-slate-500">Insatisfaits</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Evolution Enquête */}
                <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-6">Évolution Satisfaction (Enquêtes)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={surveyData}>
                                <XAxis dataKey="period" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="satisfaction" fill="#db2777" name="Satisfaction Globale" radius={[4,4,0,0]} />
                                <Bar dataKey="balance" fill="#8b5cf6" name="Équilibre Vie Pro/Perso" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Radar QVT */}
                <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-6">Indicateurs QVT</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis />
                                <Radar name="QVT" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
