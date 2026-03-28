import numpy as np
import pyvista as pv
from det import *

def parallelepiped_vertices(A):
    a1, a2, a3 = A[:, 0], A[:, 1], A[:, 2]
    return np.array([
        [0, 0, 0],
        a1,
        a2,
        a3,
        a1 + a2,
        a1 + a3,
        a2 + a3,
        a1 + a2 + a3
    ], dtype=float)


def add_parallelepiped_edges(plotter, V):
    actors = []
    edges = [
        (0, 1), (0, 2), (0, 3),
        (1, 4), (1, 5),
        (2, 4), (2, 6),
        (3, 5), (3, 6),
        (4, 7), (5, 7), (6, 7)
    ]
    for i, j in edges:
        pts = np.array([V[i], V[j]])
        actors.append(plotter.add_lines(pts, color="gray", width=1.5))
    return actors


def add_vector(plotter, start, direction, color="red"):
    thickness = 0.06
    tip_scale = 2.5
    tip_length = 0.35

    start = np.asarray(start, dtype=float)
    direction = np.asarray(direction, dtype=float)

    length = np.linalg.norm(direction)
    if np.isclose(length, 0):
        return []

    u = direction / length
    shaft_radius = thickness
    tip_radius = thickness * tip_scale

    actual_tip_length = min(tip_length, 0.35 * length)
    shaft_end = start + u * (length - actual_tip_length)
    tip_center = shaft_end + u * (actual_tip_length / 2.0)

    shaft = pv.Line(start, shaft_end).tube(radius=shaft_radius)
    tip = pv.Cone(
        center=tip_center,
        direction=u,
        height=actual_tip_length,
        radius=tip_radius,
        resolution=40
    )

    shaft_actor = plotter.add_mesh(shaft, color=color)
    tip_actor = plotter.add_mesh(tip, color=color)
    return [shaft_actor, tip_actor]


def draw_axis(plotter, direction, length):
    direction = np.asarray(direction, dtype=float)
    direction = direction / np.linalg.norm(direction)
    pts = np.array([
        -direction * length,
        direction * length
    ])
    return plotter.add_lines(pts, color="gray", width=1.5)
    

def gram_schmidt_step_matrices(Q, R):
    R0 = R.copy()

    R1 = R.copy()
    R1[0, 1] = 0.0

    R2 = R1.copy()
    R2[0, 2] = 0.0

    R3 = R2.copy()
    R3[1, 2] = 0.0

    return [
        ("Original", Q @ R0),
        ("Remove a1 from a2", Q @ R1),
        ("Remove a1 from a3", Q @ R2),
        ("Remove a2 from a3", Q @ R3),
    ]


def householder_step_matrices(Q, R):
    box = Q @ np.diag(np.diag(R))
    
    # find Householder matrices that aligns each vector in Q to i-hat, j-hat, and k-hat
    reflections = []
    
    Q = Q.copy()
    n = Q.shape[0]
    
    I = np.eye(n)
    
    k = 0
    
    for i in range(0, n):
        if np.allclose(Q[:, i], I[:, i]):
            continue
        
        H = householder_matrix(I[:, i], Q[:, i])
        Q = H @ Q
        
        k += 1
        reflections.append(("reflect a{} onto axis".format(i + 1), H))
    
    steps = []
        
    for msg, H in reflections:
        steps.append((msg, H @ box))
        box = H @ box
    
    return steps
    

def step_viewer(steps):
    V0 = parallelepiped_vertices(steps[0][1])
    max_extent = max(1.0, np.max(np.abs(V0)))
    axis_len = 1.25 * max_extent

    plotter = pv.Plotter()
    plotter.enable_anti_aliasing("msaa", multi_samples=16)

    # static scene
    draw_axis(plotter, [1, 0, 0], axis_len)
    draw_axis(plotter, [0, 1, 0], axis_len)
    draw_axis(plotter, [0, 0, 1], axis_len)

    plotter.add_point_labels(
        [[axis_len, 0, 0], [0, axis_len, 0], [0, 0, axis_len]],
        ["x", "y", "z"],
        font_size=18,
        text_color="black",
        shape_opacity=0,
        show_points=False
    )

    plotter.add_mesh(pv.Sphere(radius=0.1, center=(0, 0, 0)), color="black")
    plotter.camera_position = "xz"
    plotter.camera.zoom(1.5)

    state = {"idx": 0}
    dynamic_actors = []
    span_colors = ["red", "green", "blue"]
    span_labels = ["a1", "a2", "a3"]

    def clear_dynamic():
        nonlocal dynamic_actors
        for actor in dynamic_actors:
            plotter.remove_actor(actor)
        dynamic_actors = []

    def draw_current_step():
        clear_dynamic()

        title, A = steps[state["idx"]]
        V = parallelepiped_vertices(A)

        faces = np.hstack([
            [4, 0, 1, 4, 2],
            [4, 0, 1, 5, 3],
            [4, 0, 2, 6, 3],
            [4, 1, 4, 7, 5],
            [4, 2, 4, 7, 6],
            [4, 3, 5, 7, 6]
        ])

        mesh = pv.PolyData(V, faces)
        dynamic_actors.append(
            plotter.add_mesh(mesh, color="lightblue", opacity=0.4, lighting=False)
        )

        dynamic_actors.extend(add_parallelepiped_edges(plotter, V))

        for i in range(3):
            dynamic_actors.extend(
                add_vector(plotter, (0, 0, 0), A[:, i], color=span_colors[i])
            )

            direction = A[:, i] / np.linalg.norm(A[:, i])
            label_pos = A[:, i] + 0.4 * direction

            dynamic_actors.append(
                plotter.add_point_labels(
                    [label_pos],
                    [span_labels[i]],
                    font_size=18,
                    text_color=span_colors[i],
                    shape_opacity=0,
                    show_points=False
                )
            )

        plotter.add_text(
            f"Step {state['idx'] + 1}/{len(steps)}: {title}",
            position="upper_left",
            font_size=12,
            name="step_text"
        )

        plotter.render()

    def next_step():
        if state["idx"] < len(steps) - 1:
            state["idx"] += 1
            draw_current_step()

    def prev_step():
        if state["idx"] > 0:
            state["idx"] -= 1
            draw_current_step()

    plotter.add_key_event("Right", next_step)
    plotter.add_key_event("Left", prev_step)

    draw_current_step()
    plotter.show()


if __name__ == "__main__":
    A = np.array([
        [1.0, 7.0, -2.0],
        [1.0, 7.0, -4.0],
        [1.0, -8.0, 3.0]
    ])

    Q, R = qr_decomp(A)
    
    volume= gram_schmidt_step_matrices(Q, R)
    
    orientation = householder_step_matrices(Q, R)
    
    step_viewer(volume + orientation)