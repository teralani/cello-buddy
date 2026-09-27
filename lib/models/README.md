# Browser model artifacts

The two `*.generated.ts` files are checked-in contracts with an untrained
fallback. Run the offline Python trainers from `model-training/` to replace
their bodies with `m2cgen` output. The website never collects training data.

Generated models must preserve these feature orders:

- Posture: `elbow_angle`, `bow_elevation`, `wrist_angle`, `thumb_angle`, `index_curl`, `pinky_curl`
- Articulation: `duration_ms`, `mean_speed`, `speed_variance`