# SPDX-License-Identifier: GPL-3.0-or-later
# fSpy Studio — Official Importer Add-on for Blender 5.2+ (also compatible with Blender 4.x+)
#
# INSTALLATION IN BLENDER 5.2+:
#   1. Open Blender -> Edit -> Preferences -> Add-ons (or Extensions)
#   2. Click the top-right dropdown arrow (v) -> "Install from Disk..."
#   3. Select this file (`fspy_studio_blender_addon.py`) and enable "Import-Export: Import fSpy Project (.fspy)"
#   4. Use via: File -> Import -> fSpy Project (.fspy)  (or drag-and-drop any .fspy file into the 3D Viewport!)

bl_info = {
    "name": "Import fSpy Project (.fspy) — fSpy Studio Edition",
    "author": "Per Gantelius & fSpy Studio Contributors",
    "version": (2, 0, 0),
    "blender": (5, 2, 0),
    "location": "File > Import > fSpy Project (.fspy)",
    "description": (
        "Imports calibrated camera parameters, embedded background reference plates, "
        "and optional fSpy Studio 3D blockout geometry & sun lights from .fspy files."
    ),
    "warning": "",
    "doc_url": "https://fspy.io",
    "category": "Import-Export",
}

import json
import math
import os
import struct
import tempfile
import bpy
import mathutils
from bpy_extras.io_utils import ImportHelper
from bpy.props import (
    BoolProperty,
    EnumProperty,
    FloatProperty,
    StringProperty,
)
from bpy.types import Operator


class FSPY_FormatError(Exception):
    """Raised when a file is not a valid .fspy binary project."""
    pass


def parse_fspy_binary_file(filepath: str):
    """
    Parses a binary .fspy project file (v1).
    Binary layout:
      - Bytes 0..3   : ASCII magic 'fspy'
      - Bytes 4..7   : uint32 little-endian file version (1)
      - Bytes 8..11  : uint32 little-endian UTF-8 JSON state byte length
      - Bytes 12..15 : uint32 little-endian raw image buffer byte length
      - Bytes 16..   : UTF-8 JSON state followed by raw image bytes (PNG/JPEG/WebP)
    """
    if not os.path.isfile(filepath):
        raise FSPY_FormatError(f"File not found: {filepath}")

    with open(filepath, "rb") as f:
        header = f.read(16)
        if len(header) < 16:
            raise FSPY_FormatError("File is too small to be a valid .fspy project.")

        magic, version, state_size, image_size = struct.unpack("<4sIII", header)
        if magic != b"fspy":
            raise FSPY_FormatError("Invalid file header (expected 'fspy' signature).")

        if version != 1:
            raise FSPY_FormatError(f"Unsupported .fspy version: {version} (expected version 1).")

        state_bytes = f.read(state_size)
        if len(state_bytes) != state_size:
            raise FSPY_FormatError("Truncated .fspy JSON state payload.")

        image_bytes = f.read(image_size) if image_size > 0 else b""

    try:
        state_dict = json.loads(state_bytes.decode("utf-8"))
    except Exception as exc:
        raise FSPY_FormatError(f"Failed to parse .fspy JSON payload: {exc}") from exc

    cam_params = state_dict.get("cameraParameters")
    if not cam_params:
        raise FSPY_FormatError(
            "This .fspy project does not contain solved camera parameters. "
            "Open it in fSpy Studio, align the vanishing point lines, and save again."
        )

    return state_dict, cam_params, image_bytes


def detect_image_extension(image_bytes: bytes) -> str:
    """Detects image file extension from magic bytes."""
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:16]:
        return ".webp"
    return ".png"


