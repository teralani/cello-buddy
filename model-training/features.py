"""Feature parity helpers for the offline posture and articulation models."""
import math


ARTICULATION_FEATURE_COLUMNS = [
    "duration_ms",
    "mean_speed",
    "median_speed",
    "max_speed",
    "speed_variance",
    "speed_p90",
    "mean_acceleration",
    "max_acceleration",
    "acceleration_variance",
    "peak_speed_position",
    "movement_distance",
    "direction",
]


def _angle(first, vertex, last):
    first_vector = [first[i] - vertex[i] for i in range(3)]
    last_vector = [last[i] - vertex[i] for i in range(3)]
    denominator = math.sqrt(sum(value * value for value in first_vector)) * math.sqrt(
        sum(value * value for value in last_vector)
    )
    if denominator == 0:
        return 0.0
    cosine = max(-1.0, min(1.0, sum(first_vector[i] * last_vector[i] for i in range(3)) / denominator))
    return math.degrees(math.acos(cosine))


def posture_features(pose_landmarks, hand_landmarks):
    shoulder, elbow, wrist = pose_landmarks[12], pose_landmarks[14], pose_landmarks[16]
    middle_mcp = hand_landmarks[9]
    thumb_cmc, thumb_tip = hand_landmarks[1], hand_landmarks[4]
    index_mcp, index_pip, index_tip = hand_landmarks[5], hand_landmarks[6], hand_landmarks[8]
    pinky_mcp, pinky_pip, pinky_tip = hand_landmarks[17], hand_landmarks[18], hand_landmarks[20]
    return [
        _angle(shoulder, elbow, wrist),
        math.degrees(math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0])),
        _angle(elbow, wrist, middle_mcp),
        _angle(wrist, thumb_cmc, thumb_tip),
        _angle(index_mcp, index_pip, index_tip),
        _angle(pinky_mcp, pinky_pip, pinky_tip),
    ]


def articulation_features(duration_ms, speeds, accelerations, direction):
    """Return motion-only features in the order used by the browser model."""
    speeds = [abs(value) for value in speeds] or [0.0]
    accelerations = [abs(value) for value in accelerations] or [0.0]
    ordered_speeds = sorted(speeds)
    mean_speed = sum(speeds) / len(speeds)
    mean_acceleration = sum(accelerations) / len(accelerations)
    speed_variance = sum((value - mean_speed) ** 2 for value in speeds) / len(speeds)
    acceleration_variance = sum((value - mean_acceleration) ** 2 for value in accelerations) / len(accelerations)
    peak_speed = max(speeds)
    peak_position = speeds.index(peak_speed) / max(1, len(speeds) - 1)
    return {
        "duration_ms": duration_ms,
        "mean_speed": mean_speed,
        "median_speed": ordered_speeds[len(ordered_speeds) // 2],
        "max_speed": peak_speed,
        "speed_variance": speed_variance,
        "speed_p90": ordered_speeds[min(len(ordered_speeds) - 1, math.floor(len(ordered_speeds) * 0.9))],
        "mean_acceleration": mean_acceleration,
        "max_acceleration": max(accelerations),
        "acceleration_variance": acceleration_variance,
        "peak_speed_position": peak_position,
        "movement_distance": sum(speeds),
        "direction": direction,
    }