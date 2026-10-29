# Bounded visual clearance probe

terrain-support.js is an exact SHA-pinned copy of the existing rounded experiment. It remains excluded from the12-file runtime and is not imported by the playable scene. It lifts only fully supported feet, at most0.08m, against the caller-selected support plane. It does not select floors, move root/facing, alter collision, tilt soles or plant feet horizontally.

Parent test/grounded-clearance-native.cjs measures actual live normal-RAF poses along the native three-ramp route, temporarily applies the helper synchronously, checks root/collision unchanged and exact foot restore, then continues normal play. Captures show the restored baseline, not correction visuals. Modules load before sampling so live frames cannot advance during a measurement pair.

Completed run:98rampframes/196footframes,80 gaps>1cm before and0 after, maximum2.061cm lift; corrected minimum-1.78e-15m. Every finite pair satisfies measured gap translation identity. No unsupported or capped samples occurred in this run, so it does not prove edge handling. It is not composite-surface/allphase/IK/human-visible-smoothness/phone/FPS acceptance. Earlier63-frame native audit is a different run, not a matched before/after comparison.

Additional controlled evidence: native worst gap phase reproduced exactly within1e-9; magnified samecamera stills show baseline ramp cutting sole outlines and bounded leg lift exposing them. Deliberately clipped footprint+raisedplane fixtures prove missing=>zero shift and cap=>8cm with residual penetration, exact restore/root/collision invariants. These fixtures are not a real native edge or continuous-motion test. review/clearance-study.html offers the comparison.

Continuous session-only rendering: native route/main response override applies helper each realupdate, no disk/runtime change.102rampframes/204footframes,fullysupportedclear,4missingfootprints skipped and2partial-plane>1cm residuals, max2.0505cm; body/root-floor invariants/crownarrival pass. Nativeedge skip is observed, not complete compositecontact or visible continuity proof.