def load_embedded_fspy_image(project_name: str, image_bytes: bytes, pack_in_blend: bool):
    """Unpacks embedded image bytes into a Blender bpy.types.Image datablock."""
    if not image_bytes:
        return None

    ext = detect_image_extension(image_bytes)
    tmp_file = tempfile.NamedTemporaryFile(
        prefix=f"fspy_{project_name}_", suffix=ext, delete=False
    )
    tmp_path = tmp_file.name
    try:
        tmp_file.write(image_bytes)
        tmp_file.close()

        bl_image = bpy.data.images.load(tmp_path, check_existing=False)
        bl_image.name = f"{project_name}_Reference"
        if pack_in_blend:
            bl_image.pack()
        return bl_image
    finally:
        if pack_in_blend and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def create_camera_projected_material(mat_name: str, bl_image):
    """
    Creates a camera-projected Window UV shader in Blender 5.2+
    so 3D blockout meshes automatically receive the reference photograph from the camera view.
    """
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new(type="ShaderNodeOutputMaterial")
    out_node.location = (420, 0)

    bsdf_node = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf_node.location = (120, 0)
    if "Roughness" in bsdf_node.inputs:
        bsdf_node.inputs["Roughness"].default_value = 0.85

    tex_node = nodes.new(type="ShaderNodeTexImage")
    tex_node.location = (-200, 0)
    tex_node.extension = "CLIP"
    if bl_image is not None:
        tex_node.image = bl_image

    coord_node = nodes.new(type="ShaderNodeTexCoord")
    coord_node.location = (-440, 0)

    # Use UV output (driven by UV_PROJECT modifier) or Window coordinates fallback
    links.new(coord_node.outputs["UV"], tex_node.inputs["Vector"])
    links.new(tex_node.outputs["Color"], bsdf_node.inputs["Base Color"])
    if "Emission Color" in bsdf_node.inputs:
        links.new(tex_node.outputs["Color"], bsdf_node.inputs["Emission Color"])
    if "Emission Strength" in bsdf_node.inputs:
        bsdf_node.inputs["Emission Strength"].default_value = 0.35

    links.new(bsdf_node.outputs["BSDF"], out_node.inputs["Surface"])
    return mat


def attach_camera_uv_project_modifier(mesh_obj, cam_obj, img_w: int, img_h: int, subdiv_levels: int = 3):
    """Adds Simple Subdivision + Camera UV_PROJECT modifiers for perspective-correct projection."""
    if subdiv_levels > 0:
        subsurf = mesh_obj.modifiers.new(name="fSpy_Subdivide", type="SUBSURF")
        subsurf.subdivision_type = "SIMPLE"
        subsurf.levels = subdiv_levels
        subsurf.render_levels = subdiv_levels

    uv_proj = mesh_obj.modifiers.new(name="fSpy_CameraProject", type="UV_PROJECT")
    uv_proj.projector_count = 1
    uv_proj.projectors[0].object = cam_obj
    uv_proj.aspect_x = float(max(1, img_w))
    uv_proj.aspect_y = float(max(1, img_h))


