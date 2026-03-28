const EPS = 1e-9;

export function cloneMatrix(A) {
  return A.map((row) => row.slice());
}

export function zeroMatrix() {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
}

export function identityMatrix() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
}

export function column(A, j) {
  return [A[0][j], A[1][j], A[2][j]];
}

export function transpose(A) {
  return A[0].map((_, i) => A.map((row) => row[i]));
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function norm(v) {
  return Math.sqrt(dot(v, v));
}

export function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function normalize(v) {
  const length = norm(v);
  if (length < EPS) {
    return [0, 0, 0];
  }
  return scale(v, 1 / length);
}

export function matrixMultiply(A, B) {
  const out = zeroMatrix();
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) {
        sum += A[i][k] * B[k][j];
      }
      out[i][j] = sum;
    }
  }
  return out;
}

export function diagMatrix(values) {
  return [
    [values[0], 0, 0],
    [0, values[1], 0],
    [0, 0, values[2]]
  ];
}

export function lerpMatrix(A, B, t) {
  const out = zeroMatrix();
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      out[i][j] = A[i][j] + (B[i][j] - A[i][j]) * t;
    }
  }
  return out;
}

export function maxAbsEntry(A) {
  let maxValue = 1;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      maxValue = Math.max(maxValue, Math.abs(A[i][j]));
    }
  }
  return maxValue;
}

export function determinant3(A) {
  return (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  );
}

export function matricesClose(A, B, tolerance = 1e-7) {
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (Math.abs(A[i][j] - B[i][j]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

export function vectorsClose(a, b, tolerance = 1e-7) {
  return Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance;
}

export function qrDecomp(A) {
  const columns = [column(A, 0), column(A, 1), column(A, 2)];
  const qColumns = [];
  const rColumns = [];

  columns.forEach((col) => {
    let v = col.slice();
    const rCol = [];

    qColumns.forEach((q) => {
      const projection = dot(v, q);
      rCol.push(projection);
      v = sub(v, scale(q, projection));
    });

    const rjj = norm(v);
    if (rjj < 1e-8) {
      throw new Error("matrix is not full rank");
    }

    rCol.push(rjj);
    while (rCol.length < 3) {
      rCol.push(0);
    }

    qColumns.push(scale(v, 1 / rjj));
    rColumns.push(rCol);
  });

  const Q = transpose(qColumns);
  const R = transpose(rColumns);
  return { Q, R };
}

export function householderMatrix(x, y) {
  const diff = sub(y, x);
  const length = norm(diff);
  if (length < EPS) {
    return identityMatrix();
  }

  const u = scale(diff, 1 / length);
  const H = zeroMatrix();
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      H[i][j] = (i === j ? 1 : 0) - 2 * u[i] * u[j];
    }
  }
  return H;
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function symmetricEigenvectorForMinusOne(H) {
  const rows = H.map((row, i) => row.map((value, j) => value + (i === j ? 1 : 0)));
  const candidates = [
    cross(rows[0], rows[1]),
    cross(rows[0], rows[2]),
    cross(rows[1], rows[2])
  ];

  let best = candidates[0];
  let bestNorm = norm(best);

  candidates.forEach((candidate) => {
    const candidateNorm = norm(candidate);
    if (candidateNorm > bestNorm) {
      best = candidate;
      bestNorm = candidateNorm;
    }
  });

  if (bestNorm < EPS) {
    return [1, 0, 0];
  }
  return scale(best, 1 / bestNorm);
}

export function gramSchmidtStepMatrices(Q, R) {
  const R0 = cloneMatrix(R);
  const steps = [
    { title: "Original", A: matrixMultiply(Q, R0), H: null, mode: "full" }
  ];

  let currentR = cloneMatrix(R);
  const eliminations = [
    { row: 0, col: 1, title: "Remove a1 from a2" },
    { row: 0, col: 2, title: "Remove a1 from a3" },
    { row: 1, col: 2, title: "Remove a2 from a3" }
  ];

  eliminations.forEach(({ row, col, title }) => {
    if (Math.abs(currentR[row][col]) <= 1e-8) {
      return;
    }

    const nextR = cloneMatrix(currentR);
    nextR[row][col] = 0;
    steps.push({ title, A: matrixMultiply(Q, nextR), H: null, mode: "full" });
    currentR = nextR;
  });

  return steps;
}

export function householderStepMatrices(Q, R) {
  let box = matrixMultiply(Q, diagMatrix([R[0][0], R[1][1], R[2][2]]));
  const reflections = [];
  const workingQ = cloneMatrix(Q);
  const I = identityMatrix();

  for (let i = 0; i < 3; i += 1) {
    const qCol = column(workingQ, i);
    const axis = column(I, i);
    if (vectorsClose(qCol, axis)) {
      continue;
    }

    const H = householderMatrix(axis, qCol);
    const nextQ = matrixMultiply(H, workingQ);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        workingQ[r][c] = nextQ[r][c];
      }
    }

    reflections.push({ axisIndex: i, H });
  }

  const steps = [];
  reflections.forEach(({ axisIndex, H }) => {
    const axisLabels = ["x", "y", "z"];
    steps.push({ title: "Place mirror", A: cloneMatrix(box), H, mode: "mirror" });
    box = matrixMultiply(H, box);
    steps.push({ title: `Reflect a${axisIndex + 1} onto ${axisLabels[axisIndex]}`, A: cloneMatrix(box), H, mode: "full" });
  });

  if (steps.length > 0) {
    steps.push({ title: "Done", A: cloneMatrix(box), H: null, mode: "full" });
  }

  return steps;
}

export function buildStepSequence(A) {
  const det = determinant3(A);
  try {
    const { Q, R } = qrDecomp(A);
    const steps = gramSchmidtStepMatrices(Q, R).concat(householderStepMatrices(Q, R));
    return { determinant: det, steps, rankDeficient: false };
  } catch (error) {
    return {
      determinant: det,
      steps: [{ title: "Original", A: cloneMatrix(A), H: null, mode: "full" }],
      rankDeficient: true
    };
  }
}

export function parallelepipedVertices(A) {
  const a1 = column(A, 0);
  const a2 = column(A, 1);
  const a3 = column(A, 2);
  return [
    [0, 0, 0],
    a1,
    a2,
    a3,
    add(a1, a2),
    add(a1, a3),
    add(a2, a3),
    add(add(a1, a2), a3)
  ];
}

export { EPS };
