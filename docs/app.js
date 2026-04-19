import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  EPS,
  buildStepSequence,
  column,
  lerpMatrix,
  matricesClose,
  maxAbsEntry,
  norm,
  normalize,
  parallelepipedVertices,
  symmetricEigenvectorForMinusOne
} from "./math-core.mjs";

const EXAMPLE_MATRIX = [
  [-1, 2, 1],
  [1, 2, -1],
  [1, -2, 4]
];

const VECTOR_COLORS = [0xd1495b, 0x2c7a55, 0x2f6db5];

const ui = {
  grid: document.getElementById("matrix-grid"),
  volumeValue: document.getElementById("volume-value"),
  determinantValue: document.getElementById("determinant-value"),
  orientationValue: document.getElementById("orientation-value"),
  lengthsValue: document.getElementById("lengths-value"),
  stepValue: document.getElementById("step-value"),
  stepMessage: document.getElementById("step-message"),
  applyButton: document.getElementById("apply-button"),
  prevButton: document.getElementById("prev-button"),
  nextButton: document.getElementById("next-button"),
  resetButton: document.getElementById("reset-button"),
  zoomInButton: document.getElementById("zoom-in-button"),
  zoomOutButton: document.getElementById("zoom-out-button"),
  homeButton: document.getElementById("home-button"),
  viewer: document.getElementById("viewer"),
  labelLayer: document.getElementById("label-layer")
};

const matrixInputs = [];
for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 3; col += 1) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.inputMode = "decimal";
    input.setAttribute("aria-label", `Matrix entry row ${row + 1} column ${col + 1}`);
    input.classList.add(`matrix-input-a${col + 1}`);
    ui.grid.appendChild(input);
    matrixInputs.push(input);
  }
}

const tabOrder = [
  0, 3, 6,
  1, 4, 7,
  2, 5, 8
];

matrixInputs.forEach((input, index) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }

    const orderIndex = tabOrder.indexOf(index);
    if (orderIndex === -1) {
      return;
    }

    const delta = event.shiftKey ? -1 : 1;
    const nextOrderIndex = orderIndex + delta;
    if (nextOrderIndex < 0 || nextOrderIndex >= tabOrder.length) {
      return;
    }

    event.preventDefault();
    matrixInputs[tabOrder[nextOrderIndex]].focus();
    matrixInputs[tabOrder[nextOrderIndex]].select();
  });
});

function zeroMatrix() {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f3eb);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(7.5, 6.5, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.75;

scene.add(new THREE.AmbientLight(0xffffff, 0.82));

const axesGroup = new THREE.Group();
scene.add(axesGroup);

const objectGroup = new THREE.Group();
scene.add(objectGroup);

const axisMaterial = new THREE.LineBasicMaterial({ color: 0x8f8f8f, transparent: true, opacity: 0.9 });
const axisDirections = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1)
];
const axisLines = [];
const axisTickSegments = [];

axisDirections.forEach((dir) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(geometry, axisMaterial);
  axisLines.push({ line, dir });
  axesGroup.add(line);

  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  const ticks = new THREE.LineSegments(tickGeometry, axisMaterial);
  axisTickSegments.push(ticks);
  axesGroup.add(ticks);
});

const boxGeometry = new THREE.BufferGeometry();
const boxMaterial = new THREE.MeshBasicMaterial({
  color: 0x88bfd6,
  transparent: true,
  opacity: 0.2,
  side: THREE.DoubleSide
});
const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
objectGroup.add(boxMesh);

const edgeGeometry = new THREE.BufferGeometry();
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x5b6670 });
const edgeSegments = new THREE.LineSegments(edgeGeometry, edgeMaterial);
objectGroup.add(edgeSegments);

const arrowHelpers = VECTOR_COLORS.map((color) => {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, color, 0.35, 0.18);
  objectGroup.add(arrow);
  return arrow;
});

const mirrorGeometry = new THREE.PlaneGeometry(1, 1);
const mirrorMaterial = new THREE.MeshBasicMaterial({
  color: 0xb2b8be,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false
});
const mirrorMesh = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
objectGroup.add(mirrorMesh);

