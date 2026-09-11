# Marketing Performance Report

The implementation uses CSS transforms and opacity, three or fewer forms per preset, and no canvas, WebGL, video, or new animation dependency. Pointer response is fine-pointer-only and requestAnimationFrame-throttled.

Performance tiers are based on reduced-motion preference, viewport width, device memory when exposed, and hardware concurrency. They do not create a fingerprint or persist device data. Reduced devices remove the third form and lower blur cost; static devices stop animation.

The atmosphere is absolutely positioned with containment and cannot cause layout shift or horizontal overflow.
