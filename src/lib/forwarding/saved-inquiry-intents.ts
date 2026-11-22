import type { InquiryIntent } from "./types";

// Validated Liner Router replies for the synthetic Flowline demo, recorded 2026-11-22.
// Keys are SHA-256 digests of the unchanged UTF-8 memo.
export const savedInquiryIntents: Readonly<Record<string, InquiryIntent>> = {
  "bc6597219ba331e910a07b479f41104776f79ca6f1f4f9b85ed4f680e2269559": {
    "intent": "buying",
    "quote": "evaluating a workflow platform"
  },
  "1b4e1c55b36a84dd04ffa1782386de2d9114f32cb33de577f016822dd1db2789": {
    "intent": "buying",
    "quote": "견적과 데모 요청드립니다"
  },
  "10bc986ba4acc09bad6e9d6154e00a78987563267e8c425d8aaca8d459ac5a41": {
    "intent": "buying",
    "quote": "見積もりをお願いします"
  },
  "c78a2a3542ce5b4d6208ce62017ae9ebc394cde09a7febf6dd0241898fda4eaa": {
    "intent": "buying",
    "quote": "price?"
  },
  "110c34199244eb2e284929ee47655dcad60c6afbca509d6b97c1115af49242e5": {
    "intent": "buying",
    "quote": "Need API access licenses for our lab"
  },
  "5f005afcabdf991e3ee63eea7ee30718e6ae20a98645f7e24d61b1acab1c11ca": {
    "intent": "partnership",
    "quote": "reseller partnership"
  },
  "82d1bfd3586dc3a75273c3d36a3e8100d8c7f2a63195be12353621005d2ddd3d": {
    "intent": "student",
    "quote": "Course project"
  },
  "912fafb21fcaaa6c11c8c8f24faf3962f23af1655f2ed08d06fb9d00b5dc0c75": {
    "intent": "buying",
    "quote": "buy 500 seats"
  },
  "25f4cdcc8f037d543036f1c6f0ecb3fb48da10b64e2d8cd24ee5d124ac09cb2f": {
    "intent": "buying",
    "quote": "license order"
  },
  "8bd6be7c9915c9ba53495079efe0d7f74e65c19acfed59bd1545d8c772a67e1a": {
    "intent": "job",
    "quote": "apply for your solutions engineer opening"
  }
};
