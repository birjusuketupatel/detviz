import numpy as np

def qr_decomp(A):
    # uses Gram-Schmidt process to complete QR decomposition of a given square matrix
    Q = []
    R = []

    for col in A.T:
        v = col.copy()
        r_col = []
        
        for q in Q:
            a = np.dot(v, q)
            r_col.append(a)
            v = v - a * q
        
        r_jj = np.linalg.norm(v)
        
        if np.isclose(r_jj, 0):
            raise ValueError("matrix is not full rank, no QR decomposition exists")
        
        r_col.append(r_jj)
        
        q_next = v / r_jj
        Q.append(q_next)
        
        # pad columns of R so it is upper triangular
        while len(r_col) < A.shape[1]:
            r_col.append(0)
        
        R.append(r_col)

    Q = np.column_stack(Q)
    R = np.array(R).T

    return Q, R

def householder_matrix(x, y):
    # given an origin vector x and target vector y
    # finds the Householder reflection matrix H that reflects x onto y
    u = (y - x) / np.linalg.norm(y - x)
    u = u.reshape(-1,1)
    I = np.eye(u.shape[0])

    H = I - 2 * u @ u.T
    
    return H

def sign(Q):
    # given some orthonormal matrix Q
    # determines the determinant by attempting to map it to the standard normal basis
    # via n - 1 Householder reflections    
    Q = Q.copy()
    n = Q.shape[0]
    
    I = np.eye(n)
    
    k = 0
    
    for i in range(0, n-1):
        if np.allclose(Q[:, i], I[:, i]):
            continue
        
        H = householder_matrix(I[:, i], Q[:, i])
        Q = H @ Q
        
        k += 1
    
    # if Q[n-1,n-1] is -1, 1 more reflection is needed to bring Q to the standard normal basis
    # each reflection inverts space, so flips sign of determinant
    # sign = (-1)^k, k = number of reflections
    # even number of reflections -> sign = +1
    # odd number of reflections -> sign = -1
    
    return ((-1) ** k) * Q[n-1, n-1]

def my_det(A):
    # computes determinant of a square matrix
    if A.shape[0] != A.shape[1]:
        raise ValueError("determinant is only defined for square matrices")
    
    try:
        Q, R = qr_decomp(A)
    except ValueError:
        # if no QR decomposition exists, matrix has linearly dependent columns
        # so determinant is 0
        return 0.0
    
    orientation = sign(Q)
    volume = np.prod(np.diag(R))

    return orientation * volume


if __name__ == "__main__":
    # det(A) = 30
    A = np.array([
        [1.0, 7.0, -2.0],
        [1.0, 7.0, -4.0],
        [1.0, -8.0, 3.0]
    ])
    
    print("A =")
    print(np.array2string(A, precision=3, suppress_small=True))
    
    print("NumPy Implementation: det(A) = {}".format(np.linalg.det(A)))

    print("My Implementation: det(A) = {}".format(my_det(A)))