class IMPORT_OT_fspy_project(Operator, ImportHelper):
    """Import calibrated camera, reference background image, and optional 3D blockout from an fSpy (.fspy) file"""

    bl_idname = "import_scene.fspy_project"
    bl_label = "Import fSpy Project (.fspy)"
    bl_options = {"REGISTER", "UNDO", "PRESET"}

    filename_ext = ".fspy"
    filter_glob: StringProperty(
        default="*.fspy",
        options={"HIDDEN"},
        maxlen=255,
    )

    # --- 1. Camera & Scene Options ---
    update_existing_camera: BoolProperty(
        name="Update Existing fSpy Camera",
        description="If a camera with the same project name already exists, update it in place instead of creating a duplicate",
        default=True,
    )

    set_active_camera: BoolProperty(
        name="Set as Active Scene Camera",
        description="Set the imported fSpy camera as the active scene render camera",
        default=True,
    )

    update_render_resolution: BoolProperty(
        name="Match Render Resolution to Photo",
        description="Set Scene Render Resolution (X, Y) to match the exact pixel dimensions of the calibrated reference photo",
        default=True,
    )

    lock_camera_transform: BoolProperty(
        name="Lock Camera Transform",
        description="Lock Location, Rotation, and Scale on the imported camera so it cannot be accidentally moved",
        default=True,
    )

    switch_viewport_to_camera: BoolProperty(
        name="Switch 3D Viewport to Camera View",
        description="Automatically align the active 3D Viewport into Camera Perspective (Numpad 0) after import",
        default=True,
    )

    sensor_width_mm: FloatProperty(
        name="Default Sensor Width (mm)",
        description="Fallback camera sensor width in millimeters (36mm Full Frame default) if no custom sensor preset is stored",
        default=36.0,
        min=1.0,
        max=200.0,
    )

    # --- 2. Background Image Options ---
    import_background_image: BoolProperty(
        name="Import Background Reference Image",
        description="Unpack the embedded photograph from the .fspy file and attach it as a Camera Background Image",
        default=True,
    )

    pack_image_in_blend: BoolProperty(
        name="Pack Image Inside .blend File",
        description="Pack the unpacked photo directly into the .blend file so external temp files are never lost",
        default=True,
    )

    bg_opacity: FloatProperty(
        name="Background Image Opacity",
        description="Opacity of the camera background reference image in the 3D Viewport",
        default=0.75,
        min=0.0,
        max=1.0,
        subtype="FACTOR",
    )

    bg_depth: EnumProperty(
        name="Background Depth",
        description="Whether the reference image appears behind 3D objects or as a semi-transparent overlay in front",
        items=[
            ("BACK", "Back (Behind 3D Objects)", "Render reference photo behind 3D scene geometry"),
            ("FRONT", "Front (Overlay Over 3D)", "Render reference photo in front of 3D geometry for alignment"),
        ],
        default="BACK",
    )

    bg_frame_method: EnumProperty(
        name="Frame Fit Method",
        description="How the reference image fits inside the camera frame",
        items=[
            ("FIT", "Fit", "Fit image inside camera sensor frame"),
            ("STRETCH", "Stretch", "Stretch image to camera frame"),
            ("CROP", "Crop", "Crop image to fill camera frame"),
        ],
        default="FIT",
    )

    # --- 3. 3D Reconstruction & Compositing Helpers ---
    create_origin_axes: BoolProperty(
        name="Create 3D Origin Axis Empty",
        description="Create an Axis Empty object at the calibrated (0, 0, 0) world origin",
        default=False,
    )

    create_shadow_catcher_floor: BoolProperty(
        name="Create Shadow-Catcher Ground Plane",
        description="Create a ground plane at Z = 0 configured as a Cycles Shadow Catcher for instant VFX compositing",
        default=False,
    )

    shadow_catcher_size: FloatProperty(
        name="Ground Plane Size (m)",
        description="Size of the generated shadow-catcher ground plane in meters",
        default=8.0,
        min=0.5,
        max=100.0,
    )

    import_studio_blockout: BoolProperty(
        name="Import fSpy Studio 3D Blockout & Sun",
        description="If the .fspy file contains fSpy Studio 3D Blockout Volumes or a Matched Sun Light, reconstruct them with Camera UV Projection",
        default=True,
    )

    def draw(self, context):
        layout = self.layout
        layout.use_property_split = True
        layout.use_property_decorate = False

        # Panel 1: Camera & Scene Calibration
        box_cam = layout.box()
        box_cam.label(text="Camera & Render Calibration", icon="CAMERA_DATA")
        box_cam.prop(self, "update_existing_camera")
        box_cam.prop(self, "set_active_camera")
        box_cam.prop(self, "update_render_resolution")
        box_cam.prop(self, "lock_camera_transform")
        box_cam.prop(self, "switch_viewport_to_camera")
        box_cam.prop(self, "sensor_width_mm")

        # Panel 2: Background Reference Plate
        box_bg = layout.box()
        box_bg.label(text="Camera Background Image", icon="IMAGE_BACKGROUND")
        box_bg.prop(self, "import_background_image")
        if self.import_background_image:
            col_bg = box_bg.column()
            col_bg.prop(self, "pack_image_in_blend")
            col_bg.prop(self, "bg_opacity")
            col_bg.prop(self, "bg_depth")
            col_bg.prop(self, "bg_frame_method")

        # Panel 3: 3D Scene & Shadow Catcher Extras
        box_3d = layout.box()
        box_3d.label(text="3D Scene & Compositing Extras", icon="MESH_CUBE")
        box_3d.prop(self, "import_studio_blockout")
        box_3d.prop(self, "create_origin_axes")
        box_3d.prop(self, "create_shadow_catcher_floor")
        if self.create_shadow_catcher_floor:
            box_3d.prop(self, "shadow_catcher_size")

    def execute(self, context):
        try:
            state_dict, cam_params, image_bytes = parse_fspy_binary_file(self.filepath)
        except FSPY_FormatError as err:
            self.report({"ERROR"}, str(err))
            return {"CANCELLED"}
        except Exception as exc:
            self.report({"ERROR"}, f"Unexpected error reading .fspy file: {exc}")
            return {"CANCELLED"}

        project_name = os.path.splitext(os.path.basename(self.filepath))[0] or "fSpy_Camera"
        scene = context.scene

        img_width = int(cam_params.get("imageWidth", 1920) or 1920)
        img_height = int(cam_params.get("imageHeight", 1080) or 1080)
        hfov_rad = float(cam_params.get("horizontalFieldOfView", 0.8))
        pp = cam_params.get("principalPoint", {"x": 0.0, "y": 0.0})
        pp_x = float(pp.get("x", 0.0))
        pp_y = float(pp.get("y", 0.0))

        # Resolve sensor width/height from calibrationSettingsBase if available
        sensor_w = float(self.sensor_width_mm)
        sensor_h = sensor_w * (img_height / max(1.0, float(img_width)))
        cal_base = state_dict.get("calibrationSettingsBase", {})
        cam_data_cfg = cal_base.get("cameraData", {}) if isinstance(cal_base, dict) else {}
        if isinstance(cam_data_cfg, dict):
            preset_data = cam_data_cfg.get("presetData")
            if isinstance(preset_data, dict) and preset_data.get("sensorWidth"):
                sensor_w = float(preset_data["sensorWidth"])
                sensor_h = float(preset_data.get("sensorHeight", sensor_h))
            elif cam_data_cfg.get("customSensorWidth"):
                sensor_w = float(cam_data_cfg["customSensorWidth"])
                sensor_h = float(cam_data_cfg.get("customSensorHeight", sensor_h))

        # 1. Create or reuse Camera Object
        cam_obj = None
        if self.update_existing_camera:
            existing = bpy.data.objects.get(project_name)
            if existing and existing.type == "CAMERA":
                cam_obj = existing

        if cam_obj is None:
            cam_data = bpy.data.cameras.new(name=project_name)
            cam_obj = bpy.data.objects.new(name=project_name, object_data=cam_data)
            context.collection.objects.link(cam_obj)
        else:
            cam_data = cam_obj.data

        # 2. Apply solved intrinsic parameters (FOV, Sensor, Principal Point Shift)
        cam_data.type = "PERSP"
        cam_data.sensor_fit = "HORIZONTAL"
        cam_data.sensor_width = sensor_w
        cam_data.sensor_height = sensor_h
        cam_data.lens_unit = "FOV"
        cam_data.angle = hfov_rad

        # Blender shift_x / shift_y are normalized to the largest image dimension
        aspect = float(img_width) / max(1.0, float(img_height))
        if aspect >= 1.0:
            cam_data.shift_x = -0.5 * pp_x
            cam_data.shift_y = -0.5 * pp_y / aspect
        else:
            cam_data.shift_x = -0.5 * pp_x * aspect
            cam_data.shift_y = -0.5 * pp_y

        # 3. Apply solved 4x4 extrinsic camera transform matrix
        transform_rows = cam_params.get("cameraTransform", {}).get("matrix")
        if transform_rows and len(transform_rows) == 4:
            mat = mathutils.Matrix(
                (
                    tuple(float(v) for v in transform_rows[0]),
                    tuple(float(v) for v in transform_rows[1]),
                    tuple(float(v) for v in transform_rows[2]),
                    tuple(float(v) for v in transform_rows[3]),
                )
            )
            cam_obj.matrix_world = mat

        # Lock camera transform if requested
        cam_obj.lock_location = (
            self.lock_camera_transform,
            self.lock_camera_transform,
            self.lock_camera_transform,
        )
        cam_obj.lock_rotation = (
            self.lock_camera_transform,
            self.lock_camera_transform,
            self.lock_camera_transform,
        )
        cam_obj.lock_scale = (
            self.lock_camera_transform,
            self.lock_camera_transform,
            self.lock_camera_transform,
        )

        # 4. Update render resolution & active camera
        if self.update_render_resolution:
            scene.render.resolution_x = img_width
            scene.render.resolution_y = img_height
            scene.render.resolution_percentage = 100

        if self.set_active_camera:
            scene.camera = cam_obj

        # 5. Unpack & configure Background Image
        bl_image = None
        if self.import_background_image and image_bytes:
            bl_image = load_embedded_fspy_image(
                project_name, image_bytes, self.pack_image_in_blend
            )
            if bl_image is not None:
                cam_data.show_background_images = True
                cam_data.background_images.clear()
                bg_slot = cam_data.background_images.new()
                bg_slot.image = bl_image
                bg_slot.alpha = self.bg_opacity
                bg_slot.display_depth = self.bg_depth
                bg_slot.frame_method = self.bg_frame_method

        # 6. Optional 3D Origin Axis Empty
        if self.create_origin_axes:
            axis_name = f"{project_name}_Origin"
            origin_obj = bpy.data.objects.get(axis_name)
            if origin_obj is None:
                origin_obj = bpy.data.objects.new(axis_name, None)
                context.collection.objects.link(origin_obj)
            origin_obj.empty_display_type = "ARROWS"
            origin_obj.empty_display_size = 0.5
            origin_obj.location = (0.0, 0.0, 0.0)

        # 7. Optional Shadow-Catcher Ground Plane
        if self.create_shadow_catcher_floor:
            bpy.ops.mesh.primitive_plane_add(
                size=self.shadow_catcher_size, location=(0.0, 0.0, 0.0)
            )
            floor_obj = context.active_object
            if floor_obj:
                floor_obj.name = f"{project_name}_ShadowCatcher"
                floor_obj.is_shadow_catcher = True

        # 8. Optional fSpy Studio 3D Blockout Volumes & Matched Sun Light
        if self.import_studio_blockout:
            sun_cfg = state_dict.get("sunShadowConfig")
            if isinstance(sun_cfg, dict) and sun_cfg.get("enabled"):
                az_rad = math.radians(float(sun_cfg.get("azimuthDeg", 45.0)))
                el_rad = math.radians(float(sun_cfg.get("elevationDeg", 40.0)))
                sx = math.cos(el_rad) * math.cos(az_rad)
                sy = math.cos(el_rad) * math.sin(az_rad)
                sz = math.sin(el_rad)
                sun_data = bpy.data.lights.new(name=f"{project_name}_Sun", type="SUN")
                sun_data.energy = 3.0
                sun_obj = bpy.data.objects.new(name=f"{project_name}_Sun", object_data=sun_data)
                context.collection.objects.link(sun_obj)
                sun_vec = mathutils.Vector((sx, sy, sz))
                sun_obj.location = sun_vec * 8.0
                sun_obj.rotation_euler = sun_vec.to_track_quat("Z", "Y").to_euler()

            blockout_cfg = state_dict.get("sceneBlockout")
            if isinstance(blockout_cfg, dict) and blockout_cfg.get("enabled"):
                proj_mat = create_camera_projected_material(
                    f"{project_name}_ProjectedPhoto", bl_image
                )
                volumes = blockout_cfg.get("volumes", [])
                if isinstance(volumes, list):
                    for idx, vol in enumerate(volumes):
                        if not isinstance(vol, dict):
                            continue
                        wx = float(vol.get("widthX", 1.0))
                        dy = float(vol.get("depthY", 1.0))
                        hz = float(vol.get("heightZ", 1.0))
                        cx = float(vol.get("offsetX", 0.0))
                        cy = float(vol.get("offsetY", 0.0))
                        z0 = float(vol.get("offsetZ", 0.0))
                        yaw = math.radians(float(vol.get("rotationZ", 0.0)))
                        vname = str(vol.get("name", f"Volume_{idx + 1}"))

                        bpy.ops.mesh.primitive_cube_add(
                            size=1.0,
                            location=(cx, cy, z0 + 0.5 * hz),
                            rotation=(0.0, 0.0, yaw),
                        )
                        box_obj = context.active_object
                        if box_obj:
                            box_obj.name = f"{project_name}_{vname}"
                            box_obj.scale = (wx, dy, hz)
                            if box_obj.data.materials:
                                box_obj.data.materials[0] = proj_mat
                            else:
                                box_obj.data.materials.append(proj_mat)
                            attach_camera_uv_project_modifier(
                                box_obj, cam_obj, img_width, img_height, subdiv_levels=3
                            )

        # 9. Select the imported camera and optionally switch 3D Viewport to Camera View
        for obj in context.selected_objects:
            obj.select_set(False)
        cam_obj.select_set(True)
        context.view_layer.objects.active = cam_obj

        if self.switch_viewport_to_camera and context.screen:
            for area in context.screen.areas:
                if area.type == "VIEW_3D":
                    for space in area.spaces:
                        if space.type == "VIEW_3D" and space.region_3d:
                            space.region_3d.view_perspective = "CAMERA"
                            break

        hfov_deg = math.degrees(hfov_rad)
        self.report(
            {"INFO"},
            f"Imported fSpy camera '{cam_obj.name}' ({img_width}x{img_height}, HFOV {hfov_deg:.1f}°)",
        )
        return {"FINISHED"}


# Optional Blender 4.1+ / 5.2+ Drag-and-Drop FileHandler so users can drag .fspy files into the 3D Viewport
if hasattr(bpy.types, "FileHandler"):
    class IMPORT_FH_fspy_project(bpy.types.FileHandler):
        bl_idname = "IMPORT_FH_fspy_project"
        bl_label = "fSpy Project (.fspy)"
        bl_import_operator = "import_scene.fspy_project"
        bl_file_extensions = ".fspy"

        @classmethod
        def poll_drop(cls, context):
            return context.area is not None and context.area.type in {"VIEW_3D", "OUTLINER"}


def menu_func_import(self, context):
    self.layout.operator(
        IMPORT_OT_fspy_project.bl_idname,
        text="fSpy Project (.fspy)",
        icon="CAMERA_DATA",
    )


classes = [IMPORT_OT_fspy_project]
if hasattr(bpy.types, "FileHandler"):
    classes.append(IMPORT_FH_fspy_project)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_import.append(menu_func_import)


def unregister():
    bpy.types.TOPBAR_MT_file_import.remove(menu_func_import)
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
