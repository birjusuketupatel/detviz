import numpy as np
from det import my_det

rng = np.random.default_rng(0)

tests = 0
failures = 0

for n in range(2, 11):                # matrix sizes 1x1 through 8x8
    for _ in range(2000):            # 2000 matrices per size
        A = rng.integers(-10, 11, size=(n, n)).astype(float)
                
        expected = np.linalg.det(A)
        actual = my_det(A)
                
        if not np.isclose(expected, actual, atol=1e-6):
            failures += 1
            print("Failure detected")
            print("Matrix:\n", A)
            print("NumPy det:", expected)
            print("my_det:", actual)
            print()

        tests += 1

print("Total tests:", tests)
print("Failures:", failures)