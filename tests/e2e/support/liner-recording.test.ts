import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { createLinerRecorder, linerEndpoint } from "./liner-recording";

test("records a scrubbed reply, replays the exact request, and invalidates a one-character truth copy change", async (t) => {
  const root = resolve("tests/fixtures/recorded");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, "unit-"));
  const truth = join(directory, "truth.json");
  const originalTruth = readFileSync("src/lib/forwarding/evaluation/ground-truth.json", "utf8");
  writeFileSync(truth, originalTruth);
  const env = {
    MIRINAE_E2E_TRUTH_PATH: process.env.MIRINAE_E2E_TRUTH_PATH,
    MIRINAE_E2E_RECORD_DIR: process.env.MIRINAE_E2E_RECORD_DIR,
  };
  process.env.MIRINAE_E2E_TRUTH_PATH = truth;
  process.env.MIRINAE_E2E_RECORD_DIR = directory;
  t.after(() => {
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    assert.equal(dirname(realpathSync(directory)), realpathSync(root));
    rmSync(directory, { recursive: true, force: true });
  });

  const privateKeyMarker = "mock-recorder-key";
  let externalCalls = 0;
  const upstream: typeof fetch = async (input, init) => {
    assert.equal(input, linerEndpoint);
    assert.equal(new Headers(init?.headers).get("x-api-key"), privateKeyMarker);
    externalCalls += 1;
    return Response.json({ results: [{
      title: "Cleveland Clinic Locations / Example Person",
      url: "https://my.clevelandclinic.org/private-path?contact=example@example.test",
      description: "Main campus address in Cleveland, Ohio. Example Person, +1 555 0100.",
    }, {
      title: "Public profile", url: "https://my.clevelandclinic.org/", description: "Official website.",
    }, {
      title: "directory", url: "https://directory.example.test/unsupported", description: "unverified organization",
    }] });
  };
  const body = (query: string) => JSON.stringify({
    query, max_results: 3, include_knowledge: false, lang: "en", country_code: "us",
  });
  const request = { method: "POST", body: body("Cleveland Clinic United States"), headers: { "x-api-key": "caller-marker" } };
  const recorder = createLinerRecorder(upstream, () => privateKeyMarker);
  const first = await (await recorder.fetch(linerEndpoint, request)).json();
  assert.equal(externalCalls, 1);
  assert.deepEqual(first.results, [{
    title: "Cleveland Clinic", url: "https://clevelandclinic.org/", description: "clinic address in United States",
  }, {
    title: "Cleveland Clinic", url: "https://clevelandclinic.org/", description: "",
  }]);
  assert.equal(recorder.counters.recorded, 1);
  const files = () => readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/.test(name));
  const text = readFileSync(join(directory, files()[0]), "utf8");
  const saved = JSON.parse(text);
  assert.match(saved.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(saved.apiVersion, "v1");
  assert.ok(Number.isFinite(Date.parse(saved.recordedAt)));
  assert.doesNotMatch(text, /Example Person|555 0100|private-path|example@example|mock-recorder-key|caller-marker/);

  const offline = createLinerRecorder(upstream, () => assert.fail("a matching replay requires no key"));
  assert.deepEqual(await (await offline.fetch(linerEndpoint, request)).json(), first);
  assert.deepEqual(offline.counters, { live: 0, replayed: 1, blocked: 0, recorded: 0 });

  writeFileSync(truth, originalTruth + " ");
  const changed = createLinerRecorder(upstream, () => privateKeyMarker);
  await changed.fetch(linerEndpoint, request);
  assert.deepEqual(changed.counters, { live: 1, replayed: 0, blocked: 0, recorded: 1 });
  assert.equal(files().length, 2);

  await changed.fetch(linerEndpoint, { ...request, body: body("Cleveland Clinic hospital clinic dental research institute medical devices") });
  assert.equal(externalCalls, 3);
  assert.equal(files().length, 3);
  await assert.rejects(changed.fetch(linerEndpoint, { ...request, body: body("personal-email@example.test") }), /synthetic demonstration/);
  assert.equal(changed.counters.blocked, 1);
  assert.equal(externalCalls, 3);

  const outside = join(directory, "outside");
  symlinkSync(resolve("tests/fixtures"), outside, "junction");
  try {
    process.env.MIRINAE_E2E_RECORD_DIR = outside;
    assert.throws(() => createLinerRecorder(upstream, () => privateKeyMarker), /resolves outside/);
  } finally {
    rmSync(outside);
  }
});
