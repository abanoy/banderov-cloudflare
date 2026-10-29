# Artist Drawing and Animation Assistant — Codex Master Specification

**Document version:** 1.0  
**Prepared:** October 20, 2026  
**Audience:** Codex or another coding agent working with the project owner  
**Purpose:** A durable, detailed brief for continuous, staged research and development  
**Implementation status:** This document specifies a project. It is not evidence that an engine, plugin, model, or hosted service has already been implemented or tested.  
**Working product name:** Artist Drawing and Animation Assistant. Treat this as a descriptive placeholder.  
**Owner-controlled domain mentioned in planning:** `banderov.com`. Domain ownership does not supply compute or authorize deployment.

## Table of contents

- [Read this first: the actual assignment](#read-this-first-the-actual-assignment)
- [How the owner can start a Codex project with this file](#how-the-owner-can-start-a-codex-project-with-this-file)
- [Requirement authority and interpretation](#requirement-authority-and-interpretation)
- [Product definition and acceptance philosophy](#product-definition-and-acceptance-philosophy)
- [Full capability inventory](#full-capability-inventory)
- [Non-negotiable product invariants](#non-negotiable-product-invariants)
- [Research process and evidence standards](#research-process-and-evidence-standards)
- [How Codex should work through this project](#how-codex-should-work-through-this-project)
- [Mandatory CREDITS and provenance requirements](#mandatory-credits-and-provenance-requirements)
- [CREDITS interface specification](#credits-interface-specification)
- [Machine-readable provenance architecture](#machine-readable-provenance-architecture)
- [APA preparation and evidence rules](#apa-preparation-and-evidence-rules)
- [Verification and release gates for attribution](#verification-and-release-gates-for-attribution)
- [Engine architecture and research specification](#engine-architecture-and-research-specification)
- [Research starting map: candidate approaches and decisive experiments](#research-starting-map-candidate-approaches-and-decisive-experiments)
- [Delivery architecture, development stages, and continuation protocol](#delivery-architecture-development-stages-and-continuation-protocol)
- [Staged execution roadmap](#staged-execution-roadmap)
  - [Phase 0 — Establish project state, research discipline, and attribution](#phase-0--establish-project-state-research-discipline-and-attribution)
  - [Phase 1 — Prove the document and timeline round trip](#phase-1--prove-the-document-and-timeline-round-trip)
  - [Phase 2 — Establish the complete proposal-and-correction loop](#phase-2--establish-the-complete-proposal-and-correction-loop)
  - [Phase 3 — Build still-drawing assistance on the same project model](#phase-3--build-still-drawing-assistance-on-the-same-project-model)
  - [Phase 4 — Integrate character references and persistent part identities](#phase-4--integrate-character-references-and-persistent-part-identities)
  - [Phase 5 — Advance correspondence, deformation, and visibility](#phase-5--advance-correspondence-deformation-and-visibility)
  - [Phase 6 — Develop sparse drawing selection, timing, and stylized motion](#phase-6--develop-sparse-drawing-selection-timing-and-stylized-motion)
  - [Phase 7 — Stabilize color and organization across the animation](#phase-7--stabilize-color-and-organization-across-the-animation)
  - [Phase 8 — Run targeted custom-model research when justified](#phase-8--run-targeted-custom-model-research-when-justified)
  - [Phase 9 — Develop the standalone host when selected](#phase-9--develop-the-standalone-host-when-selected)
  - [Phase 10 — Add optional remote processing](#phase-10--add-optional-remote-processing)
  - [Phase 11 — Package, validate, and release coherent capabilities](#phase-11--package-validate-and-release-coherent-capabilities)
  - [Phase 12 — Continue research and improvement without losing state](#phase-12--continue-research-and-improvement-without-losing-state)
- [Installation, resources, and freeware distribution](#installation-resources-and-freeware-distribution)
- [Continuous Codex execution and handoff](#continuous-codex-execution-and-handoff)
- [Artist interaction and operation contracts](#artist-interaction-and-operation-contracts)
- [Evaluation fixtures and measurable acceptance](#evaluation-fixtures-and-measurable-acceptance)
- [Working records and reusable templates](#working-records-and-reusable-templates)
- [Risks, open choices, and first executable assignment](#risks-open-choices-and-first-executable-assignment)
- [Continuing research and citation maintenance](#continuing-research-and-citation-maintenance)
- [Verified seed bibliography and research register](#verified-seed-bibliography-and-research-register)

## Read this first: the actual assignment

Develop an integrated assistant for 2D drawing and animation. The artist supplies rough drawings, keyframes, and optional reference material. The system researches and uses suitable mathematical, procedural, computer-graphics, image-processing, optimization, and machine-learning methods to produce its best organized, editable proposals. The artist reviews, erases, redraws, retimes, colors, accepts, and refines those proposals. Their corrections guide subsequent work.

The complete ambition includes gap handling, fill-region inference, line-art prediction, color assignment, reference-sheet interpretation, motion and in-between prediction, economical and expressive drawing schedules, smears and other stylization when requested, organized layers, and iteration after artist correction. A still drawing is a valid input as well as an animation shot.

**Preserve this whole ambition.** A staged implementation is a way to develop it, not permission to redefine the project permanently as a paint bucket, a frame interpolator, a generic image-generation interface, or a demonstration that never becomes an editable tool.

The project may use existing free components, independent implementations of published methods, new procedural methods, adapted pretrained models, or newly trained neural networks. Select them through research and evidence. A custom network is a legitimate option. It is neither a prerequisite nor something to rule out in advance.

**Every borrowed element used in research, implementation, comparison, or testing must have a verified source and an APA-formatted citation available through a visible button labeled exactly `CREDITS`.** This applies to temporary experiments, not only shipping code. Use legitimately free-to-access information. Respect the actual licenses for code, weights, data, assets, and dependencies. Attribution does not replace permission.

The system should return useful editable work even when its interpretation is imperfect. It must preserve the artist's originals and approved corrections. Missing information can lead to a plausible guess, alternatives, or a narrowly targeted request for another guide drawing. Neither a clear input nor a rich reference sheet guarantees a correct prediction; model and algorithm limitations also matter.

Your job as the development agent is to make sustained, concrete progress: research, implement, run, inspect, measure, revise, document, and continue. Do not substitute repeated feasibility essays for development once the owner invokes this document as the implementation brief.

## How the owner can start a Codex project with this file

Place this file in the intended project directory or attach it to a Codex session. The owner can use the following instruction:

```text
Read ARTIST_ANIMATION_ASSISTANT_CODEX_MASTER_SPEC.md completely, along with
the applicable AGENTS.md and LLM.md files if present. Treat the master
specification as the project brief, subject to my current instructions and
your environment's higher-priority rules.

Begin the first unfinished development stage. Research current free primary
sources, register APA citations for every borrowed element in the CREDITS
system, implement a concrete increment, and verify it. Preserve the full
artist-assistance goal, including original procedural methods and custom
neural components where evidence supports them.

Continue through useful work that is authorized. Maintain project state,
experiments, decisions, and exact next steps so another Codex session can
resume. Ask a focused question only when the answer materially blocks the
next necessary action. Do not purchase compute, publish a service, or modify
unrelated projects without authorization.
```

This document can guide many sessions. It does not by itself create a background agent, a scheduled task, unlimited compute, or a perpetual process. If the owner later wants scheduled execution, configure a separately authorized runner with explicit work, budget, and stopping conditions.

## Requirement authority and interpretation

Use the following meanings throughout the document:

- **MUST** identifies a binding user requirement, a data-preservation invariant, or an explicitly adopted acceptance condition.
- **SHOULD** identifies a strong implementation recommendation that may be changed with a documented technical reason.
- **MAY** identifies an optional method or later capability.
- **PROPOSED** identifies a design to test, not a demonstrated scientific result.
- **VERIFIED SOURCE FACT** means the cited source supports the statement; it does not mean the local implementation was tested.
- **LOCALLY VERIFIED** requires an actual recorded execution in the declared environment.

Follow higher-priority environment rules and the owner's current instructions. Read applicable repository instructions. Do not overwrite or silently reinterpret existing `AGENTS.md`, `LLM.md`, licenses, or project decisions to remove inconvenient requirements. If a genuine conflict affects work, explain the specific conflict, complete unaffected work, and obtain a decision only when necessary.

Technical choices in this document are recommendations unless explicitly recorded as user decisions. In particular, the user has not selected a final product name, exact model, GPU provider, operating-system support matrix, programming language, training budget, or production release date.

### What the owner has actually requested

| Topic | Confirmed intent |
| --- | --- |
| Artist role | The artist provides meaningful rough input and retains responsibility for expressive decisions and finishing. |
| Input | Still sketches or animation keys; optional character sheets with colors and multiple angles. |
| Output | Organized, editable drawings, layers, and proposed intermediate frames. |
| Iteration | The artist can correct or delete proposals and run another refinement pass. |
| Motion | Predict useful intermediate drawings and favor a small number of meaningful drawings when appropriate. |
| Interpretation | Use the available information to make a best effort; tolerate uncertainty and correction. |
| Methods | Research the state of the art and develop suitable procedural, mathematical, learned, or custom approaches. |
| Application | A Krita plugin or standalone program, with useful `.kra` import compatibility. |
| Cost and attribution | Free information and suitable free components; APA citations through a `CREDITS` button, including borrowed test elements. |
| Delivery process | A multi-stage project that can continue across Codex sessions. |
| Online option | Consider optional processing through a service associated with `banderov.com`; no deployment has been authorized by this document alone. |

### Recommended starting decisions, subject to evidence

1. Use a portable processing engine with a narrow, versioned interface.
2. Begin application integration through Krita if the target-version API probe supports the required editing workflow.
3. Keep expensive or fragile model dependencies in a separate worker process.
4. Preserve a local processing path; introduce remote processing when its practical benefit is measured.
5. Make raster paint layers a useful first editable output, while retaining a development track for vector strokes and meaningful part structure.
6. Build the `CREDITS` registry and minimal viewer before executing experiments that borrow external methods or artifacts; reading and recording research may precede the viewer.
7. Use multiple representative artist examples to evaluate generalization, with synthetic examples reserved for controlled checks.
8. Design for portability. Confirm the first actual target platform before platform-specific packaging; Windows is a reasonable candidate, not an established compatibility result.

Changing a recommendation requires an architecture decision record describing the evidence, alternatives, effect on requirements, and migration path. Do not use a recommendation to override a confirmed user requirement.

## Product definition and acceptance philosophy

The product is an assistant that transfers repetitive and inferential work from the artist into a controllable tool. It succeeds when the complete workflow becomes easier: preparing input, requesting assistance, waiting, reviewing, correcting, and saving the finished result.

Codex or another coding assistant is the development collaborator. Design the resulting application so its supported local operations do not require the artist to maintain a GPT or Claude account or call a chat model for every drawing. Development-agent access, application distribution, optional model downloads, and inference computation are separate concerns.

A visually attractive generated video is insufficient if the artist must reconstruct its layers, recolor everything, repair every contour, or repeat corrections after each regeneration. Conversely, a modest but reliable gap mask or a handful of useful intermediate drawings can have substantial value when integrated well. Evaluate both individual operations and the whole workflow.

### The primary success measure

Measure **time to an artist-accepted result**, including setup, model latency, review, correction, import, and recovery from failures. Pair this with artist ratings and objective invariants. Do not claim a time saving merely because neural inference is faster than drawing a frame by hand.

Compare comparable work. Use similar shot complexity, resolution, duration, style, and finishing expectations. If one person performs both conditions, consider order and practice effects. Keep small pilot results clearly labeled; do not present them as a general population study.

### Capability labels visible to the user

Every feature should have a truthful capability label appropriate to the build:

- **Available:** implemented and verified in the supported configuration.
- **Experimental:** usable, with documented limits and rollback.
- **Research prototype:** an isolated evaluation path, not a supported production feature.
- **Planned:** specified but not implemented; it must not appear as a working action.
- **Unavailable in this configuration:** explain the missing dependency or unsupported capability concisely.

Avoid fake controls, fabricated previews, invented progress percentages, and an interface that suggests semantic understanding when the current implementation is only a geometric operation. A crossfade may be a useful baseline if clearly labeled. It must not be described as character-aware in-between prediction.

## Full capability inventory

Maintain these identifiers in the backlog, requirements matrix, tests, and release notes. Stages can deliver partial coverage, but unresolved requirements remain visible.

| ID | Required capability | Evidence of useful completion |
| --- | --- | --- |
| REQ-01 | Read still sketches and sequences without silently changing their meaning. | Dimensions, transparency, coordinates, layers, and timing are identified and preserved or explicitly converted. |
| REQ-02 | Support `.kra` workflows. | The selected route imports representative files with documented fidelity. A plugin or installed-Krita bridge verifies native save/reopen behavior; an independent standalone importer verifies its advertised import fidelity and editable output. |
| REQ-03 | Use optional character and color references. | References influence documented operations; palette and identity behavior are tested against reference-free and reference-assisted cases. |
| REQ-04 | Handle broken boundaries and fills. | The artist can inspect and correct fill boundaries, including intentional open ink. |
| REQ-05 | Suggest refined line art. | Contour proposals are editable, reversible, and compared to the source; deliberate stylistic features can be retained. |
| REQ-06 | Assign and propagate colors. | Palette assignments and corrected regions remain consistent where evidence supports correspondence. |
| REQ-07 | Predict intermediate drawings. | At least one documented path produces useful motion proposals from artist keys and optional guides. |
| REQ-08 | Propose economical drawing schedules. | Distinct drawing count, playback slots, holds, and key events are separate and editable. |
| REQ-09 | Support stylized motion. | Easing, trajectories, and geometric smears have separate controls and truthful capability labels. |
| REQ-10 | Organize editable output. | Line, color, masks, frames, and inferred parts have clear identities and reasonable grouping. |
| REQ-11 | Preserve artist approvals. | Locked pixels, strokes, layers, or drawings are not overwritten by later jobs. |
| REQ-12 | Regenerate locally and iteratively. | A correction invalidates only the required dependencies; revisions and rejected proposals remain traceable. |
| REQ-13 | Provide APA credits for borrowed work. | The exact `CREDITS` button displays complete, verified references and required license notices, including research and test usage. |
| REQ-14 | Operate with suitable free components. | Source access, component permissions, and redistribution status are recorded; no mandatory paid API is hidden in the core workflow. |
| REQ-15 | Allow custom research and learned components. | Candidate algorithms, experiments, training decisions, and negative results are recorded; no arbitrary ban on original model development. |
| REQ-16 | Minimize artist setup and friction. | Installation, model preparation, progress, cancellation, correction, and recovery are tested as a user journey. |
| REQ-17 | Support optional remote processing. | The same job contract can target an authorized remote worker without changing ownership of the artist's document. |
| REQ-18 | Continue development across sessions. | A new agent can reconstruct status and run the next verified command from project records. |
| REQ-19 | Export usable results. | Editable source output and playback exports are distinct; export fidelity and timing are verified. |
| REQ-20 | Demonstrate practical usefulness. | Representative stills and shots have measured outcomes, known failures, and artist review records. |

## Non-negotiable product invariants

### Artist work is authoritative

An original drawing is never merely a disposable prompt. Preserve its bytes or a documented faithful source representation. Keep an immutable source snapshot for a job. Generated alternatives go into separate proposals or revisions. Replacing an accepted result is an explicit edit that participates in undo and history.

An artist correction outranks an older inferred result. Store that priority in project data and enforce it in code. A text prompt asking a model to preserve something is not sufficient to guarantee preservation. A locked source region should be copied or otherwise protected by the output compositor, with boundary effects evaluated separately.

### Output must be editable in the claimed sense

Distinguish four capabilities:

1. **Editable raster:** the artist can erase and repaint pixels on independent layers.
2. **Editable vectors:** the artist can manipulate contour geometry or stroke control points.
3. **Semantic parts:** the system maintains meaningful identities and grouping, such as left sleeve or hair.
4. **Reconstructed hidden content:** the system proposes material that was not visible in the input.

Implementations may reach these at different stages. Never infer one capability merely from another. A segmented image is not automatically a usable rig. An SVG is not automatically an anatomically meaningful layer tree. A hidden surface is a prediction, even when plausible.

### Time is not the same as a list of unique images

Represent distinct drawings and their exposure durations separately. A drawing held for four playback slots should not require four independent semantic drawings in the internal project. An adapter may need to expand a hold into duplicate images; record that adapter limitation without corrupting the internal exposure model.

Deleting a drawing and deleting time are separate actions. The default behavior for a rejected proposal should preserve the intended shot duration unless the artist explicitly chooses to retime.

### Interpretation must remain correctable

Uncertainty is expected. Give a focused way to correct a boundary, part match, palette assignment, path, depth order, or pose. Prefer an understandable alternative or small added constraint over an endless sequence of opaque reruns. Repeating the same computation is not evidence that the model has learned.

### Preserve the full research goal without promising a breakthrough

Continue to investigate difficult capabilities rather than silently dropping them. At the same time, report experimental failures honestly. An implemented training loop is not proof of a useful trained model. A paper's benchmark is not a result achieved locally. A downloaded checkpoint is not proof of compatibility with the project's inputs, licenses, or hardware.

## Research process and evidence standards

The owner explicitly wants research into current methods. Conduct it as a reproducible development activity rather than an unbounded literature collection.

### Research questions to maintain

Keep an evolving list covering at least:

1. What methods retain the artist's chosen contours while resolving rough overdraw?
2. How can fill boundaries be inferred without changing deliberate visible gaps?
3. Which representations best preserve identity across deformation, occlusion, and topology changes?
4. How should character sheets be associated with regions, viewpoints, colors, and shape conventions?
5. What motion information can be inferred from keys, and what lightweight guidance resolves ambiguity?
6. How can a proposal generator support sparse exposures, holds, contact events, and stylized smears?
7. Which output structures actually make correction easier in Krita or a standalone editor?
8. Which learned components provide enough benefit to justify their installation, runtime, and training cost?
9. Which methods can be used and distributed under the project's cost and license requirements?
10. How do corrections propagate without overwriting approved work or accumulating drift?

### Source hierarchy

Prefer original papers, author-hosted manuscripts, official project pages, official repositories, model cards, dataset documentation, upstream issue discussions, and official API documentation. Secondary material may help discover a method, but important technical claims should be traced to a primary source when available.

Read the method and limitations, not just the abstract or demo. For a model, distinguish the paper, reference implementation, actual released checkpoint, community optimization, and hosted demo. Each may support different features or have different terms.

Use freely accessible legitimate versions. If a paper's publisher page is paywalled, look for an author manuscript or preprint. Do not bypass access controls, misrepresent an abstract as the full method, or purchase access without authorization. If the method cannot be examined adequately, record the limitation and continue with other candidates.

### A research finding should become a decision or experiment

For every serious candidate, record:

- Problem and intended role.
- Input assumptions and preprocessing.
- Output representation and editing implications.
- Source and APA reference identifier.
- Code, weights, dataset, and dependency license status.
- Hardware and runtime claims, labeled as author-reported or locally measured.
- Available code and checkpoints, with exact versions when tested.
- What the method cannot do or has not been shown to do.
- A representative test that could falsify the proposed benefit.
- Decision: test, retain, adapt, defer, reject, or unresolved.

Do not use paper citation count, repository stars, or a promotional demo as the sole selection criterion. A newer method is not automatically more suitable for the artist's workflow.

### Evidence categories

| Label | Meaning |
| --- | --- |
| `source_verified` | A primary source supports the recorded claim. |
| `implementation_inspected` | Relevant code paths were read and mapped to the proposed integration. |
| `download_verified` | The specific artifact and its provenance were resolved; this does not imply it was executed. |
| `executed` | The method ran in a recorded local or authorized remote environment. |
| `measured` | Results were evaluated with stated inputs, metrics, and limitations. |
| `artist_reviewed` | An artist assessed the relevant results using the stated task. |
| `adopted` | The component has a declared production or experimental role. |
| `rejected` | A reason is recorded; its credits and experimental history remain available. |

These labels can coexist. They must not be promoted automatically because a build succeeded.

## How Codex should work through this project

### First session

Read the master brief completely and inspect the actual repository before changing it. Locate applicable instructions, examine version-control status, and identify existing code, tests, dependencies, and user modifications. Do not assume the project lives inside a previously mentioned Cloudflare repository. Prefer a dedicated project directory unless the owner supplies an existing one.

Establish what is available: Python and relevant toolchains, installed Krita version if any, operating system, CPU, memory, GPU model and memory if discoverable, package managers, and whether model execution is possible. Avoid expensive downloads or long training runs during simple environment discovery. Never print credentials while inspecting configuration.

Create the project records, source registry, early credits viewer, and an explicit current milestone. Do the useful work that is possible in the current environment. If Krita is absent, implement and verify the portable engine and prepare a clear target-machine probe; do not claim native integration has passed.

### Every development session

1. Read the current project status, active task, relevant decision records, and recent experiment results.
2. Reconcile them with the repository and current user instructions.
3. Select a concrete increment that advances an unfinished requirement or resolves a blocking uncertainty.
4. Register borrowed sources before incorporating them into an experiment or implementation.
5. Implement the increment with explicit input and output contracts.
6. Run meaningful verification proportionate to the risk.
7. Inspect representative outputs when visual quality is relevant.
8. Update evidence, known failures, credits, and next steps.
9. Continue to the next authorized useful increment while time and resources allow.

At a context boundary or session end, write a concise continuation record containing exact paths, commands, result locations, outstanding decisions, and the next action. Do not rely on a future agent remembering the chat.

### Parallel work

Use separate agents or workstreams when this saves time: literature and license review, representation design, Krita integration, engine methods, evaluation, or packaging. Give each a bounded question, ownership of specific files, and an expected result. Integrate their work through review. Do not let simultaneous agents overwrite the same files or report incompatible schema changes as completed.

All contributions obey the same attribution requirement. A subagent's assertion that a source was checked is not a substitute for retaining the source record and evidence. Research outputs should contain findings and supporting references, not hidden reasoning transcripts.

### Questions and permissions

Make reasonable reversible implementation decisions and record them. Do not repeatedly ask whether to proceed with work the owner already authorized. Ask only when a missing choice materially blocks a necessary next action, when meaningful alternatives have substantially different consequences, or when actual authorization is required.

Do not infer authorization to incur charges, publish a service, change DNS, send the artist's files to third parties, delete source work, rewrite unrelated repositories, or use someone else's training data. Prepare the relevant concrete plan or artifact before requesting such a decision. A failure in one optional dependency should not stop unrelated useful work.

The user's free-information requirement does not authorize bypassing a license or access control. Resolve an incompatible component through another component, an independent permitted implementation, or a clearly documented deferred experiment.

### Keep reports practical

Lead progress reports with what now works, what was learned, and what the next step resolves. State the environment used and any material untested boundary. Distinguish original implementation decisions from evidence about published methods. Avoid repeated assurances, speculative percentages, and claiming completion because an interface renders.


## Mandatory CREDITS and provenance requirements

The user has made attribution a product requirement. If development borrows an external method, implementation, pretrained model, checkpoint, dataset, library, tutorial, asset, or other substantive resource, record that use and provide an APA-style citation through a visible button labelled exactly **CREDITS**. This applies to experiments as well as released features. Do not postpone attribution until release, hide it in a repository README, or remove historical attribution when an experiment is retired.

Implement the credits registry and a minimal offline experiment-viewer shell in the first development stage. Its visible **CREDITS** button must work before any experiment borrows or executes an external method, implementation, model, dataset, or other component. This small shell can precede a complete Krita plugin or standalone editor. Reading research and registering candidate sources may precede the shell; running borrowed experiments may not. Headless runs must additionally emit generated credits and support `--credits`; they do not create an exception to the visible-button requirement. Add the same working entry point to each selected host when that host is implemented.

These requirements are part of the definition of done for each stage. The user has already authorized ordinary research and development using appropriate free resources. Do not interrupt them to approve every routine compatible dependency. Resolve ordinary implementation choices, preserve notices, document evidence, and continue. A source with unresolved permissions remains a research reference until the proposed use has been established as permitted.

### What “free information” means in this project

Use freely accessible primary materials: official documentation, lawful author manuscripts, open proceedings, publicly available papers, project pages, repositories, and model or dataset cards. If the publisher's copy is paywalled, look for a lawful freely accessible author or repository copy. Record which version was actually read. An abstract alone cannot establish that the full method was inspected or reproduced.

Treat the following as separate questions:

| Question | Required record | Consequence |
|---|---|---|
| Can the information be read without payment? | Public reading URL and access date | Establishes accessible research evidence. |
| Can the artifact be downloaded without payment? | Exact repository, release, or checkpoint URL | Establishes acquisition cost; says nothing by itself about use rights. |
| May it be executed for this experiment? | Applicable license or documented permission and proposed use | Determines whether evaluation can proceed. |
| May it be modified, redistributed, bundled, or served remotely? | License terms for those specific actions | Determines packaging and deployment options. |
| May professional artists use the resulting feature? | Commercial-use and other scope restrictions | Prevents silently imposing research-only conditions on the released tool. |
| Does using it require paid computation? | Local requirements or remote cost estimate | Keeps resource costs separate from download price. |

Neither a public repository nor an APA citation constitutes permission to reuse its contents. “Freeware,” “open source,” “open weights,” “free to read,” and “free trial” describe different properties. Do not use them interchangeably. A paper's publication license does not automatically license its implementation, training data, checkpoints, figures, or bundled sample images.

The default development path must not require a purchase, a paid API, a subscription, or a credit card. Do not subscribe to a service or incur charges without explicit authorization. Free local tools and legitimately available no-charge resources are preferred. Optional paid infrastructure can be documented as an alternative, but cannot become an unnoticed requirement for the core application. Free weights do not provide free GPU time.

When restrictions make a component unsuitable, preserve its research citation, explain the limitation in the development record, and evaluate a compatible alternative. Do not silently ignore a license, assume “research” covers any intended activity, or rewrite a permission requirement as a mere attribution requirement. Conversely, do not turn a resolved compatible license into an unnecessary recurring approval request.

### Scope of attribution

Create a source record for a substantive borrowed algorithm even when the implementation is written from scratch. Create a component record as well when third-party code, weights, data, or assets are actually used. Cite the paper and the implementation separately when both contribute. If an implementation depends on a foundation model, adapter, auxiliary segmentation model, or depth model, capture those artifacts separately: a permissive wrapper does not settle the permissions for its dependencies.

The registry covers research influences, runtime dependencies, development and evaluation tools, fonts and icons, copied or adapted snippets, pretrained artifacts, datasets, sample assets, and tutorials that materially inform implementation. Record generated or synthetic evaluation data with its generating program, parameters, and source provenance. Do not publish the artist's private drawings or character sheets merely because they appear in an experiment manifest.

A normal arithmetic operation, a language keyword, or an independently written trivial utility does not need a contrived paper citation. The obligation is to identify actual substantive borrowing. Do not add an unrelated famous paper to make an implementation appear researched. AI-generated suggestions must undergo the same provenance review; they are not a license exemption, a verifiable scientific source, or proof that a generated algorithm is original.

Preserve attribution for unsuccessful experiments and abandoned prototypes. Their status should explain that they are historical evaluations and are absent from the current runtime. Do not imply that a cited author endorses the application, that a reference proves a feature works, or that listing a paper means its code or weights are distributed.

## CREDITS interface specification

### Entry points and offline behavior

Place a visible **CREDITS** button in the experiment-viewer shell and in each selected, implemented host: the main Krita docker if the plugin is built, and the main application window if the standalone application is built. This requirement does not require building both hosts. A secondary Help/About entry may supplement the button. The primary button must remain available when no project is open, when the network is disconnected, and when an optional model is missing. Give it an accessible name, keyboard focus, and a meaningful screen-reader description.

The button opens a locally generated credits view. Bibliographic text, component roles, use statuses, and bundled license notices must be readable offline. External links open only on an explicit user action. Displaying credits must not download models, contact analytics services, authenticate to a provider, or upload artwork.

The view must support search by author, title, component, feature, and license, with filters for:

- **Current runtime:** components present in or required by this installed configuration.
- **Research and methods:** sources that informed implemented approaches, including independently written implementations.
- **Experiments:** evaluated, rejected, superseded, and retired approaches, with dates and outcomes.
- **Data and assets:** relevant datasets, public examples, fonts, icons, and other licensed assets.
- **License notices:** required notices and the licenses applicable to exact included artifacts.

Keep all categories discoverable; an initial runtime filter must not make the historical record effectively inaccessible. A paper may appear in more than one view without receiving duplicate bibliographic identities.

### Information shown for each entry

Show a complete APA reference, a working source link when available, a concise description of the actual contribution, the related feature, and the present use state. Example roles include “morphological closing baseline,” “reference-color matching experiment,” “Krita document integration,” and “evaluation-only comparison.” These are descriptions of observed use, not performance claims.

An expandable details section should expose version or revision, checkpoint identity, license, available free full-text link, verification date, and the modules or experiments that reference the entry. Keep ordinary artist-facing language in the main view. A long dependency tree and checksums belong in details or exports.

Support copying one APA reference, copying the displayed bibliography, and exporting the complete record as Markdown or plain text. Also offer the machine-readable manifest for inspection. Search, filtering, and export must not remove legally required notices or alter the underlying historical record.

Distinguish **candidate**, **consulted**, **evaluated**, **implemented**, **shipped**, and **retired** visibly. These states describe use, not quality. Add a separate permission-review state such as **not reviewed**, **permitted for the recorded experiment**, **permitted for distribution in this configuration**, or **excluded**. Avoid a single green “verified” badge that conflates an accurate citation, permission review, scientific validity, successful reproduction, and production readiness.

## Machine-readable provenance architecture

### Separate sources, artifacts, uses, and evidence

Maintain four connected record types. This avoids treating a paper, its repository, its checkpoint, and one local experiment as the same object.

| Record | Purpose | Minimum contents |
|---|---|---|
| Bibliographic source | Identifies the publication or documentation actually consulted | Stable ID; source type; authors or responsible organization; date or explicit absence of date; title; venue/publisher; canonical URL; free-access URL; DOI when verified; APA text; metadata verification date. |
| Third-party component | Identifies an exact code, weight, dataset, or asset artifact | Stable component ID; source IDs; artifact kind; version/revision; origin; checksum when acquired; dependency IDs; applicable license evidence; notices; allowed use scope; review state. |
| Use or experiment | Explains what the project actually did | Feature and experiment IDs; source/component IDs; scope; input provenance; date; configuration; seeds where relevant; hardware; observations; outcome; current use state. |
| Evidence and decisions | Explains why a claim or permission decision was accepted | Relevant source location; short original notes; uncertainty; decision; reviewer identity; date; superseding record when changed. |

Use stable identifiers such as `REF-TOONCRAFTER`, `COMP-TOONCRAFTER-CHECKPOINT-001`, and `EXP-LINE-COLOR-004`. Never reuse a component ID for different weights. A new artifact checksum or materially different license requires an explicit versioned record. A source ID can remain stable while verified bibliographic metadata is corrected, with the correction logged.

Use the following canonical development-repository layout. Development source, component, use, research-experiment, and permission-decision records belong under `provenance/`; generated credits and consolidated notices belong under `generated/`. Raw experimental results and outputs may remain under `experiments/`, with their provenance manifest referring to them.

```text
provenance/sources.json
provenance/components.json
provenance/feature_uses.json
provenance/experiments/<experiment_id>.json
provenance/decisions/
provenance/licenses/<component_id>/
experiments/<experiment_id>/results.md
experiments/<experiment_id>/outputs/
generated/credits.json
generated/CREDITS.md
generated/THIRD_PARTY_NOTICES.txt
```

Ordinary artist processing runs have a separate private data root associated with the artist's document or project. Within that root, store operation manifests at `provenance/runs/<run_id>.json`. These records identify input revisions, constraints, parameters, outputs, the installed credits-snapshot version, and source/component IDs. They are not automatically research experiments and must not be written into a public development repository. A permitted research experiment may refer to an appropriate run, but ordinary processing does not imply permission to publish artwork or use it for training.

These paths define the intended project contract, not a claim that the files or implementations already exist. Keep development and artist-project roots explicit. Use a documented schema version, validate references between files, and generate presentation files from the canonical records. Do not hand-maintain incompatible copies of credits in the application, website, installer, and repository.

### Illustrative source and component records

The following source record uses verified publication metadata. `consulted` means consulted for this handoff; it does not mean the software has been executed or adopted.

```json
{
  "schema_version": "1.0",
  "source_id": "REF-TOONCRAFTER",
  "type": "preprint",
  "authors": [
    {"family": "Xing", "given": "Jinbo"},
    {"family": "Liu", "given": "Hanyuan"},
    {"family": "Xia", "given": "Menghan"},
    {"family": "Zhang", "given": "Yong"},
    {"family": "Wang", "given": "Xintao"},
    {"family": "Shan", "given": "Ying"},
    {"family": "Wong", "given": "Tien-Tsin"}
  ],
  "year": 2024,
  "title": "ToonCrafter: Generative cartoon interpolation",
  "publisher_or_repository": "arXiv",
  "doi": "10.48550/arXiv.2405.17933",
  "canonical_url": "https://arxiv.org/abs/2405.17933",
  "free_access_url": "https://arxiv.org/abs/2405.17933",
  "metadata_checked_on": "2026-10-20",
  "use_state": "consulted",
  "implementation_adopted": false,
  "apa_reference": "Xing, J., Liu, H., Xia, M., Zhang, Y., Wang, X., Shan, Y., & Wong, T.-T. (2024). ToonCrafter: Generative cartoon interpolation [Preprint]. arXiv. https://doi.org/10.48550/arXiv.2405.17933"
}
```

This second record deliberately remains incomplete. It illustrates a valid research candidate that **must not pass the execution or packaging gate**. `null` records an unresolved field; it is not a fabricated checksum or an approval.

```json
{
  "schema_version": "1.0",
  "component_id": "COMP-EXAMPLE-CANDIDATE",
  "kind": "model_checkpoint",
  "source_ids": ["REF-TOONCRAFTER", "REF-TOONCRAFTER-MODEL"],
  "origin_url": "https://huggingface.co/Doubiiu/ToonCrafter",
  "revision": null,
  "artifact_sha256": null,
  "dependencies": [],
  "dependencies_audited": false,
  "license": {
    "identifier": null,
    "evidence_url": null,
    "notice_file": null
  },
  "use_state": "candidate",
  "permission_state": "not_reviewed",
  "execution_allowed": false,
  "distribution_allowed": false
}
```

A model card's license tag is evidence to inspect, not a substitute for the complete artifact audit. A dependency list cannot be marked complete merely because the top-level repository has a permissive license. Track separately licensed code, weights, adapters, training/evaluation data, and optional submodules.

### Lifecycle before and after borrowing

Before using a new external resource, register the source, inspect the freely available original, establish the intended use, and create any needed component records. Before executing downloaded code, inspect its installation and execution instructions, fix its identity to an exact version or revision, and resolve the license scope and dependency requirements. Record the download hash after acquiring the permitted artifact. Do not execute an unknown artifact simply to discover its permissions later.

Before the first experiment, record the relevant source and component IDs, the actual experimental configuration, and the inputs' provenance. Put the APA record in the generated credits data at this point. It must not depend on whether the experiment succeeds. Afterward, record results, failures, useful limitations, and whether the approach will be retained, revised, or retired.

When code is copied or adapted, place a concise source ID and adaptation note near the relevant module, alongside any required original copyright notice. For a method independently reimplemented from a paper, state that relationship accurately. Avoid claims such as “official implementation” unless they are established by the source.

When an implementation is removed, retain the source and historical experiment records but remove the artifact from the active runtime inventory. When a component is upgraded, reassess changed dependencies and license terms. Installation lockfiles and package inventories should help identify omissions; they cannot discover every manually copied method, asset, or checkpoint.

Keep local artwork private in exported research manifests by default. Record a local asset ID and rights basis without embedding private images, absolute private paths, or confidential filenames in public credits. Public training datasets, public evaluation assets, and privately supplied user artwork need different visibility treatment.

## APA preparation and evidence rules

Use APA 7 conventions for each resource type. The public APA guidance identifies author, date, title, and source as the core elements and gives rules for missing information. Use `n.d.` when a publication date cannot be established. Do not turn an access date or site-wide copyright year into a publication date. If no individual author is named, use a responsible organization when supported; if authorship cannot be established, follow the title-first rule rather than inventing an author. ([REF-APA-MISSING](#ref-apa-missing); [REF-APA-WEB](#ref-apa-web))

For a paper, preserve the verified author order and use the publication version actually consulted. For a preprint, identify it as a preprint and include its repository and verified DOI or stable URL. Do not combine a preprint's year with guessed journal volume or conference page numbers. If a project page provides the only metadata inspected, label the citation as a project page rather than pretending the full publication was checked.

For software, a dataset, or a model, use the creator or responsible publishing organization supported by the artifact's metadata, a release date when available, the exact version when selected, the title, an appropriate resource description, and a stable URL. Check `CITATION.cff`, release metadata, a model card, and the authors' recommended citation. A repository account name can identify its publisher, but must not be represented as proof of sole authorship. Record paper authors and code contributors separately when those identities differ.

Unversioned documentation and repository pages may change. Record the retrieval date for the changing page; prefer a versioned release or permanent revision when the actual artifact is selected. For static publications, a retrieval date is generally unnecessary. The source registry always records its internal check date even when that date does not belong in the displayed APA reference.

Generate APA reference-list order and consistent `a`, `b`, and subsequent suffixes for entries sharing identical authors in the same order and the same publication year. For this seed catalog, follow APA's publicly accessible same-author/date guidance: assign the letters in alphabetical title order and keep the year–letter combination consistent in references and author–date citations, even when the reference includes a month and day. Preserve initials, diacritics, and name order from the original. Validate URLs and DOIs; never fabricate a DOI because one would make the entry look more scholarly. Use sentence case for work titles while retaining proper names and acronyms. Do not place tool-specific search-reference tokens in the Markdown deliverable or application credits. ([REF-APA-SAMEAUTHOR](#ref-apa-sameauthor))

Every empirical claim in a research decision should identify its supporting source and distinguish the source's reported result from the team's own reproduction. Keep concise original evidence notes and lawful links. A citation does not authorize copying a complete article, reproducing its figures, or distributing examples whose rights are unclear. Include required license texts and notices where permitted and necessary; do not bundle complete papers as an improvised offline bibliography.

The seed references below supply a starting research map. Recheck their current metadata and exact artifact terms when adopting a component. The example references do not replace a component-specific permission review, and source availability does not establish reproducibility or suitability for this artist's workflow.

## Verification and release gates for attribution

### First prototype gate

The minimal offline experiment-viewer shell must have a working **CREDITS** button, keyboard access, offline reference display, and the records for everything used before the first borrowed experiment runs. Headless execution must retain this accompanying viewer and also expose `--credits`. Repeat the entry-point check for each selected host when implemented. A screenshot or short manual demonstration should confirm visibility and readable presentation. A focused automated test should confirm that the credits data load without network access and that the button opens the correct view. Avoid a large suite of tests that merely repeats the UI implementation.

### Experiment gate

An experiment is ready to execute only when its material sources and exact third-party artifacts are registered, its intended use is permitted, and attribution is generated. All source IDs must resolve. Unknown authorship is handled honestly through APA's missing-information rules, rather than invented metadata. Missing license evidence for an executable component blocks that component's execution; it need not block independent procedural work or reading public papers.

For data, establish whether the intended evaluation, training, publication, and redistribution are permitted separately. A downloadable benchmark's sample images do not automatically become redistributable application demos. Keep restricted or private datasets out of public packages while preserving their lawful internal provenance and appropriate public bibliographic attribution.

### Integration and release gate

Before packaging, compare the dependency inventory, lockfiles, installed model manifest, code provenance annotations, data/asset manifest, and generated credits. Check that runtime entries correspond to the actual build, evaluated but unshipped components remain correctly labelled, required notices are present, and disabled experiments have not entered the package accidentally.

Validate the following substantive conditions:

- Every borrowed method, bundled component, and material evaluation resource has a resolvable bibliographic record.
- Included artifacts have exact identities and documented permission for the intended release configuration.
- The distinction between code, weights, data, assets, and their licenses remains intact.
- Historical experiment entries are still searchable, including failed and retired work.
- APA exports preserve the content, URLs, and ordering of the displayed references.
- Offline credits and license notices are included in every supported package.
- No paid dependency or account requirement has appeared in the default workflow without authorization.
- A candidate or partially reviewed resource is never presented as a shipped, approved, or reproduced component.

Run a deterministic credits build in continuous integration. Reject unresolved cross-references, contradictory use states, accidental placeholders in shipped records, missing required notices, and a runtime component absent from the current inventory. A temporary external link outage should be reported during research maintenance, not prevent an installed offline application from opening its credits. Preserve the recorded canonical link and check for a lawful replacement or archive when appropriate.

Keep these gates proportionate: they should catch missing attribution and incorrect permissions, not create a new bureaucracy for every reversible coding step. Once a gate has been satisfied for the unchanged exact artifact and use scope, reuse the recorded decision. Reassess when facts, versions, licenses, or the intended use change.

## Engine architecture and research specification

### Status and interpretation of this section

This section specifies a proposed system to be developed and evaluated. It does not claim that an existing repository implements the complete design. The project includes procedural algorithms, existing trained models, adaptations of existing models, and newly designed neural components when experiments justify them. No one of those approaches is mandatory for every operation.

The complete objective remains an integrated assistant for still drawing and animation: interpret artist-supplied rough work and optional references, propose useful refinements and intermediate drawings, organize the results, and preserve the artist's ability to alter them. An early demonstration of one operation is a milestone toward that objective, not permission to redefine the project as a narrow image filter or generic video generator.

Every borrowed method, implementation, dataset, model, checkpoint, or experimental component used while pursuing this section must enter the project's source registry before its experiment is run. Its APA reference must be available through the required CREDITS interface, including when the component was evaluated but not retained. The registry must distinguish an original project design decision from a method borrowed or adapted from a source. Do not label a combination of existing techniques as a novel scientific contribution without evidence.

### Shared representation of a drawing or shot

Build the engine around a versioned project representation. It is the authoritative description of inputs, proposals, corrections, and timing; an exported video is only one rendering of that description. The Krita adapter and any standalone editor should exchange this representation through a documented interface.

Represent at least the following entities:

| Entity | Required information |
| --- | --- |
| Project | Stable identifier, schema version, canvas dimensions, color profile, source document link, and project revisions. |
| Shot | Playback rate, duration, active frame range, coordinate system, references, and motion constraints. |
| Source asset | Original bytes or a lossless reference, asset hash, dimensions, origin, rights metadata, and import settings. |
| Drawing | Persistent identifier, its raster or vector content, artist/generated status, source revision, and approval state. |
| Stroke | When available: geometry, direction, width or pressure profile, brush metadata, provenance, and grouping. |
| Region | A mask or boundary representation, optional part label, palette assignment, and correspondence links. |
| Part | A possibly uncertain identity linking related strokes and regions across drawings. |
| Exposure | Drawing identifier, layer identifier, start time, and duration. |
| Constraint | Scope, type, priority, source, and whether the artist has made it mandatory. |
| Proposal | Candidate outputs, generating operation, input hashes, settings, source/model versions, and review state. |
| Correction | Edited content or constraint, affected entities, authoring revision, and invalidated proposals. |

Stable identifiers must survive renaming, layer reordering, saving, and reopening. A layer name such as `Left arm` is a display label, not its identity. The engine may initially use neutral labels such as `Region 12` when it cannot establish a meaningful semantic identity. Do not invent confident body-part labels simply to make a layer tree appear intelligent.

Preserve the difference between an artist-created layer, a model-inferred group, an occlusion layer, and a color island. These are useful but different structures. A visible patch of a sleeve is not automatically a complete hidden sleeve, and an occlusion ordering is not automatically a skeletal rig.

The project should support raster, vector, and mixed representations. Do not require artists to vectorize their entire workflow. Keep original raster sources when deriving vector paths; retain vector information when it already exists. A vector centerline may be useful for correspondence while a raster brush rendering remains the preferred final appearance. Store the transform between representations explicitly.

Use a declared coordinate convention. Record canvas origin, pixel centers, crop offsets, scaling, padding, and any normalization used by a model. Model preparation must return an invertible placement transform wherever possible. Generated content must return to the intended position on the original canvas without silently rescaling the entire drawing.

Use integer frame indices for the editor timeline and a rational playback rate where needed. If an engine internally uses continuous time, define how continuous positions map to frame boundaries. Keep the number of unique drawings separate from the number of occupied timeline slots. A drawing held for four slots is one drawing with an exposure, not four independent artist decisions.

A minimal interchange example could resemble the following. This is a schema sketch to refine, not a claim that Krita natively stores this JSON:

```json
{
  "schema_version": "0.1",
  "project_id": "project_demo",
  "revision": 7,
  "canvas": {
    "width": 1920,
    "height": 1080,
    "color_profile": "sRGB",
    "alpha_mode": "straight"
  },
  "shot": {
    "id": "shot_01",
    "fps": {"numerator": 24, "denominator": 1},
    "duration_frames": 12
  },
  "drawings": [
    {"id": "draw_A", "asset": "assets/A.png", "origin": "artist"},
    {"id": "draw_B", "asset": "assets/B.png", "origin": "proposal"}
  ],
  "exposures": [
    {"layer_id": "layer_character", "drawing_id": "draw_A", "start": 0, "length": 4},
    {"layer_id": "layer_character", "drawing_id": "draw_B", "start": 4, "length": 8}
  ],
  "constraints": [
    {"id": "lock_A", "type": "preserve_drawing", "drawing_id": "draw_A", "hard": true}
  ],
  "provenance_manifest": "provenance/runs/run_0007.json"
}
```

The illustrated provenance path is relative to this artist project's private data root. It identifies an ordinary processing run, separate from the development repository's research-experiment manifests. Follow the distinct runtime and research layouts defined in the provenance architecture.

Migration code must preserve older projects. Keep the original project before a migration that changes interpretation. Unsupported fields should produce explicit compatibility handling rather than silent deletion.

### Invariants, ownership, and reproducibility

Define invariants before model integration:

1. Original input assets remain recoverable.
2. A proposal cannot replace an approved drawing without an explicit edit operation.
3. A hard lock is enforced by application logic, not only by a prompt.
4. Every exposure refers to an existing drawing and layer.
5. Every generated asset has an operation record and provenance.
6. A completed job cannot overwrite a newer document revision accidentally.
7. Rejected proposals remain identifiable so that the same result is not presented repeatedly as new work.
8. Color-space and alpha conversions are declared and tested.

Separate changing a proposal from accepting it. Acceptance can copy or reference proposed content into an approved state while retaining the previous version for undo. Deleting a proposal should not delete its original input. Deleting a drawing should offer explicit exposure behavior: retain the time through a hold, replace the drawing, or retime the shot. Do not silently shorten the animation.

Each operation should record input hashes, engine version, source-registry identifiers, model/checkpoint hashes, parameters, random seed where applicable, relevant library versions, and execution environment. Exact bitwise reproducibility may not be possible for every accelerator operation; document the reproducibility level actually achieved. Do not equate a fixed seed with a universal guarantee of identical output.

Represent uncertainty honestly. A geometric ranking score is not a probability. A neural score is not a calibrated probability unless calibration has been evaluated. Store a `score_kind` such as `heuristic`, `uncalibrated_model`, or `calibrated_probability`, and avoid presenting invented confidence percentages in the artist interface.

### Rough input preparation and line-art proposals

Preserve available information during import. Stroke order, pressure, brush identity, vector handles, separate construction layers, and artist grouping can be valuable evidence. If only a flattened image is available, record that limitation instead of pretending to recover its original drawing history.

Classify inputs by useful properties rather than a single quality score. Examples include clean but shaky contours, repeated overdrawn contours, construction-heavy sketches, textured pencil strokes, and drawings with intentional open edges. The classification should help choose processing; it must not become an excuse to reject every difficult drawing.

Preparation may include transparency handling, background estimation, line detection, crop selection, and conversion to model input dimensions. Each transformation must be reversible or preserve the original. A binary line mask is a derived representation, not a replacement for antialiased artwork. Record thresholds and avoid destructive binarization of the only copy.

Investigate conventional and learned cleanup methods on the same examples. Conventional candidates include fitting curves to a known stroke, reducing local jitter, estimating stroke width, consolidating closely related marks, and preserving detected corners. Learned candidates include predicting intended contours or junctions from ambiguous marks. Register credited sources for whichever concrete methods are actually implemented or tested.

Distinguish three outputs:

- A cleaned raster suggestion retaining the original medium's appearance.
- A centerline or boundary vector representation for editing and analysis.
- A semantic interpretation of the drawing's parts.

Success at one does not establish success at the others. Vectorization can reproduce an unwanted construction line perfectly. A clean silhouette does not prove that the engine understands the character's anatomy. Evaluate the intended task directly.

Cleanup should be region-selectable and offer understandable controls such as preservation strength or corner retention. Prefer parameters tied to visible consequences. Keep experimental neural parameters in an advanced panel rather than making every artist tune sampling internals.

Use the original image and artist locks to constrain proposals. If smoothing removes a deliberate notch, the artist should be able to restore it and mark it for preservation. When a local edit creates a seam, propose a limited transition region while preserving the core approved content. Do not hide a global redraw behind a command labeled as local cleanup.

For still drawings, the same preparation, proposal, comparison, and approval mechanisms should operate without a timeline. Do not make animation setup a prerequisite for useful single-frame assistance.

### Gap inference and fill boundaries

Treat visible line completion and fill containment as separate operations. An open contour may be aesthetically intentional while still needing an invisible barrier for a paint fill. Store the barrier in a fill-boundary representation and expose it for inspection and correction.

A procedural baseline can identify candidate endpoints or narrow breaks, propose short connecting curves, and rank them using geometry and context. Relevant evidence includes normalized distance, tangent agreement, curvature, neighboring ink, likely region boundaries, and whether a connection would cross a protected stroke. Normalize distances by image scale or local stroke width so a setting behaves sensibly across resolutions.

A proposed ranking function might combine these terms:

\[
C(g)=w_dD(g)+w_tT(g)+w_cK(g)+w_xX(g)+w_rR(g),
\]

where `g` is a candidate bridge, `D` measures separation, `T` directional disagreement, `K` curvature cost, `X` crossing or collision penalties, and `R` contextual inconsistency. This is an illustrative project design, not a validated published formula. The weights and terms require experiments, and lower cost must not be displayed as a calibrated probability.

Reject geometrically invalid candidates early. Consider multiple plausible closures when a junction is ambiguous. Use artist-defined keep-open constraints to prevent repeated unwanted closures. A refusal to make an automatic connection can still produce a useful highlighted candidate for the artist.

Learned gap prediction is an allowed extension. A predictor could examine a local patch plus broader context and output candidate endpoints, a boundary mask, or a ranking over procedural candidates. Comparing that hybrid against pure geometry is more informative than assuming a neural network must redraw the whole image.

Evaluate both containment and topology. Closing more gaps is not inherently better: merging an eye with a face region can be worse than leaving a small leak. Track correct closures, missed closures, false closures, region merges, region splits, and artist repair time. Include deliberately open contours in the evaluation set.

Provide a boundary-edit mode with clear affordances to add a barrier, remove a barrier, retain an opening, and preview the resulting regions. Changes to a fill boundary should invalidate affected fill results without unnecessarily invalidating unrelated motion or line-art proposals.

The OpenCV morphological operations documentation is a freely accessible reference for basic image-mask operations, but its operations alone do not supply semantic gap interpretation: [https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html](https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html).

### Region construction, flat color, and palette control

Build color assistance around regions and artist-specified palette identities. Store a palette entry as a stable identifier plus its color value and profile; do not use approximate pixel equality as the sole definition of identity. A shirt region can retain `shirt_main` even if its displayed color changes later.

Construct candidate regions from fill boundaries, existing masks, or predicted segmentation. Record region adjacency and whether a region is complete, partially occluded, or uncertain. Preserve tiny regions that matter to the drawing while allowing configurable filtering of scan noise. Small area alone does not prove that a region is accidental.

Allow several ways to assign colors: artist clicks or scribbles, named palette assignments, matching to a supplied reference, and propagation from approved neighboring frames. Keep direct artist assignments stronger than inferred ones. Distinguish flat color from shading and lighting so that a flatting operation does not introduce unwanted rendered gradients.

Reference-driven color assignment should reason about region identity, location, shape, and surrounding parts. Nearest sampled color is insufficient when several unrelated parts use similar tones. When reference correspondence is uncertain, keep the proposed assignment reviewable and make palette-wide changes easy.

Across animation, track region identity through splits, merges, occlusion, and reappearance. A sleeve hidden behind a torso can later reappear as multiple visible islands that share a palette entry. Model these relationships instead of assuming every frame has an identical list of connected components.

Propagation must use approved anchors. A mistaken automatic frame should not become unquestioned truth for every later frame. Record whether a color assignment came from an artist anchor, a model prediction, or a propagated estimate. Recomputing a corrected section should trace those dependencies.

Render fills with explicit alpha handling and an evaluated edge-overlap policy. Test for halos, transparent fringes, pinholes, and leakage under antialiased ink. Preserve original linework above the proposed fill when that is the artist's selected workflow. Do not make all lines opaque black as an undocumented shortcut.

Useful interaction precedents include Krita's Colorize Mask and the FlatMagic research tool. They support research into artist-guided coloring; they are not evidence that arbitrary animated rough sketches are fully solved. Freely accessible sources: [https://docs.krita.org/en/reference_manual/tools/colorize_mask.html](https://docs.krita.org/en/reference_manual/tools/colorize_mask.html) and [https://www.cond.org/flatmagic.html](https://www.cond.org/flatmagic.html). Any borrowed implementation or experimental method still requires its own registry entry and license check.

### Character references and style preservation

Reference sheets should be optional structured inputs. Accept one image, multiple views, selected crops, palette swatches, and artist labels where supplied. Record which reference belongs to which character. Do not assume that several characters on one sheet are multiple views of the same person.

Useful reference metadata includes view direction, neutral pose, facial expression, part names, symmetry exceptions, and whether colors represent flats or lighting. Make metadata assistance optional: the engine can propose labels and let the artist correct them. Preserve a path for simple drag-and-drop references.

Separate appearance evidence from motion instructions. Additional views can clarify a hairstyle or clothing seam but cannot uniquely determine whether a hand travels clockwise, pauses, or snaps forward. Motion constraints may come from a path arrow, an impact time, an action description, or an extra drawing. The system should make a best-effort proposal when that information is absent and expose the assumption when useful.

Investigate reference conditioning, feature matching, explicit palette binding, and retrieval of the most relevant view. A custom model may be justified if existing systems cannot maintain the required character identity across changes of pose. Do not claim that merely attaching a reference image guarantees viewpoint understanding or style adaptation.

Preserving style includes geometric decisions as well as texture: asymmetry, proportions, repeated simplifications, line breaks, shape exaggeration, and selective detail. A cleanup metric based only on smoothness can remove these features. Evaluate character identity and preservation of artist-approved details alongside line cleanliness.

Style adaptation should have levels. A conservative mode can prioritize source geometry and avoid adding detail. A more interpretive mode can offer stronger contour or pose proposals. Fine-tuning is an optional later mechanism, not a prerequisite for reference use. Saving an edited drawing is project memory; it is not automatically a training update.

Use only authorized artwork for any training or persistent style adaptation. Per-project reference use and long-term training consent must be represented separately. A user importing a file to animate it does not automatically authorize uploading it, adding it to a shared dataset, or training a distributed model on it.

### Correspondence, motion, topology, and occlusion

Research motion as several related problems: correspondence, trajectory, deformation, visibility, and rendering. A temporal interpolation parameter cannot solve all five. A cubic easing curve changes progress over time; it does not establish which hand in one image corresponds to which hand in another.

Start each motion operation from approved key drawings and optional breakdowns. Estimate correspondences between relevant strokes, landmarks, regions, or parts. Support partial and unmatched correspondences. If a mouth closes or a hand rotates, forcing every contour into a one-to-one match can produce misleading deformation.

Allow manual correspondence corrections using simple selections or anchors. These corrections should become persistent constraints associated with entity identifiers. Keep a history of rejected matches, and invalidate them only when their underlying drawings change sufficiently to make the old decision inapplicable.

Investigate geometric warping, piecewise deformation, and learned correspondence on the same shot set. Optical flow can be one source of displacement evidence, but its apparent smoothness is not proof that it respects stylized motion or character anatomy. Preserve a distinction between matching visible evidence and generating newly visible content.

Represent trajectories separately from timing. An artist may specify an arc and then choose to spend most of the exposure near its start, accelerate abruptly, and settle at the end. Allow independent controls for spatial path, progress, and shape change. Contacts such as a planted foot or a hand on a surface should be explicit constraints rather than incidental pixel similarities.

Treat topology changes as first-class events. A contour can appear, disappear, split, merge, or become hidden. Record such events so that subsequent color and layer operations understand why region counts changed. Do not conceal a failed correspondence by cross-fading unrelated anatomy and calling it a valid in-between.

Occlusion may require local masks as well as layer order. A single global ordering of two complex shapes may be insufficient when their overlap changes spatially. Permit an inferred part to have several render fragments linked to one semantic identity. Detect contradictory stacking assumptions and request or propose a repair rather than silently rendering an impossible order.

For newly exposed surfaces, use available reference views, neighboring drawings, procedural shape continuation, or a generative predictor. Mark inferred content as proposed. The artist must be able to replace it with a new anchor drawing. Hidden geometry is an additional inference problem, not something automatically recovered by segmenting visible pixels.

The transient-embedding rough-animation work and LayerInbetween are relevant freely accessible research references for this investigation. Their actual input requirements and limitations must be checked before reproduction: [https://mostyle.github.io/blog/eg2023/](https://mostyle.github.io/blog/eg2023/) and [https://mo-haoran.com/LayerInbetween/](https://mo-haoran.com/LayerInbetween/).

### Sparse drawings, exposure schedules, and expressive timing

Treat the requested economy of drawings as an optimization and interaction problem. The system should search for useful drawing selections and exposures while preserving the supplied action constraints. It must not equate high frame rate, maximum smoothness, or a larger number of generated images with better animation.

Keep at least three quantities separate: playback frame rate, number of distinct drawings, and number of generated proposals examined internally. A model might generate a dense candidate sequence before selecting a sparse result. That can reduce artist-facing drawings without reducing internal computation. Report those differences honestly when discussing performance.

Accept a drawing budget, required key poses, duration, and optional event constraints. Examples of events include a contact, impact, reversal, maximum extension, or settling point. These can be specified directly, inferred as proposals, or corrected by the artist. A hard requirement must not be dropped merely to meet a budget.

If the requested budget is infeasible under mandatory constraints, explain which requirements conflict and present alternatives. Do not silently violate duration or remove an approved key. A budget can be a maximum, a target, or a preference; the interface and job specification must identify which.

Develop candidate schedules using multiple hypotheses. One candidate may hold longer before an action; another may include an extra breakdown; another may use a smear. Evaluate schedule candidates using readable silhouettes, trajectory consistency, required events, selected style preferences, and artist review. These are proposed evaluation criteria, not a universal formula for artistic impact.

An illustrative objective is:

\[
\min_{D,E} \;\lambda_N |D| + \lambda_M L_{motion}(D,E) + \lambda_I L_{identity}(D)
 + \lambda_R L_{readability}(D,E) + \lambda_P L_{preference}(D,E),
\]

subject to fixed keys, required events, locked content, and total duration. Here `D` is the set of selected drawings and `E` their exposure schedule. This is a proposed design scaffold. The losses need operational definitions and validation; the expression does not prove that perceived impact has been solved mathematically.

Begin with interpretable schedule proposals and artist-controlled parameters. A learned preference model may later rank candidate schedules if there is suitable consented feedback. Keep stylistic disagreement visible: an intentional hold or exaggerated discontinuity should not be automatically penalized as an error because it differs from smooth physical motion.

Evaluate timing at actual playback speed as well as frame by frame. A drawing that looks strange in isolation may communicate effectively in motion. Conversely, attractive individual frames can produce poor timing. Store artist preferences about these cases rather than flattening both judgments into one image-quality score.

### Smears, exaggeration, and special transition drawings

Treat smears as intentional transition drawings with a short exposure and a defined relation to the motion. They are not an unrestricted blur applied to a failed frame. Candidate techniques include directional stretching of selected forms, repeated contours, elongated silhouettes, and artist-provided smear templates. Register sources for any technique concretely borrowed or reproduced.

Control smear direction, extent, affected parts, color behavior, and duration. Protect readable anchors such as a head or a contact point when requested. A whole-character smear and a moving-hand smear should be different operations. Let the artist paint or replace the proposal directly.

Separate smear geometry from temporal easing. An exponential progress curve can make motion accelerate; it does not by itself create a useful elongated drawing. A custom predictor could propose smear shapes from neighboring poses and motion direction, while deterministic code places the resulting drawing at the intended exposure.

Overshoot, squash, stretch, and anticipation should be optional stylistic controls. Do not force them into every action or describe them as universally correct physics. Evaluate whether they communicate the artist's specified intent. Mark deliberately nonphysical deformation as intentional when the artist approves it so later cleanup does not automatically undo it.

### Research protocol for new or adapted neural components

Create a custom neural component when a measured failure warrants investigation, not merely because the project is described as AI-assisted. Equally, do not rule out a new component solely because an existing downloadable model is easier to install. The full objective determines the research priorities.

For each proposal, write a short experiment record before implementation: task, observed failure, hypothesis, free sources consulted, candidate architecture, training data, labels, baseline, evaluation split, compute budget, and stopping condition. Register all borrowed sources in CREDITS, including data-generation code and discarded comparison models.

Candidate task formulations include endpoint connection ranking, intended-contour prediction, region identity, stroke correspondence, occlusion masks, intermediate pose generation, and exposure-schedule ranking. A shared encoder with several prediction outputs is an allowed hypothesis. Separate models connected by the project representation are also allowed. Compare whole-workflow behavior, not only isolated benchmark scores.

Design labels around the task. Clean images alone do not necessarily supervise stroke identity, part layering, or temporal exposure choices. Multiple valid cleanups may exist for one rough sketch. Avoid treating one artist's interpretation as the only mathematically correct answer when another preserves the same intent.

Potential data sources include consented artist examples, properly licensed public datasets, synthetic drawings with known geometry, and manually reviewed generated training cases. Keep each source's rights and allowed uses. Free access to a paper or dataset does not automatically authorize every training or redistribution use.

Synthetic data can provide exact correspondences, layer identities, and masks, but its distribution may differ from real sketches. Evaluate that gap directly. Preserve real artist drawings as an independent test set, and report where synthetic-trained methods fail on texture, exaggeration, construction marks, or unusual anatomy.

Split datasets by character, sequence, and source where appropriate. Randomly splitting adjacent frames can leak near-duplicates between training and testing. Hold out entire motions and selected drawing styles when testing generalization. Keep a separate development set for tuning so that repeated experimentation does not convert the test set into an informal training set.

Possible loss terms include contour alignment, topology consistency, region identity, temporal correspondence, palette agreement, and preservation of locked evidence. Define every term precisely and test whether it correlates with artist effort. Pixel similarity alone can reward blurred output. Smoothness penalties can suppress intended stylization. A loss that improves a numerical score while increasing correction time should trigger review.

Run ablations that answer concrete questions: Does reference conditioning help? Does the new correspondence head reduce repair? Does a topology term prevent region merges? Does the extra model improve enough to justify its memory and latency? Avoid large experiments whose outcomes cannot change an implementation decision.

Track training-data versions, initialization checkpoints, hyperparameters, seeds, code revision, model artifacts, validation results, and rights metadata. Make training resumable. Apply compute and time limits before launching long jobs. Do not use paid services or change a user's cloud infrastructure merely because a training script supports it.

Character-specific adapters or fine-tunes are optional. Evaluate whether they improve the intended task without damaging poses or views absent from the adaptation data. Preserve the unadapted model for comparison. Do not promise a useful adapter from an arbitrary small number of examples or claim that a reference sheet automatically supplies a complete training set.

Distillation, quantization, pruning, or lower-resolution operation may be researched when a useful model is too expensive. Each can change behavior. Measure fidelity, topology, latency, and correction time after the change rather than assuming a smaller model is an equivalent replacement.

Promote a model from experiment to supported backend only after documenting its input assumptions, failure cases, license compatibility, runtime needs, and integration behavior. A model can remain an optional experimental backend if it is useful for some shots but does not satisfy broader reliability targets.

### Correction dependencies and local regeneration

Build a dependency graph linking source drawings, references, inferred representations, proposals, and rendered output. Editing a keyframe should invalidate the results that depend on that revision. Editing a palette entry should not force a motion model to rerun unless its actual inputs or constraints require that.

A regeneration request must specify spatial scope, temporal scope, constraints, and the input revision. Use a stable job identifier and keep accepted content separate from pending results. When a job finishes against an older revision, present it as stale or rebase it only through a verified procedure. Never overwrite newer artist edits because a background job completed later.

Local processing may still need surrounding context. Include a context margin around a selected region and appropriate neighboring keyframes, while defining exactly which output area may change. Preserve the locked core through explicit masking or asset reuse. If satisfying a boundary condition requires a broader edit, present that as a separate proposal.

An edited in-between can become a new key or breakdown. Split the affected interval around it, retain its exposure constraints, and recompute neighboring proposals as needed. Do not require the artist to restart an entire shot to add one useful decision.

Cache reusable computations using content and configuration hashes. A cache entry must include the relevant model version, preprocessing settings, reference inputs, and constraints. Do not reuse a result solely because the file path or layer name is unchanged. Keep cache deletion separate from deletion of accepted artwork.

Retries should explore a specified alternative or incorporate changed evidence. Repeatedly generating the same request is not guaranteed refinement. Preserve enough history to compare candidates and identify whether a correction actually improved the result.

### Evaluation of the integrated engine

The primary outcome is time to an artist-acceptable drawing or shot, including setup, generation, review, correction, and export. Compare against a reasonably similar manual workflow. Keep the artist's acceptance criteria explicit, and do not substitute a visually impressive demo for measured usefulness.

Track correctness of edit preservation, timeline duration, layer placement, color handling, and save/reopen behavior as engineering requirements. Separately track prediction usefulness: false closures, missed regions, contour repairs, correspondence failures, character drift, unwanted timing changes, and amount of redrawing.

Include cases that exercise the full ambition: still drawings, simple motion, rotation, occlusion, region splits, intentional open lines, textured ink, multiple references, and sparse timing. Introduce difficult cases gradually for diagnosis while retaining them in the long-term evaluation plan. Do not permanently exclude a hard requirement to make headline results look better.

Keep negative results. An unsuccessful custom network can still teach which representation or supervision is missing. Report what was tested, the freely accessible sources used, what failed, and the next decision. Preserve source credits even when an experimental component is removed from the shipping application.

## Research starting map: candidate approaches and decisive experiments

This is an initial research map, checked against publicly available primary sources during preparation on October 20, 2026. It is not a universal ranking or a preselected dependency bundle. Codex must refresh relevant findings, inspect released implementations, and compare candidates on the project's actual tasks. Keep paper evidence, released-code capabilities, licensing clearance, and locally reproduced performance separate.

### Match the experiment to the information supplied

Maintain separate evaluation sets for **still drawings**, **artist-supplied dense rough keys**, and **two or a few sparse keys**. Dense keys already specify much of the action; their principal challenges can be consistent cleanup, filling, and preserving motion. Sparse keys additionally require interpretation of trajectories, missing poses, timing, and visibility. Do not report success on dense guidance as solving arbitrary two-key animation.

Likewise, distinguish raster frames that can be repainted, editable vector strokes, organized masks, and semantic part layers. Sparse sketch conditioning describes the input. It does not establish that a model generates a small, artistically effective set of distinct output drawings.

### Procedural gap and region foundations

Use morphology, connected regions, contour geometry, endpoint distance and tangent agreement, and editable boundary masks as candidate procedural baselines. OpenCV documents basic morphology; OpenToonz documents gap-handling and animation-painting workflows. The proposed experiment must determine where these methods contain fills without joining unrelated contours, damaging thin details, or eliminating deliberate openings. Test visible-ink preservation separately from fill containment. Geometry provides useful evidence but does not by itself establish a boundary's artistic meaning. ([REF-OPENCV-MORPH](#ref-opencv-morph); [REF-OPENTOONZ-FILL](#ref-opentoonz-fill))

### Learning to Simplify: intended-contour cleanup

Learning to Simplify addresses rough raster sketch cleanup and produces simplified raster drawings. It is relevant when the input contains several marks around an intended contour. It does not directly supply semantic part layers or a temporally consistent animation. Compare the amount of accepted cleanup against erased details and manual repair. Include construction marks, intentional texture, and distinctive asymmetry. Establish whether a separate cleanup pass helps or harms subsequent correspondence. ([REF-SKETCH-SIMPLIFY](#ref-sketch-simplify))

### Deep Sketch Vectorization: editable contour representation

Deep Sketch Vectorization converts raster line drawings into vector representations; its released implementation provides pretrained models and interactive refinement. Test junctions, crossings, open endpoints, and the artist's ability to repair a mistaken connection. Separately measure whether the input contour was interpreted correctly and whether it was represented accurately as curves. Vectorization must not be presented as automatic character-part understanding. Review checkpoint terms independently of the code license before use. ([REF-DEEPSKETCH](#ref-deepsketch); [REF-DEEPSKETCH-CODE](#ref-deepsketch-code))

### FlatMagic: editable intermediate color regions

FlatMagic is an interactive flat-coloring assistant developed around comic artists' workflows. Its relevance includes how users inspect and correct segmentation before accepting color results. Use it to formulate an experiment comparing correction effort, region selection, and recoverability. A segmentation that is imperfect but quickly editable may be more useful than one with a slightly better pixel score and awkward repair controls. Do not generalize its study results into a promised saving for this project. ([REF-FLATMAGIC](#ref-flatmagic))

### BasicPBC and character color-design sheets

The paint-bucket colorization research and BasicPBC implementation address reference-based color assignment, including character design sheets and animation sequences. Inputs include line drawings and suitable colored references; useful outputs concern colorized regions. Evaluate region segmentation separately from reference matching, then test propagation from multiple approved keys. Include open contours, small regions, and color roles that repeat on different parts. Published noncommercial restrictions require review before any implementation or checkpoint is used in the intended distribution. ([REF-PAINTBUCKET](#ref-paintbucket); [REF-BASICPBC](#ref-basicpbc))

### Frite and transient embeddings: controlled rough animation

The transient-embedding approach groups rough strokes and carries them through transformed lattices between keys, supporting nonlinear motion exploration and topology changes. It provides a procedural graphics direction for art-directed in-betweening. Test the amount of grouping and correspondence guidance an artist must provide, deformation quality, and whether edited breakdowns remain easy to incorporate. Its results do not establish automatic optimal exposure selection. Research software maturity and reuse permissions require separate investigation. ([REF-ROUGH-INBETWEEN](#ref-rough-inbetween))

### ToonCrafter: raster motion proposals from sparse endpoints

ToonCrafter's released model accepts starting and ending images with a motion description and generates a short raster sequence. Its official model card describes its output and known artifacts. Evaluate shape drift, flicker, endpoint agreement, and how much of each proposal the artist keeps. An extracted video frame is editable as pixels; it does not inherently provide separate line, fill, or character-part content. Verify which sketch-control features are actually released in the chosen implementation. ([REF-TOONCRAFTER](#ref-tooncrafter); [REF-TOONCRAFTER-MODEL](#ref-tooncrafter-model))

### ToonComposer: sparse sketches plus color guidance

ToonComposer combines colored-key guidance with sketch keys at selected times to generate animation; its released interface also supports motion masks. This makes it a direct candidate for the user's reference-and-rough-keys workflow. Test control adherence, consistency, repair burden, and actual resource use. Its raster-video output still needs integration into editable project structures. Experiments on sparse inputs must separately evaluate output-drawing selection and exposure timing. Its published licensing explicitly distinguishes its own material from third-party components. ([REF-TOONCOMPOSER](#ref-tooncomposer); [REF-TOONCOMPOSER-CODE](#ref-tooncomposer-code); [REF-TOONCOMPOSER-LICENSE](#ref-tooncomposer-license))

### LayerInbetween: structured correspondence and occlusion

LayerInbetween predicts stroke correspondences and layering for occlusion-aware in-betweening. Its released workflow requires raster keyframes and a prepared first-keyframe SVG; complementary strokes can require additional vector preparation. Evaluate that preparation burden alongside the usefulness of the resulting stroke structure. Test whether layering survives the host import and enables easier correction. Audit external checkpoints, including the documented depth-model dependency, before describing the pipeline as freely redistributable. ([REF-LAYERINBETWEEN](#ref-layerinbetween); [REF-LAYERINBETWEEN-CODE](#ref-layerinbetween-code); [REF-DEPTH-LICENSE](#ref-depth-license))

### GapFill: overlooked enclosed paint regions

GapFill addresses small enclosed areas left unpainted during flat coloring. It proposes colors from surrounding regions and provides inspection and correction interactions. This is a distinct task from preventing a fill from leaking through broken lineart. Evaluate missed-area detection and total inspection time, not color prediction alone. Its project page expressly restricts independent reuse of the third-party anime images supplied for its demonstrations; use permitted fixtures for this project's experiments. ([REF-GAPFILL](#ref-gapfill))

### Selection rule

For each candidate, record the required inputs, actual outputs, missing controls, preparation effort, compute measurements, correction burden, provenance, and distribution implications. Retain strong baselines and negative results. Combine methods through the shared project representation only when the experiment shows a useful contribution. A documented recurring gap can justify a custom procedural method or learned component; this starting map does not limit original research.

## Delivery architecture, development stages, and continuation protocol

### Purpose of the staged program

Treat this as one continuing research and engineering project whose intended destination is the complete artist-assistance workflow. Stages make progress observable and failures diagnosable. Completing an early stage does not authorize redefining the final product as a gap-closing utility, a video generator, a demonstration website, or an image morphing script. Preserve the full requirements in the backlog and requirements matrix even when a particular research branch is deferred.

The deliverable at each stage must be concrete: executable code, an inspectable document-format experiment, an evaluated algorithm, a reproducible training experiment, or an integrated feature. A literature summary alone is insufficient when the stage also calls for implementation. Conversely, software that runs is not evidence that its predictions are artistically useful. Record those as different achievements.

Select one initial deployment path while maintaining an independent engine interface. A Krita plugin is the proposed first host because Krita can perform native document loading and saving; the owner may instead select a standalone application. Keep the choice revisable if an integration experiment identifies an actual blocker. Develop the standalone track when selected initially or desired later. A release does not require two complete host applications. Engine portability remains required, so processing code must not depend on Krita's user-interface objects or a particular standalone GUI.

### Separate the host application from the processing engine

Use three boundaries:

1. **Artist host:** the Krita plugin or standalone editor. It owns selection, preview, approval, import, export, and interaction with the artist's current document.
2. **Project representation:** the versioned description of drawings, regions, correspondences, references, timing, approvals, and generated proposals. It provides stable identities and records why an output was produced.
3. **Processing engine:** a separately executable worker that consumes an explicit job description and returns proposed changes and artifacts. It may invoke procedural methods, pretrained networks, newly trained networks, or several cooperating methods.

Keep model and GPU dependencies in the worker environment wherever practical. A Python-based host may communicate with a Python worker, but matching languages do not justify sharing mutable document objects or embedding every model dependency inside Krita. Profile before moving performance-critical operations into another language. Select implementation languages and GUI frameworks through an architecture decision record that considers deployment, maintenance, licenses, and the actual workload.

The engine contract must be independent of transport. A local process and an authenticated remote service should accept equivalent job descriptions and produce equivalent result manifests. Local execution is the first reference implementation. Remote execution can follow once the contract is stable and the user has authorized the relevant hosting and data-transfer arrangements.

### Job execution and revision handling

Represent job state explicitly: `created`, `validating`, `queued`, `running`, `cancel_requested`, `completed`, `cancelled`, or `failed`. A finished calculation becomes a proposal; it does not automatically become an approved document edit. Track result applicability separately as `current`, `stale`, or `requires_review`.

Every job must capture at least:

- Project, shot, source-frame, and source-layer identifiers.
- A document revision or content fingerprint for every consumed input.
- Selected spatial regions and time interval.
- Locked content and relevant motion or palette constraints.
- Engine, algorithm, model, and schema versions.
- Model weight identifiers and checksums when applicable.
- Relevant settings and random seeds when supported.
- Provenance and credit identifiers for the methods and assets used.
- Expected output representation, color space, dimensions, and timing convention.

If the artist edits the inputs while a job runs, a later result must not silently replace the newer work. Show it as a proposal from an older revision, allow inspection, and require an appropriate explicit apply operation if the user still wants it. A fingerprint is a mechanism for detecting stale inputs, not a guarantee of reproducibility across all GPU kernels or software versions. Document any nondeterminism observed in the reference environment.

Cancellation must be visible and meaningful. Some compute libraries cannot stop in the middle of an operation; distinguish cancellation requested from cancellation completed. Stop launching additional work, discard unapproved partial results safely, and preserve diagnostic information needed to understand the interruption. Do not label a job cancelled while a child process continues consuming substantial resources indefinitely.

Cache intermediate results by input and configuration identity. Regenerating a corrected hand should reuse unchanged references and other reusable computations when compatible. Cache invalidation must account for changes to models, preprocessing, coordinate systems, color settings, and artist constraints. Add cache inspection and bounded cleanup so experimentation does not consume storage without limit.

### Krita integration and native document fidelity

Apply the Krita API requirements below when developing the plugin or an installed-Krita bridge. An independently implemented standalone importer must demonstrate its own advertised document fidelity; it does not require building a plugin as well.

Investigate the actual supported Krita release before making an integration promise. The published Python documentation supports extensions and dock widgets, while the document and node APIs expose document operations, layer operations, time-specific pixel access, and image-sequence import. These are feasibility evidence, not a substitute for a test in the chosen release. Primary starting sources are the [Krita Python plugin tutorial](https://docs.krita.org/en/user_manual/python_scripting/krita_python_plugin_howto.html), [Document API](https://api.kde.org/legacy/krita/html/classDocument.html), and [Node API](https://api.kde.org/legacy/krita/html/classNode.html).

Establish a documented support matrix: operating system, Krita version, embedded Python/Qt environment, worker runtime, and supported image characteristics. Initially support one measured combination well. Expand based on real compatibility evidence. Avoid advertising a broad version range from a single successful launch.

Test document behavior using copies and purpose-made fixtures. Include animation exposures, layer groups, alpha, differing layer bounds, locked layers, a nontrivial palette, and representative masks. Include unsaved documents in the interaction tests. Determine which engine inputs should use raw layer pixels and which should use rendered projections; these can represent different artwork. Establish channel ordering, bit depth, premultiplied-alpha behavior, coordinate origin, and color-space conversion at the adapter boundary.

The documented `importAnimation(files, firstFrame, step)` interface uses a starting position and uniform step. Do not assume it provides unrestricted keyframe creation, movement, deletion, or replacement. Prove variable exposure schedules against the target release. Repeating an image at several timeline positions can demonstrate timing but may create redundant drawings; label that implementation honestly and retain a route to more appropriate exposure handling. Selective regeneration must not erase unrelated frames simply because a convenient import function recreates an entire layer.

Determine whether host undo can cover the intended operation as one coherent action. If the exposed API cannot provide the desired transaction, use a documented reversible alternative, such as importing proposals into a new layer group. Test undo, redo, cancellation, and application after a stale result. Preserve original source layers and make proposal acceptance distinguishable from source destruction.

Investigate annotation or sidecar metadata for document identity, approvals, and processing history. A metadata API existing does not prove that every field survives a save, close, reopen, and copy workflow. Test that round trip. If using sidecars, record a stable document identifier and reconcile document copies explicitly; a filename alone is insufficient identity.

Krita's native `.kra` format contains more than a flattened image. Its documentation describes an inspectable archive with a rendered `mergedimage.png`, but extracting that image is not full layered-animation import. Let Krita perform native serialization in the plugin route. For a standalone route, distinguish a Krita bridge, limited import, and independent native parsing as different capabilities. See the [native-format documentation](https://docs.krita.org/en/general_concepts/file_formats/file_kra.html).

If an interchange path is useful, evaluate Krita's TVPaint-style CSV animation format: it carries exposure information with image files, but the documentation states that groups and masks are unsupported. Use it only with an explicit fidelity statement. See the [CSV format documentation](https://docs.krita.org/en/general_concepts/file_formats/file_csv.html). A successful flattened export cannot serve as evidence that editable native structures have been retained.

### Suggested repository organization

Use this as a starting structure, adapting to an existing repository without destroying its conventions:

```text
AGENTS.md
ARTIST_ANIMATION_ASSISTANT_CODEX_MASTER_SPEC.md
PROJECT_STATE.md
USER_DECISIONS.md
NEXT_ACTIONS.md
REQUIREMENTS.md
CHANGELOG.md
provenance/
  sources.json
  components.json
  feature_uses.json
  experiments/
  decisions/
  licenses/
generated/
  credits.json
  CREDITS.md
  THIRD_PARTY_NOTICES.txt
docs/
  architecture/
  research/
  decisions/
  compatibility/
experiments/
engine/
  contracts/
  project_model/
  procedural/
  learned/
  jobs/
  io/
hosts/
  krita/
  standalone/
training/
evaluation/
fixtures/
packaging/
scripts/
tests/
```

`AGENTS.md` should point to `ARTIST_ANIMATION_ASSISTANT_CODEX_MASTER_SPEC.md` as the authoritative specification and to the small continuation files. An optional short `PROJECT_BRIEF.md` may serve as an index to that specification; it must not become a competing authority. Create host implementation directories as their tracks are selected, rather than treating both directories in this illustrative tree as required complete applications. Keep detailed experimental records outside the startup instructions. If an existing `LLM.md` is present, read it and reconcile its instructions rather than ignoring or replacing it. Do not copy the complete research archive into an ever-growing instruction file.

Store model checkpoints and large datasets according to an explicit artifact policy. Prefer versioned manifests, checksums, and permitted download instructions over silently committing large binaries into the repository. Decide how artists' private artwork is stored and excluded from public fixtures. Attribution records must remain available even when an optional component is not installed.

## Staged execution roadmap

### Phase 0 — Establish project state, research discipline, and attribution

**Inputs:** this brief, the existing repository if one exists, any local instructions, and the user's explicit requirements.

**Work:** inventory the environment and existing work; create a requirements matrix; distinguish user decisions from proposed implementation choices; establish source and experiment registries. Identify the initial host target and the practical questions that must be tested. Research current primary sources and record what is established, what has only been demonstrated by an author, and what is a proposed project design.

**Deliverables:** a concise current-state file, an executable development environment check, a first research comparison, initial architecture decisions, and the attribution data that will power the `CREDITS` button.

**Acceptance:** every mandatory user requirement appears in the traceability matrix; every borrowed element selected for a test has a verified free-access resource, an APA reference, and a recorded usage/license assessment. Create the minimal application or experiment-viewer shell with its `CREDITS` button before running borrowed implementation/model experiments, and make the relevant entries visible there. Headless benchmarks must emit the same source identifiers and readable attribution records so their results remain connected to that view. Reading and documenting research can precede this executable shell.

**If blocked:** identify the unavailable source, dependency, or environment constraint; continue unaffected research or implementation. Do not silently substitute paid access for the user's free-information requirement. Do not mark a source cleared merely because a search result or a repository badge mentions a license.

### Phase 1 — Prove the document and timeline round trip

**Inputs:** a minimal plugin or host shell and representative document fixtures.

**Work:** prove the selected document route. For the plugin or installed-Krita bridge, open a `.kra` through Krita. For an independent standalone importer, exercise the native features that importer advertises against known reference fixtures. Select and read two animated drawings; run an intentionally simple deterministic transformation; return the resulting images into an editable animation layer in the selected host; save a copy and reopen it using the supported project format. Exercise exposure timing, alpha, bounds, naming, and metadata. Establish keyframe-manipulation and round-trip limits rather than building around an assumed API or format capability.

**Deliverables:** a reproducible integration fixture, the adapter code, and a compatibility report that states exactly what was verified. The simple generated frames are integration probes and must be labeled accordingly.

**Acceptance:** originals remain recoverable; returned drawings are editable; tested timing survives reopening; the intended metadata either survives or has a tested alternative; no misleading claim of independent `.kra` support is made.

**If blocked:** isolate whether the failure is an API, version, color-conversion, or file-format issue. Evaluate a reversible new-layer import, a supported interchange format, or a different host adapter. Keep the core engine work moving while the host problem is investigated.

### Phase 2 — Establish the complete proposal-and-correction loop

**Inputs:** two or three keys of a short, controlled animation and the verified document adapter.

**Work:** define the shared project contract and one baseline processor. Produce a small number of intermediate proposals, import them, allow one to be corrected and promoted into an approved key, then regenerate the affected interval. A constrained geometric baseline is acceptable for this phase if its limits are explicit.

**Deliverables:** an end-to-end executable workflow, a job/result manifest, saved approvals, and an example demonstrating revision detection and local regeneration.

**Acceptance:** the corrected key remains intact; source drawings remain available; irrelevant approved frames are not overwritten; a stale result is detected; cancellation works as documented. The demonstration includes actual animation editing rather than only an attractive rendered video.

**If blocked:** use manual correspondences or a narrower test movement to diagnose the interface. Record the broader motion requirement as unresolved. A narrow diagnostic case is not a permanent reduction of product scope.

### Phase 3 — Build still-drawing assistance on the same project model

**Inputs:** rough drawings spanning small gaps, intentional openings, overdrawn lines, varied line weights, and colored region hints.

**Work:** implement procedural gap proposals and boundary masks; evaluate line-simplification or contour-prediction methods; add region filling and palette assignment. Make all outputs inspectable and reversible. Reuse the approval and revision machinery from the animation workflow.

**Deliverables:** usable selection-based cleanup and fill tools, failure examples, parameter defaults justified by tests, and comparisons against the artist's manual workflow.

**Acceptance:** deliberate open visible strokes can remain open while fills are contained; rejected joins can be corrected; approved regions retain identity through a new pass; a chosen cleanup can be accepted without adopting every suggested change.

**If blocked:** separate topology inference from curve rendering and color assignment to identify the failing component. Offer an inexpensive manual region or endpoint hint. Avoid hiding a destructive global smoothing operation behind a vague refinement button.

### Phase 4 — Integrate character references and persistent part identities

**Inputs:** optional character sheets, named palette colors, multiple views, and drawings with clear parts and overlaps.

**Work:** develop reference ingestion and view association; map palette roles to regions; create editable part identities and stacking relationships. Support reference-free operation with documented assumptions. Test whether adding references actually improves the evaluated task.

**Deliverables:** a reference panel, persistent region/part identifiers, a reference-conditioned processing path where supported, and an ablation comparing runs with and without relevant references.

**Acceptance:** the artist can correct an inferred part or color identity; the correction propagates only where appropriate; reference metadata survives project reopening; optional references do not become an undocumented mandatory dependency.

**If blocked:** retain manual tags, palette assignments, or view hints as usable controls while researching improved inference. Do not claim that a static reference sheet determines the intended motion.

### Phase 5 — Advance correspondence, deformation, and visibility

**Inputs:** increasingly difficult keyframe pairs and sequences, with changes in silhouette, overlapping parts, appearing contours, and selected viewpoint changes.

**Work:** compare procedural correspondence and deformation, pretrained predictors, and hybrid approaches. Represent visibility changes and stroke birth, disappearance, split, or merge where needed. Evaluate failures on sequences rather than isolated frames only.

**Deliverables:** one or more replaceable motion backends, interactive correspondence correction, documented supported cases, and a failure taxonomy that distinguishes geometry, identity, occlusion, and missing-action information.

**Acceptance:** the engine produces editable proposals with traceable correspondences; challenging cases are measured honestly; a corrected correspondence can affect the intended interval; alternate backends can be compared on the same inputs.

**If blocked:** preserve manual constraints and additional breakdown inputs. Open a targeted research branch for the repeated failure instead of repeatedly resampling an unsuitable model without diagnosis.

### Phase 6 — Develop sparse drawing selection, timing, and stylized motion

**Inputs:** motion proposals, artist keys, duration, optional event times, drawing budgets, and examples of desired holds or exaggeration.

**Work:** distinguish distinct drawings from playback slots; generate and evaluate candidate exposure schedules; preserve artist-specified events; add controllable trajectories, easing, overshoot, and smear proposals. Keep smear shape generation distinct from motion timing and ordinary blur.

**Deliverables:** editable exposure proposals, meaningful controls for drawing count and timing, several documented timing strategies, and a comparison interface that lets artists assess alternatives at normal playback speed.

**Acceptance:** the requested duration and protected events are respected; deleting a drawing has a defined effect on duration; changing a hold does not silently move a contact; the result can use repeated exposures without pretending each playback slot is a newly drawn pose.

**If blocked:** expose a simpler artist-controlled schedule while testing learned or procedural ranking. Record subjective preference separately from technical consistency. Do not report maximum expressive impact as a mathematically proven property.

### Phase 7 — Stabilize color and organization across the animation

**Inputs:** approved colored keys, reference palettes, region identities, visibility changes, and a sequence containing splits or merged regions.

**Work:** propagate colors and part identities through correspondence; detect uncertain associations; maintain separate line, color, and relevant mask content; repair small missed areas with inspectable proposals. Support multiple approved anchors to reduce error propagation.

**Deliverables:** consistent region/color tracking, editable organization in the target host, and a clear representation for uncertain or unmatched regions.

**Acceptance:** palette assignments are consistent when identity is established; new or ambiguous regions do not silently acquire false certainty; an edited anchor can be reused; exported organization is usable by an artist and survives the tested round trip.

**If blocked:** keep direct artist assignments authoritative and restrict propagation to supported correspondences. Avoid repeatedly recoloring already approved regions to make unrelated frames appear superficially uniform.

### Phase 8 — Run targeted custom-model research when justified

This phase is a research workstream and may run alongside earlier phases once the shared representation and evaluation fixtures exist.

**Inputs:** a documented failure pattern, a reproducible baseline, lawful and attributable training material, and an explicit compute plan.

**Work:** formulate the learning task; compare modification of an existing model, a lightweight adapter, a specialized new network, and a joint predictor when appropriate. Prepare train/validation/test splits, evaluation code, and checkpoint provenance before interpreting improvements.

**Deliverables:** training and inference implementations, data manifests, experiment configurations, checkpoints when permitted, model documentation, and a comparison against the relevant baseline.

**Acceptance:** improvements are demonstrated on held-out examples relevant to the artist workflow; source and license records cover all borrowed material; training runs are reproducible to the stated degree; the model exposes the same engine contract and can be disabled or replaced.

**If blocked:** preserve negative results and the working baseline. Diagnose data, objective, architecture, or resource limitations. Writing network code or obtaining lower training loss does not establish a useful animation capability. A necessary custom component remains in scope even when the first attempt fails.

### Phase 9 — Develop the standalone host when selected

**Activation:** undertake this track if the owner selects standalone delivery initially or later wants a standalone application. If standalone is the initial host, move its necessary host-shell and document-adapter work earlier alongside Phases 1–2. If the selected product remains a Krita plugin, preserve engine portability and leave this phase deferred without blocking a plugin release.

**Inputs:** the shared engine interface and project representation, the chosen document-interchange strategy, and available artist feedback. A completed Krita plugin is not a prerequisite.

**Work:** build the selected standalone workflow for references, drawing selection, previews, corrections, layers, and timing. Decide whether initial `.kra` support uses an installed-Krita bridge or a documented limited importer. Investigate independent native parsing only as a separate fidelity project with representative files and compatibility tests.

**Deliverables:** an installable standalone application and an import/export capability matrix. If both hosts exist, compare their core processing results on shared fixtures; otherwise compare the selected host with the engine's reference fixtures.

**Acceptance:** the application presents editable results and honors approvals; unsupported document features are described accurately; claiming native support requires verification of the native features advertised; one host's UI objects do not leak into the engine contract.

**If blocked:** ship a clearly labeled interchange path while continuing native support work. Do not describe reading a `.kra` thumbnail or merged canvas as retaining native layers and animation.

### Phase 10 — Add optional remote processing

**Inputs:** a stable local engine, measured resource requirements, an authorized hosting plan, and an explicit data-transfer configuration.

**Work:** expose asynchronous jobs through an authenticated service; support progress, cancellation, retries, result retrieval, stale revisions, and automatic cleanup. The user's `banderov.com` domain can provide a stable service address if configured for that purpose. Select compute hosting based on the actual engine requirements.

**Deliverables:** a remote engine adapter, deployment instructions, a job-cost measurement for representative workloads, and a tested recovery path after lost connectivity.

**Acceptance:** the artist chooses remote use; no embedded shared administrator credentials are distributed; retries do not repeatedly apply a result or unnecessarily duplicate work; returning from an interrupted job does not overwrite newer local corrections; local execution remains functional for supported local operations.

**If blocked:** continue local development. Domain ownership supplies an address, not an automatic GPU allocation. Cloudflare can coordinate work using its application, storage, and queue services; the chosen custom GPU model may require another host. Verify current service capabilities when implementing. Public documentation supports [external queue consumers](https://developers.cloudflare.com/queues/configuration/pull-consumers/) and [Cloudflare Tunnel connections](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).

This brief does not authorize buying compute, changing production DNS, publishing an endpoint, or uploading private artwork merely because those actions appear in a future phase. Carry out already authorized preparatory work and obtain any necessary final authorization using concrete deployment and cost information.

### Phase 11 — Package, validate, and release coherent capabilities

**Inputs:** integrated features, compatibility fixtures, the complete attribution registry, and observed artist-workflow results.

**Work:** create installers or portable bundles; pin compatible dependencies; make optional model downloads understandable; validate first launch, update, downgrade where supported, and uninstall behavior. Review the real operation of the `CREDITS` button. Document feature limitations and supported platforms with evidence.

**Deliverables:** versioned packages, user instructions, release notes, dependency notices, source availability required by applicable licenses, and a concise evaluation report.

**Acceptance:** installation works in the supported clean environment; the user can complete a documented drawing or animation workflow; recovery and original preservation are verified; every borrowed component included in or used by the release is represented accurately in credits and notices; experimental features are clearly identified.

**If blocked:** release only the capabilities that satisfy their acceptance criteria while preserving the full roadmap. An experimental branch may remain available with honest labeling. Do not call every implemented feature production ready merely because the application starts.

### Phase 12 — Continue research and improvement without losing state

**Inputs:** new research, artist feedback, benchmark failures, compatibility changes, and the current requirements matrix.

**Work:** periodically refresh relevant primary sources; reproduce promising methods on the existing evaluation cases; prioritize improvements by correction burden and usefulness; maintain regression fixtures; retire unsuitable dependencies through documented replacements.

**Deliverables:** updated research records, new or revised capabilities, preserved negative results, and a clear next-action list.

**Acceptance:** changes improve or deliberately trade off measured properties; old approvals and files remain usable or have an explicit migration path; the project history explains why methods were adopted, rejected, or replaced.

## Installation, resources, and freeware distribution

### Hardware profiles must be measured

Create profiles such as procedural CPU processing, local learned processing, and remote learned processing. These are capability profiles, not invented hardware promises. For each tested profile, record device model, memory, operating system, runtime versions, image dimensions, number of keys, distinct generated drawings, timing settings, peak memory, processing time, and total correction time where available.

Separate model loading time, generation time, transfer time, import time, and artist correction time. A faster generation backend can still produce a slower overall workflow if its outputs require more repair. CPU fallback is meaningful only for operations that actually complete with acceptable behavior; do not imply that every large GPU model has a usable CPU mode merely because its framework accepts a CPU device.

Handle unsupported hardware with a clear capability report and a usable subset of supported operations. Keep optional model downloads separate from mandatory application installation where practical. Verify disk requirements and available space before large downloads, resume interrupted downloads when possible, and validate file checksums. A model being free to download does not make its execution resource-free.

### Distribution and licensing are implementation requirements

The intended product is free for users to obtain and use within the selected distribution model. Select dependencies accordingly. Free access to a paper, free access to weights, permission to modify code, and permission to redistribute a component are different facts. Record each fact separately; attribution alone does not supply a missing permission.

Krita's published policy states that distributed plugins must use the GNU GPL; consult the current [Krita license page](https://krita.org/en/about/license/) when choosing the plugin distribution terms. Determine engine and dependency obligations from the actual integration and licenses. Do not assume that using a separate process automatically settles every licensing question. Preserve source and notice obligations for modified components.

Provide offline-readable credits and license notices. Optional external links may lead to primary sources, but opening the `CREDITS` view must not require an account or a network connection. Make citation metadata travel with experiment records and release manifests, so a future maintainer can reconstruct the sources behind a result.

## Continuous Codex execution and handoff

### Meaning of continuous development

Continuous development means persistent project state, repeatable stages, and productive continuation across authorized Codex sessions. It does not mean that a Markdown file causes an agent to keep running after the session stops. Do not claim unattended or scheduled work is active unless the actual execution environment provides it and it has been configured within the user's authorization.

Within an active authorized session, proceed through useful work autonomously. Do not repeatedly ask whether to continue after every small milestone. Resolve ordinary reversible engineering choices using the brief, existing decisions, and evidence. When a material blocker remains, complete unaffected work, identify the precise blocker, and present the concrete decision or access needed.

### Session startup checklist

1. Read applicable repository instructions and `ARTIST_ANIMATION_ASSISTANT_CODEX_MASTER_SPEC.md`.
2. Read `PROJECT_STATE.md`, `USER_DECISIONS.md`, and `NEXT_ACTIONS.md`.
3. Inspect the current worktree and any pending changes before editing.
4. Identify the active milestone, its acceptance criteria, and the next unresolved risk.
5. Confirm which source, model, and dependency records govern the planned experiment.
6. Choose a bounded unit of progress and execute it.

Do not restart the architecture discussion just because the session is new. Reopen a previous decision when new evidence or user instructions justify doing so, and record the reason.

### Required continuation records

`PROJECT_STATE.md` should answer: what exists, what actually works, what is unverified, what is broken, and which stage is active. Keep it short enough to read at every session start.

`USER_DECISIONS.md` should distinguish explicit user decisions from assistant proposals. Do not convert a tentative recommendation into a user requirement. Preserve the user's full intended scope and the mandatory APA/CREDITS/free-information rule.

`NEXT_ACTIONS.md` should contain concrete actions with inputs, expected output, and a completion condition. Prefer “run the saved exposure fixture against the selected Krita release and record save/reopen behavior” to “improve integration.”

Experiment records should include the question, sources, code revision, data provenance, configuration, procedure, measurements, failure examples, conclusion, and next implication. Record unsuccessful approaches so another session does not repeat them without a reason.

Architecture decisions should contain context, alternatives considered, the selected choice, evidence, consequences, and conditions for reconsideration. Avoid treating an early choice of model or GUI toolkit as irreversible.

### Status vocabulary and honest reporting

Use explicit statuses such as `planned`, `researched`, `implemented`, `tested_locally`, `tested_in_target_host`, `artist_evaluated`, and `release_ready`. Add `blocked` and `deferred` with reasons. These states are not interchangeable.

Each milestone report should state what changed, why it matters to the artist, what was tested, what the evidence supports, what remains uncertain, and the next useful action. Do not claim that screenshots prove editability, that a unit test proves artistic quality, or that a successful library import proves a model is usable on the target computer.

Before pausing, update the continuation files and leave reproducible commands or scripts for the next session. Summarize uncommitted work and artifacts that should not be lost. Preserve the existing repository and the user's unrelated changes. Make the next session able to continue from the current state without reconstructing the entire conversation.

### Evaluation gates that protect the complete goal

Evaluate meaningful properties at the level where they can fail. Document round-trip tests should exercise native features and metadata; correction tests should alter an approved region while a job is running; timing tests should preserve contact moments under exposure changes; model comparisons should use held-out drawings with equivalent artist constraints.

For subjective usefulness, compare complete artist workflows on representative tasks, including setup and repairs. Capture why a proposal was rejected, which parts were kept, and whether the artist would use the feature again. Establish thresholds from the actual workflow and user expectations rather than inventing universal percentages or promised time savings.

Stop optional testing when it no longer resolves a concrete risk. Continue toward the milestone's usable output. Maintain a small set of high-value regression cases as the engine evolves, and expand them when a real failure reveals a missing requirement. The goal is steady progress toward an integrated, correctable assistant with evidence of usefulness.

## Artist interaction and operation contracts

### A concrete editing session

Use this complete session as a recurring product test. It is an original acceptance scenario, not a claim that an existing package already supports the workflow.

1. An artist opens a layered sketch or shot. The application identifies canvas dimensions, color profile, layer visibility, timing, and available reference material. It retains the source.
2. The artist selects a drawing, region, layer group, or interval and chooses an operation. The operation explains the scope it will change. References and previous corrections are included where relevant.
3. The application creates a proposal in the background. The artist can continue editing or cancel. The proposal records the document revision on which it was based.
4. The artist compares the proposal with the source using an overlay, a visibility toggle, or playback. A useful first version can use simple native host controls; an elaborate new interface is unnecessary.
5. The artist accepts a whole proposal or a supported subset, erases a bad line, fixes a fill boundary, chooses the correct part match, or supplies a missing breakdown pose.
6. The artist marks a corrected area as approved or locked. The project records the actual correction and its scope; it does not merely append prose to a prompt.
7. The artist regenerates the affected interval or region. Unrelated accepted work remains intact, and old background jobs cannot overwrite the correction.
8. The artist saves, closes, reopens, and continues. Source references, layer organization, timing, approvals, and provenance survive to the extent claimed by that host's documented support level.
9. The artist opens `CREDITS` and can identify the methods, models, software, and references used for the selected result, as well as earlier experimental work.

Passing this session on a tiny synthetic example establishes integration. Passing it on representative artwork with lower correction effort establishes useful progress. Keep those evidence levels separate.

### Minimum controls, with honest enablement

The initial host should expose a small, understandable set of actions. Controls can be grouped by task and added when their backing operations exist.

| Control | Intended behavior | Required explanation or state |
| --- | --- | --- |
| Inspect input | Show source scope, dimensions, references, and timing. | Indicate any unsupported layer or conversion. |
| Assist lines | Propose consolidation, cleanup, or vector conversion as separate options. | Identify whether output is raster or vector. |
| Assist fills | Propose regions, invisible barriers, and palette assignments. | Make boundary preview and correction available. |
| Assist motion | Generate drawings within a selected interval. | Show key poses, duration, guide availability, and method limits. |
| Adjust timing | Edit drawing exposures and motion emphasis. | Keep playback rate, unique drawings, and duration distinct. |
| Compare | Toggle source, proposal, and approved result. | Do not silently replace the source preview. |
| Accept / reject | Apply or discard a defined proposal scope. | Identify the affected layers or frames. |
| Lock | Protect an explicit drawing, region, stroke, layer, or setting. | Show the lock's scope and how to remove it. |
| Regenerate selection | Recompute a defined dependency region. | Show affected time range and any necessary neighboring context. |
| Cancel | Request cancellation of an active job. | Explain whether cancellation is immediate or pending at a safe interruption point. |
| `CREDITS` | Open offline APA references and notices. | Include tested and retired experiments, with accurate status labels. |

Do not display a working-looking button that produces a placeholder while claiming the feature is available. A disabled planned feature may explain its status. A research prototype should be labeled as such before the artist commits a long computation.

Prefer keyboard access, meaningful focus order, readable text, and indicators that do not rely on color alone. Keep backend logs and technical identifiers in an optional details view. The artist's main questions are what will change, how long the actual measured operation may take, how to inspect it, and how to correct it.

### Suggested engine request

The following JSON illustrates a proposed engine contract. It is not a compatible request to any existing third-party service. Identifiers and hashes below are illustrative. Define and validate the real schema in the implementation.

```json
{
  "schema_version": "0.1",
  "job_id": "job_demo_0042",
  "project_id": "project_demo",
  "document_revision": 18,
  "operation": "propose_inbetweens",
  "scope": {
    "shot_id": "shot_01",
    "start_slot": 0,
    "end_slot_exclusive": 12,
    "layer_ids": ["character_ink", "character_flat"]
  },
  "inputs": {
    "anchors": [
      {
        "anchor_id": "anchor_a",
        "drawing_id": "drawing_a",
        "slot": 0,
        "layer_id": "character_ink"
      },
      {
        "anchor_id": "anchor_b",
        "drawing_id": "drawing_b",
        "slot": 11,
        "layer_id": "character_ink"
      }
    ],
    "reference_ids": ["character_front", "character_palette"],
    "constraint_ids": ["lock_face_a", "hand_path_01"],
    "asset_manifest_id": "assets_revision_18"
  },
  "timing": {
    "fps_numerator": 24,
    "fps_denominator": 1,
    "drawing_budget": {
      "mode": "preference",
      "count": 4,
      "unit": "composited_character_state",
      "scope": "selected_interval",
      "includes_anchor_states": true
    },
    "preserve_duration": true
  },
  "method": {
    "adapter_id": "procedural_motion_baseline",
    "adapter_version": "0.1.0",
    "settings": {
      "allow_smear_proposals": false
    }
  },
  "execution": {
    "target": "local",
    "network_allowed": false,
    "random_seed": 7,
    "budget_profile_id": "interactive_local"
  },
  "attribution": {
    "source_ids": [],
    "component_manifest_id": "components_revision_03"
  }
}
```

An empty `source_ids` array in an example does not waive attribution. An implemented adapter must resolve its relevant source and component records, including indirect dependencies. Treat the requested drawing count as a preference or explicit user constraint according to the selected mode. Never claim that an arbitrary count is the objectively smallest count that preserves impact.

An anchor identifies a particular drawing occurrence at a particular time and layer; the drawing ID alone is insufficient when artwork is reused. Additional anchors may sit outside the editable interval as read-only context if the schema declares that role explicitly. The illustrated budget counts distinct composited character states inside the selected interval, including required anchor states. Separate ink and color layers do not count as separate states, and repeated exposures do not increase this count. Record actual new drawings separately. A different counting convention must be named explicitly; a hard budget that cannot accommodate the required anchors must fail validation or be revised by the artist.

Use an asset manifest instead of allowing an untrusted worker to request arbitrary host filesystem paths. That manifest should identify dimensions, transforms, color representation, permitted assets, and content hashes. The implementation chooses a stable serialization format and versioning policy; JSON is only one candidate.

### Result, applicability, and commit

A completed computation should produce immutable result assets and a separate manifest containing:

- The job and input revision identifiers.
- The actual adapter, model, checkpoint, and dependency versions used.
- Output drawing identifiers, proposed layer assignments, region masks, and exposure changes.
- Coordinate transforms needed to place output back into the document.
- Constraint compliance results and any explicitly unsupported constraint.
- Source and component identifiers for `CREDITS`.
- Measured runtime, relevant memory observations, and execution environment.
- Warnings about clipped content, unresolved matches, or incomplete output.
- A reproducibility statement appropriate to the backend actually used.

Computation success is distinct from permission to apply the result. The host compares the result's base revision with the current document. A stale result may still be previewable, but applying it requires a defined reconciliation path. It must not become the new document simply because the worker finished later.

For a small initial implementation, rejecting stale commits and asking the artist to regenerate is acceptable. Later versions can prove that unrelated edits do not invalidate a result by comparing dependency hashes. Do not begin with a complicated merge system before a concrete workflow requires it.

The application must validate hard locks before committing and reject application of a result that cannot satisfy them. Where practical, enforce locks by composing preserved source content into the final result. A learned model's instruction-following behavior alone is not a hard guarantee. If an operation cannot respect a lock, the artist must explicitly unlock or revise that constraint before proceeding. A warning or ordinary Accept action must not implicitly remove a hard lock.

### Errors and recovery

Use actionable errors tied to the current operation: missing model, unsupported device, invalid input, incompatible document feature, insufficient memory, canceled job, stale revision, unavailable worker, or unsupported license configuration. Preserve the original source and any completed, inspectable partial work.

Do not treat a download retry as permission to select a different license or send artwork to another service. A fallback should be visible and remain within existing user preferences. Prefer a lower-resource procedural operation when it can perform the requested task meaningfully.

Cache only results whose inputs, relevant constraints, method version, and settings match. A cache hit must not resurrect a rejected proposal as approved work. Store enough metadata to explain why a result was reused.

## Evaluation fixtures and measurable acceptance

### Build a small, rights-cleared diagnostic set

Start with synthetic drawings authored for this project and any artwork the owner expressly supplies for testing. Add legally usable external examples with the same source and permissions discipline as code. Public visibility alone does not establish a reusable benchmark license.

Keep diagnostic fixtures small enough to understand by inspection. Their purpose is to reveal a particular failure and its effect on correction work. Later add more realistic shots, styles, and resolutions to assess generalization. Keep training examples separate from held-out evaluation by artist, character, or shot when that separation is relevant.

| Fixture | What it exposes | Evidence to retain |
| --- | --- | --- |
| Closed contour with flat color | Basic import, region assignment, export, and color conversion. | Source and reopened output; palette and pixel checks appropriate to the format. |
| Deliberately open contour | Whether gap logic destroys intentional open line style. | Visible ink versus invisible barrier; artist override. |
| Two nearby endpoints belonging to different objects | False closures caused by distance alone. | Competing proposals and chosen correspondence. |
| Rough contour with construction lines | Confusion between intended outline and exploratory marks. | Cleanup alternatives and correction time. |
| Thin, variable-width, and textured strokes | Loss of style during cleanup or vector conversion. | Preserved details and declared raster/vector limits. |
| Tiny enclosed white region | Unfilled-region detection distinct from an open boundary leak. | Detection precision and false-fill corrections. |
| Overlapping limbs | Depth order and visible-part correspondence. | Occlusion events and local correction behavior. |
| Region that splits or merges over time | Unstable color identities and topology. | Palette mapping before and after the event. |
| Simple translation and rotation | Whether motion basics are correct before difficult generation. | Endpoint preservation, trajectory, and rendering artifacts. |
| Head turn with a newly visible feature | Missing information and disocclusion. | Reference influence and explicitly predicted hidden content. |
| Fast motion with a hold and an accent | Whether timing is expressive rather than uniformly spaced. | Exposure schedule, distinct drawing count, and artist assessment. |
| Accepted face with corrected hand | Whether local regeneration preserves approved content. | Locked-region comparison and affected dependency range. |
| Edit made while a job runs | Stale-result protection. | Event sequence and rejected or reconciled commit. |
| Cancel, restart, save, and reopen | Recovery, persistence, and provenance. | State before and after restart; orphaned job handling. |
| Layered animated Krita document | Actual native round-trip support. | Dimensions, profile, groups, masks, timing, and editability checks. |

A hard-lock test may require exact preservation in the supported native representation. A resampled or converted export may need a declared tolerance. State which representation is compared; do not hide unintended changes behind a broad image-similarity score.

### Measure whole-task usefulness

For each relevant task, compare a manual workflow, a simple baseline, and the proposed assistance. Include input preparation, waiting that blocks the artist, correction, approval, and export. If compute can happen while the artist works elsewhere, distinguish wall-clock duration from active artist effort.

Record:

- Active artist time to an accepted result.
- Number and kinds of corrections, not just the number of mouse clicks.
- Percentage of proposals accepted unchanged, accepted after correction, or rejected.
- Unintended edits to approved content.
- Wrong closures, leaks, missing regions, and palette identity errors.
- Temporal defects, including flicker, identity swaps, and abrupt occlusion changes.
- Number of distinct drawings and total playback duration.
- Measured runtime and resource use for the exact test configuration.
- Artist judgments of readability, style, timing, and impact.

Use numeric thresholds only when justified by the fixture or a user-approved product goal. “No overwriting of a hard-locked source region” is an appropriate invariant. “Every style must be 90% better” is an invented requirement without a defined measurement.

Avoid equating low pixel error with a successful expressive drawing. A plausible smear may intentionally depart from literal geometry. Likewise, a smooth sequence can fail because it loses the intended accent. Compare against the actual artistic task.

### Reference ablations

Where reference conditioning is claimed, compare the same task under controlled variants: no reference, palette only, one view, multiple views, and an artist correction. Keep other settings fixed as far as the method permits. Report where extra information helps and where it is ignored or misused.

A larger reference sheet does not establish the artist's intended motion. Character information and action information are separate inputs. A poor result should identify a useful missing constraint when possible, such as a breakdown drawing, hand path, region match, or depth-order correction.

### Practical release evidence

Each release should maintain a compact requirement matrix:

| Requirement | Implemented scope | Evidence | Remaining limitation | Next action |
| --- | --- | --- | --- | --- |
| REQ-04 | Small-gap boundary proposals on selected raster layers | Fixture run and artist review IDs | Intentional openings require a visible override | Evaluate ambiguous crossing examples |
| REQ-07 | Guided motion on a defined class of shots | Experiment and replay IDs | Large topology changes remain experimental | Test part correspondence or a new learned component |
| REQ-13 | Offline credits viewer with source/component filtering | UI check and manifest validation | Any missing metadata is listed explicitly | Resolve metadata before using the affected component |

These rows are illustrative status examples, not claims about software already built. Replace them with actual findings once implementation begins.

Require meaningful verification for the change being made. A worker protocol change warrants stale-job and cancellation checks. A region algorithm change warrants affected gap/fill fixtures. A formatting-only documentation edit generally does not justify running expensive models.

## Working records and reusable templates

### Experiment record

Use a stable experiment ID and retain failed experiments as useful evidence. A compact record can follow this template:

```markdown
# EXP-0001 — Short descriptive name

Status: proposed / running / completed / inconclusive / abandoned
Requirement IDs:
Question:
Observed failure motivating the experiment:
Hypothesis:
Sources and component IDs:
Free-access and permissions assessment:
Baseline:
Inputs and dataset version:
Training/evaluation separation:
Method and exact configuration:
Hardware and software environment:
Time/compute/storage budget:
Success, failure, and stopping criteria:
Commands or reproducible entry point:
Results and artifact paths:
Artist correction observations:
Limitations and confounders:
Decision:
Follow-up:
```

Not every experiment needs training or a large dataset. Mark irrelevant fields as such and explain why. Register the source before running borrowed code; update the record with what was actually executed afterward.

### Architecture decision record

Use a decision record for choices that are expensive to reverse or affect multiple components:

```markdown
# ADR-0001 — Short decision title

Status: proposed / accepted / superseded
Context and requirement IDs:
Options considered:
Evidence and source IDs:
Decision:
Why this option fits current constraints:
Tradeoffs and known limitations:
Reversal or migration path:
What new evidence would reopen the decision:
Date and implementing revision:
```

Useful first decisions include the initial host, engine transport, project representation, color handling, exposure representation, credits schema, and component licensing policy. Do not create ceremonial records for every small refactor.

### Project state

`PROJECT_STATE.md` must describe reality, not aspiration. Recommended fields:

```markdown
# Project state

Last updated:
Current branch/revision:
Current development phase:
Selected host and tested version:
Implemented capabilities:
Experimental capabilities:
Planned capabilities:
Known failing cases:
Last successful verification:
Environment and dependency versions:
Installed/absent optional models:
Existing user authorizations and preferences:
Open decisions that materially affect work:
Current research hypotheses:
Exact next executable action:
Artifacts and experiment records to inspect:
Stop/blocker conditions:
```

Keep credentials out of this file. Refer to configured credential mechanisms by name where needed. Distinguish “not yet measured” from “unsupported” and “not implemented” from “not possible.”

### Next actions and research backlog

`NEXT_ACTIONS.md` should prioritize a few concrete actions with expected evidence. Keep the complete ambition in a separate requirements/backlog view so a short session list does not accidentally erase long-term goals.

An actionable item states the input, intended change or experiment, verification, and what result determines the next branch. For example: “Run the minimal timeline probe on the installed Krita version; verify a nonuniform hold after save/reopen; record whether the Python API supports the required import path; choose a documented bridge if it does not.”

Avoid vague continuations such as “improve AI.” Prefer a named failure: “The near-side sleeve takes the far-side palette after occlusion; evaluate region correspondence with a persistent part constraint against the current baseline.”

### A useful session report

End a development session with a short factual account:

1. What changed and which requirement it advances.
2. What was run or inspected, with artifact or experiment paths.
3. What the result means for artist usefulness.
4. What remains unverified, failed, or blocked.
5. The next action already recorded for continuation.

A session may legitimately end with a negative research result and a revised method. It must not end by presenting a design document, downloaded dependency, or successful import as proof that the full animation problem has been solved.

## Risks, open choices, and first executable assignment

### Risk register

| Risk | Early diagnostic | Response |
| --- | --- | --- |
| Cleanup changes the artist's style | Compare intentional roughness, width, and construction marks. | Offer local alternatives, preservation controls, and a raster path. |
| A missing boundary causes broad incorrect fills | Test intentional openings and nearby unrelated endpoints. | Separate invisible fill barriers from visible ink; expose overrides. |
| Correspondence fails through occlusion | Use a shot with limb overlap and region splits. | Add explicit part, depth, or breakdown constraints; compare targeted learned methods. |
| Sparse timing removes the action's emphasis | Review holds and accents in playback. | Let the artist lock events and edit exposure; optimize under those constraints. |
| Generated layers are difficult to edit | Ask an artist to correct one failed limb or color region. | Improve grouping, identities, and localized output rather than merely adding layers. |
| A reference model is too large or too costly | Measure a minimal representative inference. | Keep the procedural route usable; evaluate smaller or specialized components. |
| Credits exist but usage rights are unclear | Compare code, weights, base model, data, and dependency records. | Resolve the relevant permission or choose a suitable alternative. |
| Native document support loses information | Save/reopen a representative layered animation. | Use Krita serialization or label the exact limited compatibility. |
| Repeated regeneration undoes corrections | Edit during inference and regenerate a neighboring region. | Enforce revision checks, hard locks, and dependency-scoped application. |
| The project becomes a collection of demos | Run the full editing session on the same project file. | Prioritize integration and artist effort alongside individual research metrics. |

These are engineering problems to investigate. They are not reasons to abandon the integrated objective.

### Choices to resolve through inspection and experiments

The owner has not specified an operating system, graphics card, RAM budget, preferred implementation language, exact Krita version, target resolution, desired public software license, or remote-service budget. Do not invent these as facts.

Inspect the available environment and select reversible defaults where possible. Ask a focused question only when an answer changes an expensive commitment or a needed capability cannot otherwise be determined. Hardware absence in one Codex environment does not prove the owner's machine lacks that hardware.

“Freeware” describes distribution price; it does not by itself choose an open-source license, establish model permissions, or pay for public inference. A usable core should not secretly require a paid service. The optional online path can be added under an explicit operating plan.

### Initial bounded assignment for Codex

On receiving this file in a new development repository, do the following before attempting a large model integration:

1. Read applicable repository instructions and preserve this master specification.
2. Inventory the actual environment, existing code, host availability, and relevant authorized accounts without exposing secrets.
3. Create or update the requirement matrix and continuation records. Retain all twenty requirements and mark unknowns honestly.
4. Refresh the primary-source candidate review. Verify availability, versions, licenses, and relevant model dependencies for candidates chosen for experiments.
5. Implement the source/component registry and a minimal working `CREDITS` view. Populate it with verified entries relevant to the initial work.
6. Run a small host/document feasibility probe and write the result. Test saving and reopening, not just displaying a flattened preview.
7. Implement the simplest complete proposal-and-correction path on a tiny still and a tiny shot using the selected host and engine boundary.
8. Preserve, compare, accept, correct, lock, and regenerate through the same project representation.
9. Record the first actual bottleneck and select the next procedural or learned experiment based on that evidence.
10. Continue through the staged roadmap while the session and authorized resources permit; leave exact continuation state when execution ends.

The initial loop may use deliberately simple algorithms. Label their limits and move forward. It is scaffolding for the complete assistant, including custom research where useful, rather than a redefinition of the owner's ambition.

### Final instruction to the development agent

Build an instrument that helps an artist finish drawings and animation with less repetitive work. Research freely accessible primary sources, make borrowed work visible in APA-formatted `CREDITS`, measure practical results, preserve corrections, and continue improving the integrated system. Keep difficult requirements visible. Prefer concrete, inspectable progress and honest negative results over confident claims unsupported by execution.

## Continuing research and citation maintenance

At the beginning of each substantial research stage, refresh the relevant primary sources, search for newer openly accessible work, and add candidates without erasing the original decision record. “State of the art” must refer to a defined date, task, dataset, and metric; it is not a permanent label attached to whichever model was newest when the project began.

For every new candidate, summarize the actual inputs and outputs, representation, training or inference requirements, reported evaluation, license boundaries, and the specific uncertainty an experiment would resolve. Record whether the whole work was read, only documentation was inspected, or an implementation was executed. Distinguish the authors' claims from observed local results and the development team's hypotheses.

Update the APA source record when metadata become more complete. If an arXiv preprint is later published, keep a record of which version informed an earlier experiment; the final publication can be added as a related source. If a repository changes license, preserve the evidence for the exact historical revision and assess the new one explicitly. Do not infer that a later license retroactively licenses a previously acquired artifact.

Before ending each development session, save the current source registry, component inventory, experiment records, permission decisions, and regenerated credits alongside the code. The next Codex session must be able to distinguish work already performed from proposed experiments without reading the conversation history. Attribution and reproducibility are continuous project records, not a release-week cleanup task.

## Verified seed bibliography and research register

### How to interpret this catalog

Entries are grouped by research topic for navigation in this handoff. The application's APA bibliography export must order its selected references as one consistent reference list. Source IDs are project cross-references and do not form part of the APA reference itself.

These are **seed references for research and planning**. They are not an installed-component list, a promise of compatibility, or a declaration that any code, checkpoint, or dataset has passed a distribution audit. Some entries are documentation, some are papers, and some identify repository or model-card evidence. At the handoff stage, use `consulted` with a planning-purpose note, or `candidate` for an unevaluated implementation or artifact. Record permission-review status separately. Mark a resource `evaluated`, `implemented`, or `shipped` only after that event actually occurs.

The references below were checked on **October 20, 2026**. Repository and documentation references use `n.d.` where a resource-specific publication date was not established. Retrieval dates are supplied for mutable resources. The `n.d.` letter suffixes are assigned within this seed catalog and must be regenerated consistently if its membership changes. Account names in repository entries identify the publishing account, not an assertion that the account is the sole contributor.

### Attribution guidance

#### REF-APA-WEB

American Psychological Association. (n.d.). *Webpage on a website references*. [https://apastyle.apa.org/style-grammar-guidelines/references/examples/webpage-website-references](https://apastyle.apa.org/style-grammar-guidelines/references/examples/webpage-website-references)

#### REF-APA-SAMEAUTHOR

American Psychological Association. (2020). *Citing works with the same author and date*. [https://apastyle.apa.org/style-grammar-guidelines/citations/basic-principles/same-year-author](https://apastyle.apa.org/style-grammar-guidelines/citations/basic-principles/same-year-author)

#### REF-APA-MISSING

American Psychological Association. (2022, July). *Missing reference information*. [https://apastyle.apa.org/style-grammar-guidelines/references/missing-information](https://apastyle.apa.org/style-grammar-guidelines/references/missing-information)

Use: citation formatting and treatment of missing metadata. Neither page grants rights to third-party software, papers, or artwork.

### Krita, editing integration, and procedural baselines

#### REF-KRITA-COLORIZE

Krita. (n.d.-a). *Colorize mask*. Krita Manual. Retrieved October 20, 2026, from [https://docs.krita.org/en/reference_manual/tools/colorize_mask.html](https://docs.krita.org/en/reference_manual/tools/colorize_mask.html)

#### REF-KRITA-CSV

Krita. (n.d.-b). *\*.csv*. Krita Manual. Retrieved October 20, 2026, from [https://docs.krita.org/en/general_concepts/file_formats/file_csv.html](https://docs.krita.org/en/general_concepts/file_formats/file_csv.html)

#### REF-KRITA-API

Krita. (n.d.-c). *Document class reference*. KDE API Reference. Retrieved October 20, 2026, from [https://api.kde.org/legacy/krita/html/classDocument.html](https://api.kde.org/legacy/krita/html/classDocument.html)

#### REF-KRITA-PLUGIN

Krita. (n.d.-d). *How to make a Krita Python plugin*. Krita Manual. Retrieved October 20, 2026, from [https://docs.krita.org/en/user_manual/python_scripting/krita_python_plugin_howto.html](https://docs.krita.org/en/user_manual/python_scripting/krita_python_plugin_howto.html)

#### REF-KRITA-KRA

Krita. (n.d.-e). *\*.kra*. Krita Manual. Retrieved October 20, 2026, from [https://docs.krita.org/en/general_concepts/file_formats/file_kra.html](https://docs.krita.org/en/general_concepts/file_formats/file_kra.html)

#### REF-KRITA-LICENSE

Krita. (n.d.-f). *License for usage*. Retrieved October 20, 2026, from [https://krita.org/en/about/license/](https://krita.org/en/about/license/)

#### REF-KRITA-NODE

Krita. (n.d.-g). *Node class reference*. KDE API Reference. Retrieved October 20, 2026, from [https://api.kde.org/legacy/krita/html/classNode.html](https://api.kde.org/legacy/krita/html/classNode.html)

#### REF-OPENCV-MORPH

OpenCV. (n.d.). *Morphological transformations*. OpenCV Documentation. Retrieved October 20, 2026, from [https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html](https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html)

#### REF-OPENTOONZ-FILL

OpenToonz. (n.d.). *Painting animation levels*. OpenToonz User Manual. Retrieved October 20, 2026, from [https://opentoonz.readthedocs.io/en/latest/painting_animation_levels.html](https://opentoonz.readthedocs.io/en/latest/painting_animation_levels.html)

Use: document and layer integration, file-format research, procedural baseline design, and comparison with existing fill workflows. The legacy Krita API URLs require testing against the chosen supported Krita version. Citing a format description does not prove that an importer preserves every feature.

### Research on cleanup, coloring, and artist interaction

#### REF-PAINTBUCKET

Dai, Y., Li, Q., Zhou, S., Luo, Y., Li, C., & Loy, C. C. (2024). *Paint bucket colorization using anime character color design sheets* [Preprint]. arXiv. [https://doi.org/10.48550/arXiv.2410.19424](https://doi.org/10.48550/arXiv.2410.19424)

Free reading version: [https://arxiv.org/abs/2410.19424](https://arxiv.org/abs/2410.19424)

#### REF-GAPFILL

Kono, M., Maejima, A., Koyama, Y., Sechayk, Y., & Igarashi, T. (2026). No pixel left behind: Filling gaps in anime colorization. In *Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems* (Article 300, pp. 1–19). Association for Computing Machinery. [https://doi.org/10.1145/3772318.3790968](https://doi.org/10.1145/3772318.3790968)

Free reading and project metadata: [https://marc2825.github.io/GapFill/](https://marc2825.github.io/GapFill/)

#### REF-SKETCH-SIMPLIFY

Simo-Serra, E., Iizuka, S., Sasaki, K., & Ishikawa, H. (2016). Learning to simplify: Fully convolutional networks for rough sketch cleanup. *ACM Transactions on Graphics, 35*(4). [https://esslab.jp/~ess/research/sketch/](https://esslab.jp/~ess/research/sketch/)

Metadata note: the authors' public project page provides the publication and free reading links. Add an article number or DOI only after verifying it; do not guess omitted fields.

#### REF-FLATMAGIC

Yan, C., Chung, J. J. Y., Yoon, K., Gingold, Y., Adar, E., & Hong, S. R. (2022). FlatMagic: Improving flat colorization through AI-driven design for digital comic professionals. In *Proceedings of the 2022 CHI Conference on Human Factors in Computing Systems* (Article 380, pp. 1–17). Association for Computing Machinery. [https://doi.org/10.1145/3491102.3502075](https://doi.org/10.1145/3491102.3502075)

Free reading and project metadata: [https://www.cond.org/flatmagic.html](https://www.cond.org/flatmagic.html)

#### REF-DEEPSKETCH

Yan, C., Li, Y., Aneja, D., Fisher, M., Simo-Serra, E., & Gingold, Y. (2024, July 29). *Deep sketch vectorization via implicit surface extraction* [Research overview]. Adobe Research. [https://research.adobe.com/publication/deep-sketch-vectorization-via-implicit-surface-extraction/](https://research.adobe.com/publication/deep-sketch-vectorization-via-implicit-surface-extraction/)

Metadata note: this entry identifies the inspected research overview. Replace or supplement it with the paper's fully verified publication record if that paper is actually used.

#### REF-DEEPSKETCH-CODE

Nauhcnay. (n.d.). *Deep-Sketch-Vectorization* [Source code repository]. GitHub. Retrieved October 20, 2026, from [https://github.com/Nauhcnay/Deep-Sketch-Vectorization](https://github.com/Nauhcnay/Deep-Sketch-Vectorization)

#### REF-BASICPBC

ykdai. (n.d.). *BasicPBC* [Source code repository]. GitHub. Retrieved October 20, 2026, from [https://github.com/ykdai/BasicPBC](https://github.com/ykdai/BasicPBC)

Use: candidate sources for cleanup, color-sheet matching, vectorization, and correction-oriented interface research. BasicPBC's published restrictions must be reviewed for the exact proposed use; it is not a preapproved runtime dependency. A method's paper citation and its code's license are separate records.

### Research on correspondence, layering, and animation

#### REF-ROUGH-INBETWEEN

Even, M., Bénard, P., & Barla, P. (2023). Non-linear rough 2D animation using transient embeddings. *Computer Graphics Forum, 42*, 411–425. [https://doi.org/10.1111/cgf.14771](https://doi.org/10.1111/cgf.14771)

Free reading and project metadata: [https://mostyle.github.io/blog/eg2023/](https://mostyle.github.io/blog/eg2023/)

#### REF-TOONCOMPOSER

Li, L., Wang, G., Zhang, Z., Li, Y., Li, X., Dou, Q., Gu, J., Xue, T., & Shan, Y. (2025). *ToonComposer: Streamlining cartoon production with generative post-keyframing* [Preprint]. arXiv. [https://doi.org/10.48550/arXiv.2508.10881](https://doi.org/10.48550/arXiv.2508.10881)

Free reading version: [https://arxiv.org/abs/2508.10881](https://arxiv.org/abs/2508.10881)

#### REF-LAYERINBETWEEN-CODE

MarkMoHR. (n.d.). *LayerInbetween* [Source code repository]. GitHub. Retrieved October 20, 2026, from [https://github.com/MarkMoHR/LayerInbetween](https://github.com/MarkMoHR/LayerInbetween)

#### REF-LAYERINBETWEEN

Mo, H., Guan, Z., Hu, Y., & Wang, Z. (2026). *LayerInbetween: Occlusion-aware stroke correspondence and inbetweening with automatic layering* [Research project]. [https://mo-haoran.com/LayerInbetween/](https://mo-haoran.com/LayerInbetween/)

Metadata note: this cites the public research project. Do not invent a publication DOI, article identifier, or evaluation result that was not verified.

#### REF-TOONCRAFTER

Xing, J., Liu, H., Xia, M., Zhang, Y., Wang, X., Shan, Y., & Wong, T.-T. (2024). *ToonCrafter: Generative cartoon interpolation* [Preprint]. arXiv. [https://doi.org/10.48550/arXiv.2405.17933](https://doi.org/10.48550/arXiv.2405.17933)

Free reading version: [https://arxiv.org/abs/2405.17933](https://arxiv.org/abs/2405.17933)

Use: alternative representations and experimental baselines. None of these citations establishes that an approach outputs the specific editable Krita layers this project requires, preserves the artist's drawing exactly, or selects expressive exposure timing automatically. Those are implementation and evaluation questions.

### Model acquisition, adaptation, and license evidence

#### REF-DEPTH-LICENSE

DepthAnything. (n.d.). *Depth Anything V2* [Source code repository and model documentation]. GitHub. Retrieved October 20, 2026, from [https://github.com/DepthAnything/Depth-Anything-V2](https://github.com/DepthAnything/Depth-Anything-V2)

#### REF-TOONCRAFTER-MODEL

Doubiiu. (n.d.). *ToonCrafter* [Model card and model repository]. Hugging Face. Retrieved October 20, 2026, from [https://huggingface.co/Doubiiu/ToonCrafter](https://huggingface.co/Doubiiu/ToonCrafter)

#### REF-HF-LICENSE

Hugging Face. (n.d.-a). *Licenses*. Hugging Face Hub Documentation. Retrieved October 20, 2026, from [https://huggingface.co/docs/hub/en/repositories-licenses](https://huggingface.co/docs/hub/en/repositories-licenses)

#### REF-HF-LORA

Hugging Face. (n.d.-b). *LoRA*. PEFT Documentation. Retrieved October 20, 2026, from [https://huggingface.co/docs/peft/main/en/conceptual_guides/lora](https://huggingface.co/docs/peft/main/en/conceptual_guides/lora)

#### REF-HF-HUB

Hugging Face. (n.d.-c). *The model hub*. Hugging Face Hub Documentation. Retrieved October 20, 2026, from [https://huggingface.co/docs/hub/en/models-the-hub](https://huggingface.co/docs/hub/en/models-the-hub)

#### REF-TOONCOMPOSER-CODE

TencentARC. (n.d.-a). *ToonComposer* [Source code repository]. GitHub. Retrieved October 20, 2026, from [https://github.com/TencentARC/ToonComposer](https://github.com/TencentARC/ToonComposer)

#### REF-TOONCOMPOSER-LICENSE

TencentARC. (n.d.-b). *ToonComposer license* [Software license]. GitHub. Retrieved October 20, 2026, from [https://github.com/TencentARC/ToonComposer/blob/main/LICENSE](https://github.com/TencentARC/ToonComposer/blob/main/LICENSE)

Use: acquisition and license-review procedures, adaptation research, and evidence for candidate model components. Depth Anything V2 is a useful concrete reminder to check artifacts separately: its repository documents different licenses for its smaller and larger model weights. An implementation that expects a larger checkpoint cannot be assumed to support a smaller permissively licensed one without adaptation and testing. ([REF-DEPTH-LICENSE](#ref-depth-license))

### Optional remote processing infrastructure

#### REF-CF-TUNNEL

Cloudflare. (2026a, August 4). *Cloudflare Tunnel*. [https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)

#### REF-CF-AI

Cloudflare. (2026b, April 21). *Cloudflare Workers AI*. [https://developers.cloudflare.com/workers-ai/](https://developers.cloudflare.com/workers-ai/)

#### REF-CF-WORKERS

Cloudflare. (2026c, October 12). *Limits* [Workers documentation]. [https://developers.cloudflare.com/workers/platform/limits/](https://developers.cloudflare.com/workers/platform/limits/)

#### REF-CF-QUEUES

Cloudflare. (2026d, July 1). *Pull consumers* [Queues documentation]. [https://developers.cloudflare.com/queues/configuration/pull-consumers/](https://developers.cloudflare.com/queues/configuration/pull-consumers/)

Use: evaluating an optional connected workflow behind the user's domain. These changing documentation pages must be checked again when implementing a service. A domain registration does not provide unrestricted inference hardware, and a provider's free allowance is not a guarantee of free operation at every workload.