const sceneLabels = [
  { key: "x", text: "x", className: "scene-label axis", element: createSceneLabel("x", "scene-label axis") },
  { key: "y", text: "y", className: "scene-label axis", element: createSceneLabel("y", "scene-label axis") },
  { key: "z", text: "z", className: "scene-label axis", element: createSceneLabel("z", "scene-label axis") },
  { key: "a1", text: "a1", className: "scene-label vector-red", element: createSceneLabel("a1", "scene-label vector-red") },
  { key: "a2", text: "a2", className: "scene-label vector-green", element: createSceneLabel("a2", "scene-label vector-green") },
  { key: "a3", text: "a3", className: "scene-label vector-blue", element: createSceneLabel("a3", "scene-label vector-blue") }
];

function createSceneLabel(text, className) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  ui.labelLayer.appendChild(element);
  return element;
}

function updateAxisLength(axisLength) {
  axisLines.forEach(({ line, dir }) => {
    const start = dir.clone().multiplyScalar(-axisLength);
    const end = dir.clone().multiplyScalar(axisLength);
    line.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [start.x, start.y, start.z, end.x, end.y, end.z],
        3
      )
    );
    line.geometry.computeBoundingSphere();
  });

  const tickHalfLength = Math.max(0.015, axisLength * 0.008);
  const tickCount = Math.max(1, Math.floor(axisLength));
  const tickStep = axisLength / tickCount;
  const tickPerpendiculars = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 0, 0)
  ];

  axisDirections.forEach((dir, axisIndex) => {
    const perpendicular = tickPerpendiculars[axisIndex];
    const tickPositions = [];

    for (let stepIndex = -tickCount; stepIndex <= tickCount; stepIndex += 1) {
      if (stepIndex === 0) {
        continue;
      }

      const distance = stepIndex * tickStep;
      const center = dir.clone().multiplyScalar(distance);
      const start = center.clone().add(perpendicular.clone().multiplyScalar(-tickHalfLength));
      const end = center.clone().add(perpendicular.clone().multiplyScalar(tickHalfLength));
      tickPositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }

    axisTickSegments[axisIndex].geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(tickPositions, 3)
    );
    axisTickSegments[axisIndex].geometry.computeBoundingSphere();
  });
}

