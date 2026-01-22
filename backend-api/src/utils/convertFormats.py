#!/usr/bin/env python3
"""
USDZ Format Converter
Converts USDZ models to OBJ and STL formats using USD Python API
"""

import sys
import os
from pathlib import Path

def convert_usdz_to_formats(usdz_path, output_dir):
    """
    Convert USDZ file to OBJ and STL formats
    
    Args:
        usdz_path: Path to input USDZ file
        output_dir: Directory to save output files
    """
    try:
        # Import USD libraries (comes with Xcode on macOS)
        from pxr import Usd, UsdGeom, Gf
        
        usdz_path = Path(usdz_path)
        output_dir = Path(output_dir)
        
        if not usdz_path.exists():
            print(f"❌ Error: USDZ file not found: {usdz_path}")
            return False
        
        print(f"📦 Converting: {usdz_path.name}")
        
        # Open USD stage
        stage = Usd.Stage.Open(str(usdz_path))
        if not stage:
            print(f"❌ Failed to open USD stage from: {usdz_path}")
            return False
        
        # Collect all mesh data
        vertices = []
        faces = []
        vertex_offset = 0
        
        # Iterate through all mesh primitives in the stage
        for prim in stage.TraverseAll():
            if prim.IsA(UsdGeom.Mesh):
                mesh = UsdGeom.Mesh(prim)
                
                # Get vertices
                points_attr = mesh.GetPointsAttr()
                if points_attr:
                    points = points_attr.Get()
                    if points:
                        vertices.extend([(p[0], p[1], p[2]) for p in points])
                
                # Get face indices
                face_vertex_counts_attr = mesh.GetFaceVertexCountsAttr()
                face_vertex_indices_attr = mesh.GetFaceVertexIndicesAttr()
                
                if face_vertex_counts_attr and face_vertex_indices_attr:
                    counts = face_vertex_counts_attr.Get()
                    indices = face_vertex_indices_attr.Get()
                    
                    if counts and indices:
                        idx = 0
                        for count in counts:
                            face = [indices[idx + i] + vertex_offset for i in range(count)]
                            faces.append(face)
                            idx += count
                        
                        vertex_offset = len(vertices)
        
        if not vertices or not faces:
            print(f"⚠️  No mesh data found in USDZ file")
            return False
        
        print(f"✅ Extracted {len(vertices)} vertices, {len(faces)} faces")
        
        # Write OBJ file
        obj_path = output_dir / "model.obj"
        with open(obj_path, 'w') as f:
            f.write(f"# Converted from {usdz_path.name}\n")
            f.write(f"# Vertices: {len(vertices)}\n")
            f.write(f"# Faces: {len(faces)}\n\n")
            
            # Write vertices
            for v in vertices:
                f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
            
            # Write faces (OBJ uses 1-based indexing)
            for face in faces:
                f.write(f"f {' '.join(str(i + 1) for i in face)}\n")
        
        obj_size = obj_path.stat().st_size / (1024 * 1024)
        print(f"✅ OBJ: {obj_path.name} ({obj_size:.2f} MB)")
        
        # Write STL file (binary format for efficiency)
        stl_path = output_dir / "model.stl"
        write_binary_stl(stl_path, vertices, faces)
        
        stl_size = stl_path.stat().st_size / (1024 * 1024)
        print(f"✅ STL: {stl_path.name} ({stl_size:.2f} MB)")
        
        return True
        
    except ImportError as e:
        print(f"❌ USD Python library not available: {e}")
        print(f"💡 Install with: pip3 install usd-core")
        return False
    except Exception as e:
        print(f"❌ Conversion error: {e}")
        import traceback
        traceback.print_exc()
        return False

def write_binary_stl(stl_path, vertices, faces):
    """Write binary STL file"""
    import struct
    
    with open(stl_path, 'wb') as f:
        # Header (80 bytes)
        f.write(b'Binary STL generated from USDZ' + b'\0' * 50)
        
        # Number of triangles
        num_triangles = sum(len(face) - 2 for face in faces)  # Triangulate polygons
        f.write(struct.pack('<I', num_triangles))
        
        # Write triangles
        for face in faces:
            # Triangulate face if needed
            if len(face) == 3:
                triangles = [face]
            else:
                # Fan triangulation
                triangles = [[face[0], face[i], face[i+1]] for i in range(1, len(face)-1)]
            
            for tri in triangles:
                v0 = vertices[tri[0]]
                v1 = vertices[tri[1]]
                v2 = vertices[tri[2]]
                
                # Calculate normal (cross product)
                edge1 = [v1[i] - v0[i] for i in range(3)]
                edge2 = [v2[i] - v0[i] for i in range(3)]
                normal = [
                    edge1[1] * edge2[2] - edge1[2] * edge2[1],
                    edge1[2] * edge2[0] - edge1[0] * edge2[2],
                    edge1[0] * edge2[1] - edge1[1] * edge2[0]
                ]
                
                # Normalize
                length = (normal[0]**2 + normal[1]**2 + normal[2]**2) ** 0.5
                if length > 0:
                    normal = [n / length for n in normal]
                
                # Write normal
                f.write(struct.pack('<3f', *normal))
                
                # Write vertices
                f.write(struct.pack('<3f', *v0))
                f.write(struct.pack('<3f', *v1))
                f.write(struct.pack('<3f', *v2))
                
                # Attribute byte count
                f.write(struct.pack('<H', 0))

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: convertFormats.py <usdz_file> <output_dir>")
        sys.exit(1)
    
    usdz_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    success = convert_usdz_to_formats(usdz_path, output_dir)
    sys.exit(0 if success else 1)
