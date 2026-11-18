import type { Source } from "../liner-search";

/** Hand-curated official pages. The descriptions are public facts transcribed for offline demonstration. */
const pages: Record<string, [title: string, url: string, description: string]> = {
  서울대학교병원: ["Seoul National University Hospital", "https://www.snuh.org/global/en/main.do", "Hospital address in Jongno-gu, Seoul, Republic of Korea."],
  "The University of Tokyo Hospital": ["The University of Tokyo Hospital", "https://www.h.u-tokyo.ac.jp/english/access/", "University hospital address in Hongo, Bunkyo, Tokyo, Japan."],
  "Cleveland Clinic": ["Cleveland Clinic Locations", "https://my.clevelandclinic.org/locations", "Hospital locations including the main campus in Cleveland, Ohio."],
  "Fraunhofer-Gesellschaft": ["Fraunhofer Headquarters", "https://www.fraunhofer.de/en/contact-headquarters.html", "Research organization headquarters in Munich, Germany."],
  강남세브란스병원: ["강남세브란스병원", "https://sev.severance.healthcare/sev-en/about/network.do", "강남세브란스병원 주소는 대한민국 서울 강남구입니다."],
  "The Royal Melbourne Hospital": ["The Royal Melbourne Hospital Contact", "https://www.thermh.org.au/contact", "Hospital locations at Parkville in Australia."],
  "Mayo Clinic": ["Mayo Clinic Contact", "https://www.mayoclinic.org/about-mayo-clinic/contact", "Hospital contact information."],
  "Guy's and St Thomas' NHS Foundation Trust": ["Guy's and St Thomas' Contact", "https://www.guysandstthomas.nhs.uk/contact-us", "St Thomas’ Hospital address in London."],
  삼성서울병원: ["Samsung Medical Center", "https://www.samsunghospital.com/", "병원 진료 및 예약 안내."],
  "Toyota Motor Corporation": ["Toyota Motor Corporation Company Profile", "https://global.toyota/en/company/profile/overview/", "Automotive company head office in Aichi, Japan."],
  "Charité – Universitätsmedizin Berlin": ["Charité – Universitätsmedizin Berlin", "https://www.charite.de/en/", "University hospital address at Charitéplatz in Berlin."],
  "Vinmec International Hospital": ["Vinmec Contact", "https://www.vinmec.com/eng/contact-us/", "Hospital locations and clinic addresses in Vietnam."],
  "Apollo Hospitals": ["Apollo Hospitals Chennai Contact", "https://www.apollohospitals.com/hospitals/apollo-hospitals-greams-road-chennai", "Flagship hospital address in Chennai, Tamil Nadu, India."],
  현대자동차: ["Hyundai Motor Company", "https://www.hyundai.com/content/hyundai/ww/data/csr/data/0000000053/attach/english/hmc-2025-sustainability-report-en-v13.pdf", "Automotive company headquarters in Seoul, South Korea."],
  Pfizer: ["Pfizer Contact", "https://www.pfizer.com/contact", "Pharmaceutical company contact address in New York, USA."],
  서울아산병원: ["Asan Medical Center", "https://www.amc.seoul.kr/asan/main.do", "병원 진료 및 예약 안내."],
  "Karolinska University Hospital": ["Karolinska University Hospital Contact", "https://www.karolinska.se/om-oss/kontakta-oss/", "University hospital contact information."],
  "Singapore General Hospital": ["Singapore General Hospital", "https://www.sgh.com.sg/", "Hospital address on Outram Road in Singapore."],
};

export function savedInstitutionSources(institution: string): Source[] {
  const page = Object.hasOwn(pages, institution) ? pages[institution] : undefined;
  if (!page) return [];
  const [title, url, description] = page;
  return [{ title, url, description }];
}

// Two successful Liner queries per institution and country, reviewed for matching institutions.
// See docs/qa/LINER_SAVED_NONMATCHES_2026-11-19.md for the query and screening record.
const checkedNonMatches = [
  { institution: "asdf", country: "브라질", searchedAt: "2026-11-18T19:55:59.773Z" },
  { institution: "Zxq Medical Group", country: "아랍에미리트", searchedAt: "2026-11-18T19:56:02.981Z" },
  { institution: "Mirinae Demo Clinic", country: "베트남", searchedAt: "2026-11-18T19:56:05.477Z" },
  { institution: "Sakura Test Hospital", country: "일본", searchedAt: "2026-11-18T19:56:08.212Z" },
  { institution: "Dentra Imaging", country: "독일", searchedAt: "2026-11-18T19:56:12.737Z" },
];

export function savedNonMatchSearchedAt(institution: string, country: string): string | undefined {
  return checkedNonMatches.find((entry) => entry.institution === institution && entry.country === country)?.searchedAt;
}

export const savedSourcesReviewedAt = "2026-11-18T00:00:00.000Z";
