import React, { useState } from 'react';
import { Employee, ConstraintViolation, ServiceConfig } from '../types';
// Added Users to the lucide-react imports to fix 'Cannot find name Users' error.
import { AlertTriangle, CheckCircle, XCircle, Info, Baby, BookOpen, X, CalendarDays, Scale, Users } from 'lucide-react';
import { checkConstraints } from '../utils/validation';

interface ConstraintCheckerProps {
  employees: Employee[];
  startDate: Date;
  days: number;
  serviceConfig?: ServiceConfig;
}

export const ConstraintChecker: React.FC<ConstraintCheckerProps> = ({ employees, startDate, days, serviceConfig }) => {
  const [showRulesModal, setShowRulesModal] = useState(false);
  
  const violations: ConstraintViolation[] = React.useMemo(() => {
    return checkConstraints(employees, startDate, days, serviceConfig);
  }, [employees, startDate, days, serviceConfig]);

  const isMaternity = serviceConfig?.fteConstraintMode === 'MATERNITY_STANDARD';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow h-full flex flex-col border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 rounded-t-lg">
        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
           <AlertTriangle className="w-5 h-5 text-orange-500" />
           Contrôle Métier
        </h3>
        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded">
          {violations.length} Alertes
        </span>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-300 border-b border-blue-100 dark:border-blue-900 flex flex-col gap-2">
        <div className="flex justify-between items-start">
            <div className="flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <p className="font-semibold flex items-center gap-1">
                    Règles actives {isMaternity && <span className="flex items-center gap-1 text-pink-600 dark:text-pink-400 font-bold">(<Baby className="w-3 h-3"/> Maternité)</span>} :
                </p>
            </div>
            {isMaternity && (
                <button 
                    onClick={() => setShowRulesModal(true)}
                    className="text-pink-700 dark:text-pink-400 hover:underline flex items-center gap-1 font-bold animate-pulse"
                >
                    <BookOpen className="w-3 h-3" /> Détails
                </button>
            )}
        </div>
        <ul className="list-disc pl-5 space-y-0.5 opacity-80">
            <li>48h max / 7 jours glissants</li>
            <li>Repos post-nuit obligatoire</li>
            {isMaternity ? (
                <>
                    <li className="text-pink-700 dark:text-pink-400">100% : 1 Week-end sur 2</li>
                    <li className="text-pink-700 dark:text-pink-400">80% : Cycle WE / Nuit Ven alterné</li>
                </>
            ) : (
                <>
                    <li>Max 1 samedi sur 2</li>
                    <li>Cibles : 4 IT, 1 T5, 1 T6</li>
                </>
            )}
        </ul>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
            <p>Aucune anomalie détectée</p>
          </div>
        ) : (
          violations.slice(0, 50).map((v, idx) => ( 
            <div key={idx} className={`p-3 rounded border text-sm flex items-start gap-3 transition-all hover:shadow-sm ${
              v.severity === 'error' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50'
            }`}>
              <XCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${v.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <div className={`font-semibold ${v.severity === 'error' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {v.employeeId === 'ALL' ? 'Effectif Insuffisant' : 'Règle Individuelle'}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">{v.message}</div>
                {v.employeeId === 'ALL' && (
                    <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase">{v.date}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MATERNITY RULES DETAIL MODAL */}
      {showRulesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-xl">
                              <Baby className="w-6 h-6" />
                          </div>
                          <div>
                              <h3 className="text-xl font-bold">Règles de Génération : Maternité</h3>
                              <p className="text-pink-100 text-xs">Standardisation des cycles et parité CPF</p>
                          </div>
                      </div>
                      <button onClick={() => setShowRulesModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8">
                      {/* Section 1: Staffing Targets */}
                      <section>
                          <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white mb-3 border-b dark:border-slate-700 pb-1">
                              <Users className="w-4 h-4 text-pink-500" /> Effectifs Cibles Quotidiens
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border dark:border-slate-700">
                                  <div className="text-xs font-bold text-slate-400 uppercase">Jour (IT)</div>
                                  <div className="text-2xl font-bold text-slate-800 dark:text-white">3 Agents</div>
                                  <div className="text-[10px] text-slate-500 mt-1">06h30 - 18h30</div>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border dark:border-slate-700">
                                  <div className="text-xs font-bold text-slate-400 uppercase">Soir/Nuit (S)</div>
                                  <div className="text-2xl font-bold text-slate-800 dark:text-white">1 Agent</div>
                                  <div className="text-[10px] text-slate-500 mt-1">17h30 - 00h00</div>
                              </div>
                          </div>
                      </section>

                      {/* Section 2: CPF Parity Logic */}
                      <section>
                          <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white mb-3 border-b dark:border-slate-700 pb-1">
                              <Scale className="w-4 h-4 text-purple-500" /> Logique de Parité CPF
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                              Le moteur alterne les besoins en "CPF Matin" et "CPF Coupure" selon la parité de la semaine ISO pour garantir une équité de charge.
                          </p>
                          <div className="space-y-2">
                              <div className="flex items-center gap-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-100 dark:border-indigo-900/50">
                                  <div className="w-24 text-xs font-bold text-indigo-700 dark:text-indigo-400">Semaine Impaire</div>
                                  <div className="flex-1 text-xs dark:text-slate-300">
                                      <span className="font-bold">Mer & Ven :</span> 2x CPF M, 2x CPF C
                                  </div>
                              </div>
                              <div className="flex items-center gap-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-100 dark:border-purple-900/50">
                                  <div className="w-24 text-xs font-bold text-purple-700 dark:text-purple-400">Semaine Paire</div>
                                  <div className="flex-1 text-xs dark:text-slate-300">
                                      <span className="font-bold">Mer & Ven :</span> 1x CPF M, 1x CPF C
                                  </div>
                              </div>
                          </div>
                      </section>

                      {/* Section 3: Individual Cycles */}
                      <section>
                          <h4 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white mb-3 border-b dark:border-slate-700 pb-1">
                              <CalendarDays className="w-4 h-4 text-blue-500" /> Cycles par Quotité (FTE)
                          </h4>
                          <div className="space-y-4">
                              <div className="flex gap-4">
                                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-600 shrink-0">100</div>
                                  <div>
                                      <div className="font-bold text-sm dark:text-white">Règle du Week-end 1/2</div>
                                      <p className="text-xs text-slate-500">Affectation impérative d'un week-end sur deux (Samedi & Dimanche en Repos Hebdo alterné).</p>
                                  </div>
                              </div>
                              <div className="flex gap-4">
                                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center font-bold text-amber-600 shrink-0">80</div>
                                  <div>
                                      <div className="font-bold text-sm dark:text-white">Cycle de Rotation Stricte</div>
                                      <p className="text-xs text-slate-500 mb-2">Le moteur applique une séquence tournante pour garantir le temps partiel :</p>
                                      <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">WE Travaillé</span>
                                          <ArrowRightTiny />
                                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">Repos (RH)</span>
                                          <ArrowRightTiny />
                                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">Nuit Vendredi (S)</span>
                                          <ArrowRightTiny />
                                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">Repos (RH)</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex justify-end">
                      <button 
                          onClick={() => setShowRulesModal(false)}
                          className="px-6 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                      >
                          Compris
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const ArrowRightTiny = () => (
    <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
);
