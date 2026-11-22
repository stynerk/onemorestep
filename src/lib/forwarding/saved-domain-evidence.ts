import type { DomainEvidenceAdvice } from "./domain-router";

// Verified Router responses for the stored public Flowline search excerpts.
export const savedDomainEvidence: Readonly<Record<string, DomainEvidenceAdvice>> = {
  "d81f2b700c393443b1938bb91747984bff2f3ece5086f7f5052053a3fa9ef7f4": {
    "ownership": "belongs",
    "quote": "The Max Planck Society lists its administrative headquarters address in Munich, Germany. E-mail: post@gv.mpg.de.",
    "url": "https://www.mpg.de/contact/directions",
    "location": {
      "country": "독일",
      "quote": "The Max Planck Society lists its administrative headquarters address in Munich, Germany.",
      "url": "https://www.mpg.de/contact/directions"
    }
  },
  "b8a24ecd4087f09f292b832be93742563cd0ee7d76f8fea2c633698ada030f41": {
    "ownership": "belongs",
    "quote": "The imprint names Robert Bosch GmbH and gives a contact address in Germany. E-mail: audit-manager@de.bosch.com.",
    "url": "https://audit.bosch.com/CSR/imprint_en.htm",
    "location": {
      "country": "독일",
      "quote": "The headquarters of Robert Bosch GmbH is in Gerlingen-Schillerhöhe, Germany.",
      "url": "https://www.bosch.com/faq/"
    }
  }
};
