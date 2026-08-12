import { extractCanonicalUrl, extractHeadings, extractJsonLdBlocks, extractLinks, extractMetaContent, extractTitle, stripTags } from "@/lib/audit/collectors/shared/html-parse";
import { selectSearchProfile } from "@/lib/audit/search-profiles";
import type { AeoCategoryKey, AeoCategoryResult, AeoQuestionResult, AeoSnapshot } from "./types";

export const AEO_WEIGHTS: Record<AeoCategoryKey, number> = { business_identity: 15, services_offerings: 15, location_service_area: 10, structured_data: 15, answer_friendly_content: 20, expertise_trust: 10, crawlability: 5, content_structure: 10 };
const LABELS: Record<AeoCategoryKey, string> = { business_identity: "Business identity", services_offerings: "Services & offerings", location_service_area: "Location & service area", structured_data: "Structured data", answer_friendly_content: "Answer-friendly content", expertise_trust: "Expertise & trust", crawlability: "Crawlability & discoverability", content_structure: "Content structure" };
const QUESTIONS: Record<string, string[]> = {
  financial_advisor: ["What services do you provide?", "Who do you work with?", "Do you offer retirement planning?", "How does financial planning work?", "How do I get started?", "Where are you located?", "What credentials do your advisors have?"],
  dentist: ["Are you accepting new patients?", "What services do you provide?", "Do you accept insurance?", "How do I schedule?", "What should a new patient expect?", "Where are you located?"],
  fitness_gym: ["What types of training do you offer?", "Who can join?", "How much does training cost?", "How do I book?", "What are your hours?", "Where are you located?"],
  sports_training: ["What types of training do you offer?", "Who do you train?", "How do I book?", "Where are you located?", "What should I expect?"],
  salon: ["What services do you provide?", "How do I book?", "How much do services cost?", "Where are you located?"],
  restaurant: ["What do you serve?", "What are your hours?", "Where are you located?", "How do I contact you?"],
  coffee_shop: ["What do you serve?", "What are your hours?", "Where are you located?", "How do I contact you?"],
  professional_services: ["What services do you provide?", "Who do you work with?", "How do I get started?", "Where are you located?", "What should I expect?"],
  generic_local_business: ["What services do you provide?", "Who do you serve?", "How do I get started?", "Where are you located?", "What are your hours?"]
};

function textOf(html: string) { return stripTags(html).replace(/\s+/g, " ").trim(); }
function has(html: string, pattern: RegExp) { return pattern.test(html) || pattern.test(textOf(html)); }
function schemaNodes(html: string) { return extractJsonLdBlocks(html).flatMap((block) => { if (!block || typeof block !== "object") return []; const value = block as Record<string, unknown>; return Array.isArray(value["@graph"]) ? value["@graph"].filter((node): node is Record<string, unknown> => Boolean(node && typeof node === "object")) : [value]; }); }
function schemaTypes(nodes: Record<string, unknown>[]) { return nodes.flatMap((node) => Array.isArray(node["@type"]) ? node["@type"].filter((type): type is string => typeof type === "string") : typeof node["@type"] === "string" ? [node["@type"]] : []); }
function scoreCategory(key: AeoCategoryKey, checks: Array<{ ok: boolean; evidence: string }>): AeoCategoryResult { const passed = checks.filter((check) => check.ok).length; return { key, label: LABELS[key], score: Math.round((passed / Math.max(1, checks.length)) * 100), passed, failed: checks.length - passed, evidence: checks.map((check) => `${check.ok ? "Pass" : "Needs attention"}: ${check.evidence}`) }; }
function checkEvidence(ok: boolean, positive: string, negative: string) { return ok ? positive : negative; }