function dotArray(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subArray(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleArray(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function crossArray(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function uniquePoints(points, tolerance = 1e-6) {
  const unique = [];
  points.forEach((point) => {
    const exists = unique.some((candidate) =>
      Math.abs(candidate[0] - point[0]) <= tolerance &&
      Math.abs(candidate[1] - point[1]) <= tolerance &&
      Math.abs(candidate[2] - point[2]) <= tolerance
    );
    if (!exists) {
      unique.push(point.slice());
    }
  });
  return unique;
}

function spanBasis(A) {
  const columns = [column(A, 0), column(A, 1), column(A, 2)];
  const basis = [];

  columns.forEach((candidate) => {
    if (norm(candidate) < EPS) {
      return;
    }

    let residual = candidate.slice();
    basis.forEach((b) => {
      const projection = dotArray(residual, b);
      residual = subArray(residual, scaleArray(b, projection));
    });

    const residualNorm = norm(residual);
    if (residualNorm > 1e-6) {
      basis.push(scaleArray(residual, 1 / residualNorm));
    }
  });

  return basis;
}

function clearFilledGeometry() {
  boxGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  boxGeometry.setIndex([]);
  boxMesh.visible = false;
}

function setEdgePositions(flatPositions) {
  edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(flatPositions, 3));
  edgeGeometry.setIndex(null);
  edgeGeometry.computeBoundingSphere();
  edgeSegments.visible = flatPositions.length > 0;
}

function buildPlaneHull(vertices, basis) {
  const unique = uniquePoints(vertices);
  const u = basis[0];
  const provisionalV = basis[1];
  const normal = normalize(crossArray(u, provisionalV));
  const v = normalize(crossArray(normal, u));

  const projected = unique.map((point) => ({
    point,
    x: dotArray(point, u),
    y: dotArray(point, v)
  }));

  const deduped = [];
  projected.forEach((entry) => {
    const exists = deduped.some((candidate) =>
      Math.abs(candidate.x - entry.x) <= 1e-6 &&
      Math.abs(candidate.y - entry.y) <= 1e-6
    );
    if (!exists) {
      deduped.push(entry);
    }
  });

  const centroid = deduped.reduce(
    (sum, entry) => ({ x: sum.x + entry.x, y: sum.y + entry.y }),
    { x: 0, y: 0 }
  );
  centroid.x /= deduped.length;
  centroid.y /= deduped.length;

  deduped.sort((a, b) =>
    Math.atan2(a.y - centroid.y, a.x - centroid.x) - Math.atan2(b.y - centroid.y, b.x - centroid.x)
  );

  return deduped.map((entry) => entry.point);
}

function updateBoxGeometry(A) {
  const vertices = parallelepipedVertices(A);
  const basis = spanBasis(A);

  if (basis.length >= 3) {
    const positions = vertices.flat();
    const faceIndices = [
      0, 1, 4, 0, 4, 2,
      0, 1, 5, 0, 5, 3,
      0, 2, 6, 0, 6, 3,
      1, 4, 7, 1, 7, 5,
      2, 4, 7, 2, 7, 6,
      3, 5, 7, 3, 7, 6
    ];

    boxGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    boxGeometry.setIndex(faceIndices);
    boxGeometry.computeVertexNormals();
    boxMesh.visible = true;

    const edgeIndices = [
      0, 1, 0, 2, 0, 3,
      1, 4, 1, 5,
      2, 4, 2, 6,
      3, 5, 3, 6,
      4, 7, 5, 7, 6, 7
    ];

    edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    edgeGeometry.setIndex(edgeIndices);
    edgeGeometry.computeBoundingSphere();
    edgeSegments.visible = true;
  } else if (basis.length === 2) {
    const hull = buildPlaneHull(vertices, basis);
    const positions = hull.flat();
    const faceIndices = [];
    for (let i = 1; i < hull.length - 1; i += 1) {
      faceIndices.push(0, i, i + 1);
    }

    boxGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    boxGeometry.setIndex(faceIndices);
    boxGeometry.computeVertexNormals();
    boxMesh.visible = hull.length >= 3;

    const edgePositions = [];
    for (let i = 0; i < hull.length; i += 1) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      edgePositions.push(...a, ...b);
    }
    setEdgePositions(edgePositions);
  } else if (basis.length === 1) {
    clearFilledGeometry();

    const direction = basis[0];
    let minPoint = vertices[0];
    let maxPoint = vertices[0];
    let minProjection = dotArray(vertices[0], direction);
    let maxProjection = minProjection;

    vertices.forEach((point) => {
      const projection = dotArray(point, direction);
      if (projection < minProjection) {
        minProjection = projection;
        minPoint = point;
      }
      if (projection > maxProjection) {
        maxProjection = projection;
        maxPoint = point;
      }
    });

    setEdgePositions([...minPoint, ...maxPoint]);
  } else {
    clearFilledGeometry();
    setEdgePositions([]);
  }

  for (let i = 0; i < 3; i += 1) {
    const vec = column(A, i);
    const length = norm(vec);
    const direction = length < EPS ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(...normalize(vec));
    const arrow = arrowHelpers[i];
    arrow.position.set(0, 0, 0);
    arrow.setDirection(direction);
    arrow.setLength(Math.max(length, 0.001), Math.min(0.38, Math.max(0.18, 0.18 * length)), Math.min(0.16, Math.max(0.08, 0.08 * length)));
    arrow.visible = length >= EPS;
  }
}

function updateMirror(step, axisLength) {
  if (!step.H) {
    appState.mirrorTargetOpacity = 0;
    return;
  }

  const normal = symmetricEigenvectorForMinusOne(step.H);
  const normalVec = new THREE.Vector3(...normal).normalize();
  mirrorMesh.visible = true;
  mirrorMesh.position.set(0, 0, 0);
  mirrorMesh.scale.setScalar(axisLength * 1.85);
  mirrorMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVec);
  appState.mirrorTargetOpacity = 0.8;
}

function formatNumber(value) {
  const rounded = Math.abs(value) < 1e-10 ? 0 : value;
  return Number(rounded.toFixed(4)).toString();
}

function formatTupleNumber(value) {
  const rounded = Math.abs(value) < 1e-10 ? 0 : value;
  return rounded.toFixed(1);
}

function currentOrientationLabel() {
  const reflectionsApplied = appState.steps
    .slice(0, appState.currentIndex + 1)
    .filter((step) => step.title.startsWith("Reflect "))
    .length;

  return reflectionsApplied % 2 === 0 ? "Standard" : "Inverted";
}

function currentLengths() {
  return [0, 1, 2].map((i) => norm(column(appState.currentMatrix, i)));
}

const appState = {
  steps: [],
  determinant: 0,
  currentIndex: 0,
  axisLength: 4,
  rankDeficient: false,
  animationFrame: null,
  currentMatrix: zeroMatrix(),
  mirrorOpacity: 0,
  mirrorTargetOpacity: 0,
  zoomAnimationFrame: null
};

function setMatrixInputs(A) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      matrixInputs[row * 3 + col].value = A[row][col];
    }
  }
}

