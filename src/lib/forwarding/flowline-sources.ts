import type { Source } from "../liner-search";

const searchedAt = "2026-11-21T22:49:00.000Z";
const siemens = {
  searchedAt,
  sources: [{
    title: "Corporate governance | Siemens",
    url: "https://www.siemens.com/en-us/company/investor-relations/corporate-governance/",
    description: "Siemens AG has its registered offices in Berlin and Munich, Germany. Siemens is a German stock corporation.",
  }],
};

// Curated public institutional facts for the saved demo. No live search responses or answer labels.
export const flowlineSources: Readonly<Partial<Record<string, { searchedAt: string; sources: Source[] }>>> = {
  I01: siemens,
  I02: {
    searchedAt,
    sources: [{
      title: "LG Open Source Privacy Policy",
      url: "https://opensource.lge.com/privacy",
      description: "LG Electronics Inc. Contact address: Seoul, Republic of Korea.",
    }],
  },
  I03: {
    searchedAt,
    sources: [{
      title: "Corporate Profile | Hitachi Global",
      url: "https://www.hitachi.com/en/about/hitachi/",
      description: "The corporate profile of Hitachi, Ltd. lists its headquarters in Tokyo, Japan.",
    }],
  },
  I04: {
    searchedAt,
    sources: [{
      title: "Credits | BASF",
      url: "https://www.basf.com/global/en/legal/credits",
      description: "The general contact address for BASF SE is in Ludwigshafen, Germany.",
    }],
  },
  I05: {
    searchedAt,
    sources: [{
      title: "Address and Directions | Max-Planck-Gesellschaft",
      url: "https://www.mpg.de/contact/directions",
      description: "The Max Planck Society lists its administrative headquarters address in Munich, Germany. E-mail: post@gv.mpg.de.",
    }],
  },
  I06: {
    searchedAt,
    sources: [{
      title: "Frequently asked questions | Bosch Global",
      url: "https://www.bosch.com/faq/",
      description: "The headquarters of Robert Bosch GmbH is in Gerlingen-Schillerhöhe, Germany.",
    }, {
      title: "The Bosch Group - Imprint",
      url: "https://audit.bosch.com/CSR/imprint_en.htm",
      description: "The imprint names Robert Bosch GmbH and gives a contact address in Germany. E-mail: audit-manager@de.bosch.com.",
    }],
  },
  // The supplied scenario explicitly introduces a fictional institution without a public source.
  I08: { searchedAt, sources: [] },
  I09: siemens,
};
