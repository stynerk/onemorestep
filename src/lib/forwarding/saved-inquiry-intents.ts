import type { InquiryIntent } from "./types";

// Validated Liner Router replies for the synthetic Medicom and Flowline demos, recorded 2026-11-22.
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
  },

  // Medicom public demo.
  "af33ddc741b032db8a655b23ed19ffa43dc0a7db7fff8e740884237bb55f858e": {
    "intent": "buying",
    "quote": "견적 요청"
  },
  "a13f17e269d06249f577ec082a501ca73436703713a1978facc3cbb999a8497e": {
    "intent": "buying",
    "quote": "requesting a demo"
  },
  "cd75d33ac4d68c1861618fbc3de6d9e0a9126d5b986cde77d25b9f5bb4816a79": {
    "intent": "buying",
    "quote": "Replacing monitors in the new wing"
  },
  "efabba317940afa47bc6b7384dc3f393ea48c79468ed4abcf162ed891855ab4e": {
    "intent": "buying",
    "quote": "please send a quote"
  },
  "d4204e61e250b87ddc132de4a8ed419cd0ad0380a252305836cf91828e1d4649": {
    "intent": "buying",
    "quote": "교체 견적"
  },
  "4404a5566af0d97694ad3c36d7536865396b320515e26bc99e0825487704be0d": {
    "intent": "buying",
    "quote": "need specs by Friday"
  },
  "aa3df722c8d1aa2f64b3f71f5f7d2df0f64bc7acaad359c670ddd303418af65c": {
    "intent": "buying",
    "quote": "purchase 6 units"
  },
  "6ad9027789cc1b517fb2c7f63cdd791f5934d939a1664bbc8a049c3328d10301": {
    "intent": "unknown",
    "quote": "For reference only"
  },
  "bbe8f22e306a242c22224011856fef8ae826445f58c6604e13e8abf51b88addd": {
    "intent": "buying",
    "quote": "카탈로그 요청"
  },
  "c76dd267d1a79310c324ff7fcbfa0841dd0e2d0eebf50ff879ca26199f351b33": {
    "intent": "buying",
    "quote": "2台検討しています"
  },
  "992a1d7b6cd7f19af42983ee49563cad492b39bfb59d54957ac2441cbdfaf598": {
    "intent": "buying",
    "quote": "Interested in a demo"
  },
  "8d416b09200fe8327104d9945b8a0dba7e629bb887c1532e748828b01b409c87": {
    "intent": "buying",
    "quote": "Quotation please"
  },
  "4d01611c351eabae34418c16174ea2f730d9d5c6d65b485d62867b7ca9319a79": {
    "intent": "buying",
    "quote": "Need pricing for 10 units"
  },
  "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08": {
    "intent": "unknown",
    "quote": "test"
  },
  "1b7ed8d7ed6334d042a62cc375f66787581a2c50eb6d7d07df3879fe2cf9de04": {
    "intent": "unknown",
    "quote": "just curious"
  },
  "f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b": {
    "intent": "unknown",
    "quote": "asdf"
  },
  "d7f29500cfa381be054985060c9d03cbf07b8ea54f14ff25dcb80ab0069673e8": {
    "intent": "buying",
    "quote": "Bulk purchase possible"
  },
  "52990f7a9b797ca71245baf77a536263777c22aa3d0bb9c66ad399fbb97e6c61": {
    "intent": "buying",
    "quote": "Considering adoption this year"
  },
  "0f2ec8422c14d761ffda9ce62561769a85648cf482ae23a36ec8894967be4768": {
    "intent": "buying",
    "quote": "見積もりをお願いします"
  },
  "90bab72369fdeda1de0c7a9cad48b48b36067242347c7dec9ad98251b938a01c": {
    "intent": "sales",
    "quote": "offer corporate banking services"
  },
  "122035b9e525e993030407711945b6b090bcb6ca5430d4efd80b7e9ff5350983": {
    "intent": "partnership",
    "quote": "협업 제안드립니다"
  },
  "324f447f9312524bd1ef7b084b98aca4b07e8e50a29db853614dd6b50b6099c5": {
    "intent": "partnership",
    "quote": "co-marketing partnership"
  },
  "251b86a886f4e8d2c8e7c166b05a1e977d5da11207b35834299128524d4cb99e": {
    "intent": "student",
    "quote": "for a class project"
  },
  "5650f4f4622eda69fe38b382264073d6dc98203418fab8b701f082c65d54223f": {
    "intent": "student",
    "quote": "졸업 논문 자료 요청"
  },
  "a2c0414d4b7e4de94b35fe7c9278abc03ac542c5d87aa2b142d21eeb93615fec": {
    "intent": "job",
    "quote": "Applying for a sales position"
  },
  "8bac1066d4cdf654455fb5293dab7f4d6faec9851c237f16f9117d89db269980": {
    "intent": "buying",
    "quote": "Requesting product comparison materials"
  },
  "f97e6c07ae2c6745293491f4ec9741452319d50efa1a8a82c2d6a4d9bf09c257": {
    "intent": "buying",
    "quote": "급히 견적 필요"
  },
  "431424edb0d70a16c660e733466b1e30198250c11d06784017f849fa90a7ac43": {
    "intent": "buying",
    "quote": "Urgent order"
  },
  "bed5a6f9b721b7ee8ae6e53594f1b4f482dd4e97de9ac36d4be43ec1a05c9988": {
    "intent": "buying",
    "quote": "Large order"
  },
};
