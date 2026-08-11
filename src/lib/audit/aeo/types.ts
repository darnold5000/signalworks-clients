export type AeoCategoryKey = "business_identity" | "services_offerings" | "location_service_area" | "structured_data" | "answer_friendly_content" | "expertise_trust" | "crawlability" | "content_structure";

export type AeoCategoryResult = { key: AeoCategoryKey; label: string; score: number; passed: number; failed: number; evidence: string[] };
export type AeoQuestionResult = { question: string; status: "answered" | "partial" | "not_answered" };
export type AeoSnapshot = { score: number; categories: AeoCategoryResult[]; questionCoverage: { answered: number; partial: number; notAnswered: number; total: number; questions: AeoQuestionResult[] }; findings: Array<{ title: string; summary: string; status: "pass" | "warning" }>; recommendations: Array<{ title: string; description: string }>; evidence: Record<string, unknown>; checkedAt: string };