function getMatrixInputs() {
  const A = zeroMatrix();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const raw = matrixInputs[row * 3 + col].value.trim();
      if (raw === "") {
        throw new Error("Every matrix entry must be filled in.");
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error("Matrix entries must be finite real numbers.");
      }
      A[row][col] = value;
    }
  }
  return A;
}

function updateStatus() {
  const step = appState.steps[appState.currentIndex];
  const lengths = currentLengths();
  ui.stepValue.textContent = `${appState.currentIndex + 1} / ${appState.steps.length}`;
  ui.stepMessage.textContent = appState.rankDeficient
    ? `${step.title}. The determinant is 0, and the animated walkthrough is disabled because the spanning vectors are linearly dependent.`
    : step.title;
  ui.volumeValue.textContent = formatNumber(Math.abs(appState.determinant));
  ui.orientationValue.textContent = currentOrientationLabel();
  ui.determinantValue.textContent = formatNumber(appState.determinant);
  ui.lengthsValue.textContent = `(${formatTupleNumber(lengths[0])}, ${formatTupleNumber(lengths[1])}, ${formatTupleNumber(lengths[2])})`;

  ui.prevButton.disabled = appState.currentIndex === 0;
  ui.nextButton.disabled = appState.currentIndex >= appState.steps.length - 1;
  ui.resetButton.disabled = appState.steps.length === 0 || appState.currentIndex === 0;
}

function renderStep(step) {
  appState.currentMatrix = step.A;
  updateBoxGeometry(step.A);
  updateMirror(step, appState.axisLength);
  updateStatus();
}

function cancelAnimationIfNeeded() {
  if (appState.animationFrame !== null) {
    cancelAnimationFrame(appState.animationFrame);
    appState.animationFrame = null;
  }
}

function animateToStep(targetIndex) {
  if (targetIndex < 0 || targetIndex >= appState.steps.length || targetIndex === appState.currentIndex) {
    return;
  }

  cancelAnimationIfNeeded();

  const fromStep = appState.steps[appState.currentIndex];
  const toStep = appState.steps[targetIndex];
  const duration = 420;
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const interpolatedA = lerpMatrix(fromStep.A, toStep.A, eased);
    updateBoxGeometry(interpolatedA);

    if (fromStep.H && toStep.H && matricesClose(fromStep.H, toStep.H)) {
      updateMirror(toStep, appState.axisLength);
    } else if (!fromStep.H && toStep.H) {
      updateMirror(toStep, appState.axisLength);
    } else if (fromStep.H && !toStep.H) {
      updateMirror(fromStep, appState.axisLength);
    } else {
      appState.mirrorTargetOpacity = 0;
    }

    if (t < 1) {
      appState.animationFrame = requestAnimationFrame(frame);
      return;
    }

    appState.currentIndex = targetIndex;
    appState.animationFrame = null;
    renderStep(appState.steps[appState.currentIndex]);
  }

  appState.animationFrame = requestAnimationFrame(frame);
}

function resetCamera() {
  camera.position.set(appState.axisLength * 1.9, appState.axisLength * 1.55, appState.axisLength * 1.9);
  controls.target.set(0, 0, 0);
  camera.near = 0.1;
  camera.far = Math.max(200, appState.axisLength * 14);
  camera.updateProjectionMatrix();
  controls.update();
}

