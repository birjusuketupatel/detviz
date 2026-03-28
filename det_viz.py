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


def parallelepiped_edge_mesh(V):
    edges = [
        (0, 1), (0, 2), (0, 3),
        (1, 4), (1, 5),
        (2, 4), (2, 6),
        (3, 5), (3, 6),
        (4, 7), (5, 7), (6, 7)
    ]
    lines = np.hstack([np.array([2, i, j]) for i, j in edges]).astype(np.int64)
    return pv.PolyData(V, lines=lines)


def vector_mesh(start, direction):
    thickness = 0.06
    tip_scale = 2.5
    tip_length = 0.35
    resolution = 40

    start = np.asarray(start, dtype=float)
    direction = np.asarray(direction, dtype=float)

    length = np.linalg.norm(direction)
    if np.isclose(length, 0):
        return None

    u = direction / length
    shaft_radius = thickness
    tip_radius = thickness * tip_scale

    actual_tip_length = min(tip_length, 0.35 * length)
    shaft_end = start + u * (length - actual_tip_length)
    tip_center = shaft_end + u * (actual_tip_length / 2.0)

    shaft = pv.Line(start, shaft_end).tube(radius=shaft_radius, n_sides=resolution)
    tip = pv.Cone(
        center=tip_center,
        direction=u,
        height=actual_tip_length,
        radius=tip_radius,
        resolution=resolution
    )

    return shaft.merge(tip)


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
        ("Original", Q @ R0, None, "full"),
        ("Remove a1 from a2", Q @ R1, None, "full"),
        ("Remove a1 from a3", Q @ R2, None, "full"),
        ("Remove a2 from a3", Q @ R3, None, "full"),
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
        # First show mirror plane for the upcoming reflection without redrawing the box
        steps.append((f"Show mirror for {msg}", box, H, "mirror"))
        # Then show the reflected box
        box = H @ box
        steps.append((msg, box, H, "full"))
    
    if steps:
        steps.append(("Done", box, None, "full"))

    return steps
    

