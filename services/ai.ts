
import { GoogleGenAI } from "@google/genai";
import { Employee, ConstraintViolation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIAnalysisResult {
    summary: string;
    suggestions: string[];
    riskScore: number; // 0-100
}

export const analyzePlanningWithAI = async (
    employees: Employee[], 
    violations: ConstraintViolation[],
    serviceName: string
): Promise<AIAnalysisResult> => {
    try {
        const violationSummary = violations.map(v => `- ${v.date}: ${v.message} (${v.severity})`).join('\n');
        const staffCount = employees.length;
        
        const prompt = `
            En tant qu'expert en gestion de planning hospitalier, analyse ce planning pour le service "${serviceName}".
            Effectif : ${staffCount} agents.
            Violations détectées par le moteur de règles :
            ${violationSummary || "Aucune violation majeure."}

            Donne ton avis sur :
            1. L'équité de la charge de travail entre les agents.
            2. Le niveau de fatigue potentiel (enchaînements).
            3. Des suggestions concrètes pour améliorer le planning.

            Réponds au format JSON avec les clés suivantes :
            - summary: un paragraphe de synthèse.
            - suggestions: un tableau de chaînes de caractères.
            - riskScore: un score de 0 (parfait) à 100 (critique).
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            summary: result.summary || "Analyse indisponible.",
            suggestions: result.suggestions || [],
            riskScore: result.riskScore || 0
        };
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return {
            summary: "L'IA n'a pas pu analyser le planning pour le moment.",
            suggestions: ["Vérifiez manuellement les repos post-nuit.", "Assurez-vous de l'équité des week-ends."],
            riskScore: 50
        };
    }
};