export function analyzeAeoReadiness(input: { html: string; businessName?: string | null; market?: string | null }): AeoSnapshot {
  const html = input.html;
  const visible = textOf(html);
  const headings = [...extractHeadings(html, 1), ...extractHeadings(html, 2), ...extractHeadings(html, 3)];
  const links = extractLinks(html);
  const nodes = schemaNodes(html);
  const types = schemaTypes(nodes);
  const profile = selectSearchProfile({ businessName: input.businessName ?? null, services: headings, content: visible });
  const phone = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(visible);
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(visible);
  const hasAddress = /\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|indianapolis|indiana|in\s*\d{5})\b/i.test(visible);
  const businessNamePresent = Boolean(input.businessName || nodes.some((node) => typeof node.name === "string"));
  const entityTypePresent = Boolean(types.some((type) => /Organization|Business|Service|Person/.test(type)));
  const aboutPresent = has(html, /about|our story|who we are/i);
  const identity = scoreCategory("business_identity", [{ ok: businessNamePresent, evidence: checkEvidence(businessNamePresent, "Business name is stated in the page or structured data.", "Business name was not clearly detected in the page or structured data.") }, { ok: entityTypePresent, evidence: checkEvidence(entityTypePresent, "A recognizable business entity type is present.", "A recognizable business entity type was not detected.") }, { ok: phone, evidence: checkEvidence(phone, "Phone information is visible.", "Phone information was not detected.") }, { ok: email, evidence: checkEvidence(email, "Email information is visible.", "Email information was not detected.") }, { ok: aboutPresent, evidence: checkEvidence(aboutPresent, "About/company information is available.", "About/company information was not detected.") }]);
  const serviceTerms = headings.filter((heading) => /service|solution|training|planning|management|advisor|dentist|fitness|restaurant|coffee|salon|consult/i.test(heading));
  const multipleServices = serviceTerms.length >= 2;
  const serviceLinksPresent = links.some((link) => /service|solution|training|program|offer/i.test(`${link.href} ${link.text}`));
  const enoughServiceText = visible.length >= 800;
  const services = scoreCategory("services_offerings", [{ ok: serviceTerms.length >= 1, evidence: `${serviceTerms.length} service-oriented heading(s) detected.` }, { ok: multipleServices, evidence: checkEvidence(multipleServices, "More than one service or offering is described.", "Fewer than two distinct service or offering descriptions were detected.") }, { ok: serviceLinksPresent, evidence: checkEvidence(serviceLinksPresent, "Service-related HTML links are present.", "Service-related HTML links were not detected.") }, { ok: enoughServiceText, evidence: checkEvidence(enoughServiceText, "The page contains enough visible text to explain offerings.", "The page does not contain enough visible text to explain offerings clearly.") }]);
  const marketPresent = Boolean(input.market && visible.toLowerCase().includes(input.market.split(",")[0].trim().toLowerCase()));
  const locationSchemaPresent = types.some((type) => /LocalBusiness|ProfessionalService|FinancialService|Restaurant|Cafe|Dentist/.test(type));
  const locationLinkPresent = links.some((link) => /location|contact|directions|service-area/i.test(`${link.href} ${link.text}`));
  const location = scoreCategory("location_service_area", [{ ok: hasAddress, evidence: checkEvidence(hasAddress, "Location/address language appears on the website.", "Website location evidence was not detected.") }, { ok: marketPresent, evidence: checkEvidence(marketPresent, "The entered market appears in website content.", "The entered market was not clearly found in website content.") }, { ok: locationSchemaPresent, evidence: checkEvidence(locationSchemaPresent, "Location-capable structured data is present.", "Location-capable structured data was not detected.") }, { ok: locationLinkPresent, evidence: checkEvidence(locationLinkPresent, "A location, contact, or service-area link is present.", "A clear location, contact, or service-area link was not detected.") }]);
  const usefulTypes = ["Organization", "LocalBusiness", "ProfessionalService", "FinancialService", "Dentist", "HealthAndBeautyBusiness", "SportsActivityLocation", "Restaurant", "CafeOrCoffeeShop", "Person", "Service", "Product", "Offer", "FAQPage", "Article", "BreadcrumbList"];
  const usefulSchemaPresent = types.some((type) => usefulTypes.includes(type));
  const entitySchemaPresent = types.some((type) => /Organization|LocalBusiness|ProfessionalService|FinancialService|Restaurant|Dentist/.test(type));
  const serviceSchemaPresent = types.includes("Service") || types.includes("Product") || types.includes("Offer");
  const answerSchemaPresent = types.includes("FAQPage") || types.includes("Article");
  const structured = scoreCategory("structured_data", [{ ok: nodes.length > 0, evidence: `${nodes.length} JSON-LD node(s) detected.` }, { ok: usefulSchemaPresent, evidence: checkEvidence(usefulSchemaPresent, "Applicable business/content schema type detected.", "No applicable business/content schema type was detected.") }, { ok: entitySchemaPresent, evidence: checkEvidence(entitySchemaPresent, "An entity schema type is present.", "An entity schema type was not detected.") }, { ok: serviceSchemaPresent, evidence: checkEvidence(serviceSchemaPresent, "Service or offering structured data detected.", "Service or offering structured data was not detected.") }, { ok: answerSchemaPresent, evidence: checkEvidence(answerSchemaPresent, "Answer/content structured data detected.", "Answer/content structured data was not detected.") }]);
  const profileQuestions = QUESTIONS[profile.key] ?? QUESTIONS.generic_local_business;
  const faqText = nodes.filter((node) => schemaTypes([node]).includes("FAQPage")).map((node) => JSON.stringify(node)).join(" ");
  const questions: AeoQuestionResult[] = profileQuestions.map((question) => { const terms = question.toLowerCase().replace(/[?]/g, "").split(/\s+/).filter((term) => term.length > 3).slice(0, 4); const matches = terms.filter((term) => visible.toLowerCase().includes(term)).length; const direct = new RegExp(`<h[1-6][^>]*>[^<]*(?:${terms.join("|")})[^<]*<\\/h[1-6]>[\\s\\S]{0,800}`, "i").test(html) || terms.filter((term) => faqText.toLowerCase().includes(term)).length >= 2; return { question, status: direct && matches >= 2 ? "answered" : matches >= 2 ? "partial" : "not_answered" }; });
  const coverage = { answered: questions.filter((question) => question.status === "answered").length, partial: questions.filter((question) => question.status === "partial").length, notAnswered: questions.filter((question) => question.status === "not_answered").length, total: questions.length, questions };
  const questionStructure = types.includes("FAQPage") || /<h[1-6][^>]*>[^<]*\?[^<]*<\/h[1-6]>/i.test(html);
  const answerCoverage = coverage.answered >= Math.ceil(coverage.total * 0.5);
  const descriptiveHeadings = headings.length >= 3;
  const practicalInfo = /schedule|book|pricing|cost|hours|process|expect/i.test(visible);
  const answer = scoreCategory("answer_friendly_content", [{ ok: questionStructure, evidence: checkEvidence(questionStructure, "Question-oriented content or FAQ structure detected.", "Question-oriented content or FAQ structure was not detected.") }, { ok: answerCoverage, evidence: `${coverage.answered} of ${coverage.total} common questions appear clearly answered.` }, { ok: descriptiveHeadings, evidence: checkEvidence(descriptiveHeadings, "Content uses descriptive headings.", "Descriptive headings were not sufficiently detected.") }, { ok: practicalInfo, evidence: checkEvidence(practicalInfo, "Practical customer information is present.", "Practical customer information was not clearly detected.") }]);
  const aboutTrust = has(html, /about|our story|team|founder/i);
  const expertiseTrust = has(html, /credential|certif|licensed|experience|years|professional/i);
  const customerProof = has(html, /testimonial|review|case stud|portfolio/i);
  const privacyInfo = has(html, /privacy/i);
  const authorship = profile.key === "generic_local_business" || !/financial|dentist|medical|legal|therapy/i.test(visible) || has(html, /author|written by|updated/i);
  const trust = scoreCategory("expertise_trust", [{ ok: aboutTrust, evidence: checkEvidence(aboutTrust, "About, team, or organization information detected.", "About, team, or organization information was not detected.") }, { ok: expertiseTrust, evidence: checkEvidence(expertiseTrust, "Experience, credential, or professional background language detected.", "Experience, credential, or professional background language was not detected.") }, { ok: customerProof, evidence: checkEvidence(customerProof, "Customer proof or work examples detected.", "Customer proof or work examples were not detected.") }, { ok: privacyInfo, evidence: checkEvidence(privacyInfo, "Privacy information is linked or mentioned.", "Privacy information was not detected.") }, { ok: authorship, evidence: checkEvidence(authorship, "Industry-appropriate authorship signals evaluated.", "Industry-appropriate authorship signals were not clearly detected.") }]);
  const canonicalPresent = Boolean(extractCanonicalUrl(html));
  const titlePresent = Boolean(extractTitle(html));
  const metaDescriptionPresent = Boolean(extractMetaContent(html, "description"));
  const crawl = scoreCategory("crawlability", [{ ok: canonicalPresent, evidence: checkEvidence(canonicalPresent, "Canonical URL detected.", "Canonical URL was not detected.") }, { ok: titlePresent, evidence: checkEvidence(titlePresent, "Page title detected.", "Page title was not detected.") }, { ok: metaDescriptionPresent, evidence: checkEvidence(metaDescriptionPresent, "Meta description detected.", "Meta description was not detected.") }, { ok: links.length >= 3, evidence: `${links.length} HTML links detected on the homepage.` }]);
  const oneH1 = extractHeadings(html, 1).length === 1;
  const descriptiveLinks = links.some((link) => link.text.length >= 4);
  const semanticStructure = /<ul|<ol|<table/i.test(html);
  const contentStructure = scoreCategory("content_structure", [{ ok: oneH1, evidence: checkEvidence(oneH1, "Exactly one H1 heading detected.", "The page does not have exactly one H1 heading.") }, { ok: descriptiveHeadings, evidence: checkEvidence(descriptiveHeadings, "A multi-level heading structure is present.", "A multi-level heading structure was not detected.") }, { ok: descriptiveLinks, evidence: checkEvidence(descriptiveLinks, "Descriptive anchor text detected.", "Descriptive anchor text was not detected.") }, { ok: semanticStructure, evidence: checkEvidence(semanticStructure, "Semantic list or table structure detected.", "Semantic list or table structure was not detected.") }]);
  const categories = [identity, services, location, structured, answer, trust, crawl, contentStructure];
  const score = Math.round(categories.reduce((sum, category) => sum + category.score * AEO_WEIGHTS[category.key], 0) / 100);
  const findings = categories.filter((category) => category.score >= 70).slice(0, 4).map((category) => ({ title: `${category.label} is clearly established`, summary: category.evidence.filter((evidence) => evidence.startsWith("Pass")).slice(0, 2).join(" "), status: "pass" as const }));
  const recommendations = categories.filter((category) => category.score < 70).slice(0, 4).map((category) => ({ title: category.key === "answer_friendly_content" ? "Answer common customer questions" : category.key === "structured_data" ? "Strengthen structured business and service information" : category.key === "location_service_area" ? "Clarify where you serve customers" : category.key === "services_offerings" ? "Describe your services more clearly" : category.key === "expertise_trust" ? "Add relevant expertise and trust signals" : category.key === "business_identity" ? "Strengthen your business identity information" : category.key === "content_structure" ? "Make important answers easier to extract" : "Improve crawlable business information", description: category.evidence.filter((evidence) => evidence.startsWith("Needs attention")).slice(0, 2).join(" ") }));
  return { score, categories, questionCoverage: coverage, findings, recommendations, evidence: { profile: profile.key, schemaTypes: types, businessNameProvided: Boolean(input.businessName), auditMarket: input.market ?? null, websiteLocationEvidence: hasAddress }, checkedAt: new Date().toISOString() };
}