def step_viewer(steps):
    V0 = parallelepiped_vertices(steps[0][1])
    max_extent = max(1.0, np.max(np.abs(V0)))
    axis_len = 1.25 * max_extent
    gs_frames = 40
    mirror_fade_frames = 12
    mirror_opacity = 0.8

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
    box_mesh = None
    edge_mesh = None
    vector_meshes = []
    box_actor = None
    edge_actor = None
    vector_actors = []
    label_actors = []
    mirror_actor = None
    mirror_state = {"key": None}
    span_colors = ["red", "green", "blue"]
    span_labels = ["a1", "a2", "a3"]

    def clear_actors(actors):
        for actor in actors:
            plotter.remove_actor(actor)
        actors.clear()

    def clear_box():
        nonlocal box_mesh, edge_mesh, vector_meshes, box_actor, edge_actor, vector_actors, label_actors
        if box_actor is not None:
            plotter.remove_actor(box_actor)
            box_actor = None
        if edge_actor is not None:
            plotter.remove_actor(edge_actor)
            edge_actor = None
        box_mesh = None
        edge_mesh = None
        vector_meshes = []
        clear_actors(vector_actors)
        clear_actors(label_actors)

    def update_labels(A):
        clear_actors(label_actors)
        for i in range(3):
            direction = A[:, i] / np.linalg.norm(A[:, i])
            label_pos = A[:, i] + 0.4 * direction
            label_actors.append(
                plotter.add_point_labels(
                    [label_pos],
                    [span_labels[i]],
                    font_size=18,
                    text_color=span_colors[i],
                    shape_opacity=0,
                    show_points=False
                )
            )

    def build_box(V, A):
        nonlocal box_mesh, edge_mesh, vector_meshes, box_actor, edge_actor, vector_actors
        faces = np.hstack([
            [4, 0, 1, 4, 2],
            [4, 0, 1, 5, 3],
            [4, 0, 2, 6, 3],
            [4, 1, 4, 7, 5],
            [4, 2, 4, 7, 6],
            [4, 3, 5, 7, 6]
        ])

        box_mesh = pv.PolyData(V, faces)
        box_actor = plotter.add_mesh(box_mesh, color="lightblue", opacity=0.2, lighting=False)

        edge_mesh = parallelepiped_edge_mesh(V)
        edge_actor = plotter.add_mesh(edge_mesh, color="gray", line_width=1.5)

        vector_meshes = []
        clear_actors(vector_actors)
        for i in range(3):
            mesh = vector_mesh((0, 0, 0), A[:, i])
            vector_meshes.append(mesh)
            if mesh is not None:
                vector_actors.append(plotter.add_mesh(mesh, color=span_colors[i]))

        update_labels(A)

    def update_box(V, A, update_label_positions=True):
        if box_mesh is None or edge_mesh is None:
            build_box(V, A)
            return

        box_mesh.points = V
        edge_mesh.points = V

        for i in range(3):
            mesh = vector_mesh((0, 0, 0), A[:, i])
            if mesh is None:
                continue
            if i < len(vector_meshes) and vector_meshes[i] is not None:
                vector_meshes[i].points = mesh.points

        if update_label_positions:
            update_labels(A)

    def fade_mirror_opacity(target_opacity):
        nonlocal mirror_actor
        if mirror_actor is None:
            return
        start_opacity = mirror_actor.GetProperty().GetOpacity()
        if np.isclose(start_opacity, target_opacity):
            return
        for t in np.linspace(0.0, 1.0, mirror_fade_frames):
            opacity = start_opacity + t * (target_opacity - start_opacity)
            mirror_actor.GetProperty().SetOpacity(opacity)
            plotter.render()

    def draw_current_step(skip_box_rebuild=False):
        nonlocal box_mesh, edge_mesh, mirror_actor
        title, A, H, mode = steps[state["idx"]]
        desired_mirror_key = id(H) if H is not None else None

        if mode == "full" and H is None and not skip_box_rebuild and title != "Done":
            clear_box()
        if desired_mirror_key != mirror_state["key"]:
            if mirror_actor is not None:
                fade_mirror_opacity(0.0)
                plotter.remove_actor(mirror_actor)
                mirror_actor = None
            mirror_state["key"] = None

        V = parallelepiped_vertices(A)

        if mode == "full" and not skip_box_rebuild and title != "Done":
            if H is None:
                build_box(V, A)
            else:
                update_box(V, A)
        elif mode == "mirror" and H is not None:
            update_box(V, A, update_label_positions=False)

        if H is not None and mirror_state["key"] != desired_mirror_key:
            eigvals, eigvecs = np.linalg.eigh(H)
            normal = eigvecs[:, np.argmin(eigvals)]
            plane = pv.Plane(
                center=(0, 0, 0),
                direction=normal,
                i_size=1.75*axis_len,
                j_size=1.75*axis_len,
                i_resolution=1,
                j_resolution=1
            )
            mirror_actor = plotter.add_mesh(
                plane,
                color="silver",
                opacity=0.0,
                lighting=False
            )
            fade_mirror_opacity(mirror_opacity)
            mirror_state["key"] = desired_mirror_key

        plotter.add_text(
            f"Step {state['idx'] + 1}/{len(steps)}: {title}",
            position="upper_left",
            font_size=12,
            name="step_text"
        )

        plotter.render()

    def animate_gs_transition(A_from, A_to):
        if box_mesh is None:
            build_box(parallelepiped_vertices(A_from), A_from)
        for t in np.linspace(0.0, 1.0, gs_frames):
            A = (1.0 - t) * A_from + t * A_to
            V = parallelepiped_vertices(A)
            update_box(V, A, update_label_positions=False)
            plotter.render()
        update_labels(A_to)

    def next_step():
        if state["idx"] < len(steps) - 1:
            cur_title, cur_A, cur_H, cur_mode = steps[state["idx"]]
            next_title, next_A, next_H, next_mode = steps[state["idx"] + 1]
            skip_box_rebuild = False
            if cur_H is None and next_H is None:
                animate_gs_transition(cur_A, next_A)
                skip_box_rebuild = True
            state["idx"] += 1
            draw_current_step(skip_box_rebuild=skip_box_rebuild)

    def prev_step():
        if state["idx"] > 0:
            cur_title, cur_A, cur_H, cur_mode = steps[state["idx"]]
            prev_title, prev_A, prev_H, prev_mode = steps[state["idx"] - 1]
            skip_box_rebuild = False
            if cur_H is None and prev_H is None:
                animate_gs_transition(cur_A, prev_A)
                skip_box_rebuild = True
            state["idx"] -= 1
            draw_current_step(skip_box_rebuild=skip_box_rebuild)

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
