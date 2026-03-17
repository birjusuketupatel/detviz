import numpy as np
import pyvista as pv

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
    edges = [
        (0, 1), (0, 2), (0, 3),
        (1, 4), (1, 5),
        (2, 4), (2, 6),
        (3, 5), (3, 6),
        (4, 7), (5, 7), (6, 7)
    ]

    for i, j in edges:
        pts = np.array([V[i], V[j]])
        plotter.add_lines(pts, color="gray", width=0.5)

def add_vector(plotter, start, direction, color="red"):
    thickness = 0.06
    tip_scale = 2.5
    tip_length = 0.35
    
    start = np.asarray(start, dtype=float)
    direction = np.asarray(direction, dtype=float)

    length = np.linalg.norm(direction)
    if np.isclose(length, 0):
        return

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

    plotter.add_mesh(shaft, color=color)
    plotter.add_mesh(tip, color=color)


def draw_axis(plotter, direction, length):
    direction = np.asarray(direction, dtype=float)
    direction = direction / np.linalg.norm(direction)
    pts = np.array([
        -direction * length,
        direction * length
    ])
    plotter.add_lines(pts, color="gray", width=1.5)

def plot_parallelepiped(A):
    # plot parallelipiped
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
    plotter = pv.Plotter()
    plotter.enable_anti_aliasing("msaa", multi_samples=16)

    plotter.add_mesh(mesh, color="lightblue", opacity=0.4, show_edges=True, lighting=False)
    
    add_parallelepiped_edges(plotter, V)
    
    # plot column vectors of A that span parallelipiped
    span_colors = ["red", "green", "blue"]
    span_labels = ["a1", "a2", "a3"]

    max_extent = max(1.0, np.max(np.abs(V)))
    axis_len = 1.25 * max_extent
    
    for i in range(3):
        add_vector(
            plotter,
            start=(0, 0, 0),
            direction=A[:, i],
            color=span_colors[i]
        )
        plotter.add_point_labels(
            [A[:, i]],
            [span_labels[i]],
            font_size=18,
            point_size=0,
            text_color=span_colors[i],
            shape_opacity=0,
            show_points=False
        )

    # plot axes
    draw_axis(plotter, [1, 0, 0], axis_len)
    draw_axis(plotter, [0, 1, 0], axis_len)
    draw_axis(plotter, [0, 0, 1], axis_len)

    plotter.add_point_labels(
        [
            [axis_len, 0, 0],
            [0, axis_len, 0],
            [0, 0, axis_len]
        ],
        ["x", "y", "z"],
        font_size=18,
        point_size=0,
        text_color="black",
        shape_opacity=0,
        show_points=False
    )

    # plot bounding cube
    cube = pv.Cube(
        center=(0, 0, 0),
        x_length=2.25 * axis_len,
        y_length=2.25 * axis_len,
        z_length=2.25 * axis_len
    )
    plotter.add_mesh(cube, style="wireframe", color="lightgray", opacity=1.0)

    # plot origin
    plotter.add_mesh(
        pv.Sphere(radius=0.1, center=(0, 0, 0)),
        color="black"
    )

    plotter.add_axes()
    plotter.camera_position = "iso"
    plotter.show()
    

if __name__ == "__main__":
    A = np.array([
        [1.0, 7.0, -2.0],
        [1.0, 7.0, -4.0],
        [1.0, -8.0, 3.0]
    ])

    plot_parallelepiped(A)