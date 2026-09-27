"""Generate a simple ArUco marker PNG for OpenCV.

Usage:
    python scripts/generate_aruco.py [marker_id] [size_px]

Defaults: marker_id=0, size_px=400, dictionary=DICT_4X4_50.
Output: public/markers/aruco_4x4_<id>.png
"""
import sys
import cv2

marker_id = int(sys.argv[1]) if len(sys.argv) > 1 else 0
size_px = int(sys.argv[2]) if len(sys.argv) > 2 else 400

dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
marker = cv2.aruco.generateImageMarker(dictionary, marker_id, size_px)

# Add a white quiet zone so the marker's black border stays detectable when printed.
border = size_px // 8
marker = cv2.copyMakeBorder(marker, border, border, border, border,
                            cv2.BORDER_CONSTANT, value=255)

out = f"public/markers/aruco_4x4_{marker_id}.png"
cv2.imwrite(out, marker)
print(f"wrote {out} ({marker.shape[1]}x{marker.shape[0]} px)")
