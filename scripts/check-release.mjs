import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStepSequence,
  column,
  determinant3,
  householderMatrix,
  norm,
  qrDecomp,
  symmetricEigenvectorForMinusOne
} from "../docs/math-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function approxEqual(actual, expected, tolerance = 1e-6, message = "values differ") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function approxVectorLength(v, expected, tolerance = 1e-6, message = "vector norm differs") {
  approxEqual(norm(v), expected, tolerance, message);
}

function testDeterminantAndSteps() {
  const A = [
    [1, 7, -2],
    [1, 7, -4],
    [1, -8, 3]
  ];

  approxEqual(determinant3(A), -30, 1e-6, "determinant example mismatch");

  const result = buildStepSequence(A);
  assert.equal(result.rankDeficient, false, "example matrix should be full rank");
  assert.equal(result.steps.length, 11, "expected 11 visualization steps for example matrix");
  assert.equal(result.steps[0].title, "Original");
  assert.deepEqual(
    result.steps.map((step) => step.title),
    [
      "Original",
      "Remove a1 from a2",
      "Remove a1 from a3",
      "Remove a2 from a3",
      "Place mirror",
      "Reflect a1 onto x",
      "Place mirror",
      "Reflect a2 onto y",
      "Place mirror",
      "Reflect a3 onto z",
      "Done"
    ],
    "step titles should match the expected walkthrough"
  );
}

function testSingularMatrixFallback() {
  const singular = [
    [1, 2, 3],
    [2, 4, 6],
    [1, 1, 1]
  ];

  const result = buildStepSequence(singular);
  approxEqual(result.determinant, 0, 1e-6, "singular determinant mismatch");
  assert.equal(result.rankDeficient, true, "singular matrix should trigger fallback");
  assert.equal(result.steps.length, 1, "singular fallback should produce one step");
}

function testQrDiagonalVolume() {
  const A = [
    [4, 0, 0],
    [0, 5, 0],
    [0, 0, 6]
  ];

  const { Q, R } = qrDecomp(A);
  approxEqual(Q[0][0], 1, 1e-6, "Q should preserve x-axis");
  approxEqual(Q[1][1], 1, 1e-6, "Q should preserve y-axis");
  approxEqual(Q[2][2], 1, 1e-6, "Q should preserve z-axis");
  approxEqual(R[0][0] * R[1][1] * R[2][2], 120, 1e-6, "volume mismatch");
}

function testOrthogonalBasisSkipsNoOpGramSchmidtSteps() {
  const A = [
    [4, 0, 0],
    [0, 5, 0],
    [0, 0, 6]
  ];

  const result = buildStepSequence(A);
  assert.equal(result.rankDeficient, false, "diagonal matrix should be full rank");
  assert.deepEqual(
    result.steps.map((step) => step.title),
    ["Original"],
    "orthogonal basis should not emit no-op Gram-Schmidt or reflection steps"
  );
}

function testHouseholderPlaneNormal() {
  const xAxis = [1, 0, 0];
  const target = [0, 1, 0];
  const H = householderMatrix(xAxis, target);
  const normal = symmetricEigenvectorForMinusOne(H);

  approxVectorLength(normal, 1, 1e-6, "mirror normal should be unit length");
  const reflected = [
    H[0][0] * xAxis[0] + H[0][1] * xAxis[1] + H[0][2] * xAxis[2],
    H[1][0] * xAxis[0] + H[1][1] * xAxis[1] + H[1][2] * xAxis[2],
    H[2][0] * xAxis[0] + H[2][1] * xAxis[1] + H[2][2] * xAxis[2]
  ];

  approxEqual(reflected[0], target[0], 1e-6, "householder reflection x mismatch");
  approxEqual(reflected[1], target[1], 1e-6, "householder reflection y mismatch");
  approxEqual(reflected[2], target[2], 1e-6, "householder reflection z mismatch");
}

function testStaticPageWiring() {
  const indexHtml = fs.readFileSync(path.join(repoRoot, "docs", "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(repoRoot, "docs", "app.js"), "utf8");

  assert.match(indexHtml, /<script type="importmap">/, "index.html must include an import map");
  assert.match(indexHtml, /"three"\s*:\s*"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.164\.1\/build\/three\.module\.js"/, "import map must define three");
  assert.match(indexHtml, /katex@0\.16\.11\/dist\/katex\.min\.css/, "index.html must load KaTeX CSS");
  assert.match(indexHtml, /renderMathInElement\(document\.body/, "index.html must initialize KaTeX auto-render");
  assert.match(indexHtml, /\\\(\\det\(A\)\\\)/, "index.html must include the determinant label in LaTeX");
  assert.match(appJs, /from "three";/, "app.js must import from bare specifier three");
  assert.match(appJs, /from "three\/addons\/controls\/OrbitControls\.js";/, "app.js must import OrbitControls via addons path");
  assert.match(appJs, /basis\.length === 2/, "app.js should render a plane for rank-2 singular matrices");
  assert.match(appJs, /basis\.length === 1/, "app.js should render a line for rank-1 singular matrices");
}

function testGeometryColumnsAccessible() {
  const A = [
    [2, 1, 0],
    [0, 3, 1],
    [1, 0, 4]
  ];

  assert.deepEqual(column(A, 0), [2, 0, 1]);
  assert.deepEqual(column(A, 1), [1, 3, 0]);
  assert.deepEqual(column(A, 2), [0, 1, 4]);
}

const tests = [
  ["determinant and step sequence", testDeterminantAndSteps],
  ["singular matrix fallback", testSingularMatrixFallback],
  ["qr diagonal volume", testQrDiagonalVolume],
  ["orthogonal basis skips no-op steps", testOrthogonalBasisSkipsNoOpGramSchmidtSteps],
  ["householder plane normal", testHouseholderPlaneNormal],
  ["static page wiring", testStaticPageWiring],
  ["column extraction", testGeometryColumnsAccessible]
];

let passed = 0;

for (const [name, testFn] of tests) {
  testFn();
  passed += 1;
  console.log(`PASS ${name}`);
}

console.log(`Release checks passed: ${passed}/${tests.length}`);
