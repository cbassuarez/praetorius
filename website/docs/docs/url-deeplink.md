# URL Deep-Link Spec

?page=<1-based page>&time=<m:ss or seconds>


- Unknown or out-of-range values are clamped.
- Both parameters are optional.
- Encodings in anchors (`#`) are supported if your host strips query.