function zoomCamera(scaleFactor) {
  if (appState.zoomAnimationFrame !== null) {
    cancelAnimationFrame(appState.zoomAnimationFrame);
    appState.zoomAnimationFrame = null;
  }

  const startOffset = camera.position.clone().sub(controls.target);
  const endOffset = startOffset.clone().multiplyScalar(scaleFactor);
  const duration = 240;
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const currentOffset = startOffset.clone().lerp(endOffset, eased);
    camera.position.copy(controls.target.clone().add(currentOffset));
    controls.update();

    if (t < 1) {
      appState.zoomAnimationFrame = requestAnimationFrame(frame);
      return;
    }

    appState.zoomAnimationFrame = null;
  }

  appState.zoomAnimationFrame = requestAnimationFrame(frame);
}

function loadMatrix(A) {
  cancelAnimationIfNeeded();
  const { determinant, steps, rankDeficient } = buildStepSequence(A);
  appState.steps = steps;
  appState.determinant = determinant;
  appState.currentIndex = 0;
  appState.rankDeficient = rankDeficient;

  let extent = 1;
  steps.forEach((step) => {
    extent = Math.max(extent, maxAbsEntry(step.A));
  });
  appState.axisLength = Math.max(1.8, extent * 1.08);

  updateAxisLength(appState.axisLength);
  resetCamera();
  renderStep(steps[0]);
}

function resizeRenderer() {
  const rect = ui.viewer.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateProjectedLabels() {
  const rect = ui.viewer.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const axisOffset = appState.axisLength * 1.04;
  const vectorOffset = Math.max(0.18, appState.axisLength * 0.05);

  const positions = {
    x: [axisOffset, 0, 0],
    y: [0, axisOffset, 0],
    z: [0, 0, axisOffset],
    a1: addLabelOffset(column(appState.currentMatrix, 0), vectorOffset),
    a2: addLabelOffset(column(appState.currentMatrix, 1), vectorOffset),
    a3: addLabelOffset(column(appState.currentMatrix, 2), vectorOffset)
  };

  sceneLabels.forEach((label) => {
    const point = positions[label.key];
    const vec = new THREE.Vector3(point[0], point[1], point[2]);
    vec.project(camera);

    const visible = vec.z >= -1 && vec.z <= 1;
    label.element.style.display = visible ? "block" : "none";
    if (!visible) {
      return;
    }

    label.element.style.left = `${((vec.x + 1) / 2) * width}px`;
    label.element.style.top = `${((-vec.y + 1) / 2) * height}px`;
  });
}

function addLabelOffset(vector, offset) {
  const length = norm(vector);
  if (length < EPS) {
    return [offset, offset, offset];
  }
  const unit = normalize(vector);
  return [
    vector[0] + unit[0] * offset,
    vector[1] + unit[1] * offset,
    vector[2] + unit[2] * offset
  ];
}

function renderLoop() {
  controls.update();
  appState.mirrorOpacity += (appState.mirrorTargetOpacity - appState.mirrorOpacity) * 0.18;
  if (appState.mirrorOpacity < 0.01 && appState.mirrorTargetOpacity === 0) {
    appState.mirrorOpacity = 0;
    mirrorMesh.visible = false;
  }
  if (appState.mirrorOpacity > 0 || appState.mirrorTargetOpacity > 0) {
    mirrorMesh.visible = true;
  }
  mirrorMaterial.opacity = appState.mirrorOpacity;
  updateProjectedLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

ui.applyButton.addEventListener("click", () => {
  try {
    loadMatrix(getMatrixInputs());
  } catch (error) {
    ui.stepMessage.textContent = error.message;
  }
});

ui.prevButton.addEventListener("click", () => animateToStep(appState.currentIndex - 1));
ui.nextButton.addEventListener("click", () => animateToStep(appState.currentIndex + 1));
ui.resetButton.addEventListener("click", () => {
  cancelAnimationIfNeeded();
  appState.currentIndex = 0;
  renderStep(appState.steps[0]);
});
ui.zoomInButton.addEventListener("click", () => zoomCamera(0.85));
ui.zoomOutButton.addEventListener("click", () => zoomCamera(1.18));
ui.homeButton.addEventListener("click", () => resetCamera());

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    animateToStep(appState.currentIndex - 1);
  }
  if (event.key === "ArrowRight") {
    animateToStep(appState.currentIndex + 1);
  }
});

window.addEventListener("resize", resizeRenderer);

setMatrixInputs(EXAMPLE_MATRIX);
resizeRenderer();
loadMatrix(EXAMPLE_MATRIX);
renderLoop();
