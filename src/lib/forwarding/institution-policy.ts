/** Names and ownership from the public institution pages in DEMO_DATA and #26. */
export const institutionProfiles: Record<string, { names: string[]; domains: string[] }> = {
  서울대학교병원: { names: ["Seoul National University Hospital", "SNUH"], domains: ["snuh.org"] },
  "The University of Tokyo Hospital": { names: ["University of Tokyo Hospital", "東京大学医学部附属病院"], domains: ["h.u-tokyo.ac.jp"] },
  "Cleveland Clinic": { names: [], domains: ["clevelandclinic.org"] },
  "Fraunhofer-Gesellschaft": { names: ["Fraunhofer"], domains: ["fraunhofer.de"] },
  강남세브란스병원: { names: ["Gangnam Severance Hospital", "강남세브란스"], domains: ["severance.healthcare"] },
  "The Royal Melbourne Hospital": { names: ["Royal Melbourne Hospital"], domains: ["thermh.org.au"] },
  "Mayo Clinic": { names: [], domains: ["mayoclinic.org"] },
  "Guy's and St Thomas' NHS Foundation Trust": { names: ["Guy's and St Thomas'"], domains: ["guysandstthomas.nhs.uk"] },
  삼성서울병원: { names: ["Samsung Medical Center"], domains: ["samsunghospital.com"] },
  "Toyota Motor Corporation": { names: ["Toyota Motor", "Toyota"], domains: ["global.toyota"] },
  "Charité – Universitätsmedizin Berlin": { names: ["Charité", "Universitätsmedizin Berlin"], domains: ["charite.de"] },
  "Vinmec International Hospital": { names: ["Vinmec"], domains: ["vinmec.com"] },
  "Apollo Hospitals": { names: ["Apollo Hospital"], domains: ["apollohospitals.com"] },
  HSBC: { names: [], domains: ["hsbc.com"] },
  현대자동차: { names: ["Hyundai Motor Company", "Hyundai Motor", "Hyundai"], domains: ["hyundai.com"] },
  Pfizer: { names: [], domains: ["pfizer.com"] },
  "Massachusetts Institute of Technology": { names: ["MIT"], domains: ["mit.edu"] },
  연세대학교: { names: ["Yonsei University"], domains: ["yonsei.ac.kr"] },
  "The University of Tokyo": { names: ["University of Tokyo", "東京大学"], domains: ["u-tokyo.ac.jp"] },
  서울아산병원: { names: ["Asan Medical Center", "Asan Medical"], domains: ["amc.seoul.kr"] },
  "Karolinska University Hospital": { names: ["Karolinska Universitetssjukhuset", "Karolinska"], domains: ["karolinska.se"] },
  "Singapore General Hospital": { names: ["SGH"], domains: ["sgh.com.sg"] },
};

export const locales: Record<string, [term: string, language: string, code: string, location: RegExp]> = {
  대한민국: ["대한민국", "ko", "kr", /대한민국|한국|서울|\b(?:south korea|republic of korea|rep\. of korea|seoul)\b/iu],
  일본: ["Japan", "ja", "jp", /日本|일본|東京|\b(?:japan|tokyo|bunkyo|toyota city|aichi)\b/iu],
  미국: ["United States", "en", "us", /미국|\b(?:united states|usa|ohio|minnesota|massachusetts|new york)\b/iu],
  독일: ["Germany", "en", "de", /독일|\b(?:germany|deutschland|berlin|munich|münchen)\b/iu],
  호주: ["Australia", "en", "au", /호주|\b(?:australia|melbourne|parkville)\b/iu],
  영국: ["United Kingdom", "en", "gb", /영국|\b(?:united kingdom|uk|england|london)\b/iu],
  싱가포르: ["Singapore", "en", "sg", /싱가포르|\bsingapore\b/iu],
  베트남: ["Vietnam", "en", "vn", /베트남|\b(?:vietnam|viet nam|hanoi|ha noi)\b/iu],
  인도: ["India", "en", "in", /인도(?:\s|$)|\b(?:india|chennai|tamil nadu|new delhi)\b/iu],
  스웨덴: ["Sweden", "en", "se", /스웨덴|\b(?:sweden|sverige|stockholm|solna)\b/iu],
  멕시코: ["Mexico", "es", "mx", /멕시코|\bm[eé]xico\b/iu],
  브라질: ["Brazil", "pt", "br", /브라질|\b(?:brazil|brasil)\b/iu],
  아랍에미리트: ["United Arab Emirates", "en", "ae", /아랍에미리트|\b(?:united arab emirates|uae|dubai|abu dhabi)\b/iu],
  카자흐스탄: ["Kazakhstan", "en", "kz", /카자흐스탄|\b(?:kazakhstan|astana|almaty)\b/iu],
  프랑스: ["France", "fr", "fr", /프랑스|\b(?:france|paris)\b/iu],
  캐나다: ["Canada", "en", "ca", /캐나다|\b(?:canada|toronto|ottawa)\b/iu],
  중국: ["China", "zh", "cn", /중국|中国|\b(?:china|beijing|shanghai)\b/iu],
};

export const thirdPartyDomains = [
  "wikipedia.org", "wikimedia.org", "wikidata.org", "namu.wiki", "fandom.com", "facebook.com",
  "instagram.com", "linkedin.com", "youtube.com", "twitter.com", "x.com", "tiktok.com", "reddit.com",
  "news.google.com", "bbc.com", "bbc.co.uk", "cnn.com", "reuters.com", "apnews.com", "nytimes.com",
  "forbes.com", "yelp.com", "trustpilot.com", "tripadvisor.com", "yellowpages.com", "crunchbase.com",
  "zoominfo.com", "healthgrades.com", "wixsite.com", "blogspot.com", "wordpress.com",
];

export const reservedDomains = ["example", "example.com", "example.net", "example.org", "test", "invalid", "localhost"];

export const freeEmailDomains = [
  "gmail.com", "googlemail.com", "naver.com", "daum.net", "hanmail.net", "yahoo.com", "outlook.com",
  "hotmail.com", "live.com", "icloud.com", "proton.me", "protonmail.com", "qq.com", "163.com",
];
