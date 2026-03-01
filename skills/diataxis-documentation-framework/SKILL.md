---
name: diataxis-documentation-framework
description: Apply the Diátaxis framework to design, audit, rewrite, and restructure technical documentation across tutorials, how-to guides, reference, and explanation.
---

# Diátaxis Documentation Framework

## Overview

Use this skill when documentation needs to be created, improved, or reorganized using the Diátaxis framework.

Diátaxis defines **four distinct documentation modes** based on user need:

- **Tutorials** — learning-oriented, hands-on lessons (study + action)
- **How-to guides** — goal-oriented directions for competent users (work + action)
- **Reference** — factual, neutral technical description (work + cognition)
- **Explanation** — context and reasoning for understanding (study + cognition)

The core rule: **optimize for the user’s need in the current moment**, not for writer convenience or feature-centric structure.

## Core decision tool: the compass

For any page/section, ask:

1. Does it primarily inform **action** or **cognition**?
2. Does it serve **acquisition** (study) or **application** (work)?

Map result:

- action + acquisition → **tutorial**
- action + application → **how-to**
- cognition + application → **reference**
- cognition + acquisition → **explanation**

If content does more than one, split it by mode.

## What to do when applying Diátaxis

1. **Pick one small unit** (page/section/paragraph).
2. **Classify it** with the compass.
3. **Identify contamination** (teaching in how-to, explanation in tutorial, opinion in reference, etc.).
4. **Make one improvement now**:
   - move misplaced text to a better page
   - split mixed content
   - rewrite language to match the mode
   - add links to sibling modes instead of blending them
5. **Publish/commit the small improvement**.
6. Repeat.

Prefer iterative remediation over top-down rewrites.

## Anti-patterns to avoid

- Creating empty top-level sections (Tutorials/How-to/Reference/Explanation) before content is ready
- Treating Diátaxis as a rigid documentation tree instead of a user-need guide
- Mixing tutorial and how-to in one flow
- Turning reference into explanation-heavy prose
- Stuffing explanation pages with procedural steps
- Organizing primarily by feature internals when it harms user findability

## Writing rules by documentation mode

### Tutorials (lesson)

- Audience: learner at study
- Goal: successful learning experience via doing
- Must be:
  - concrete, linear, safe
  - explicit about expected results
  - light on explanation
- Avoid:
  - choices/alternatives
  - deep conceptual digressions
  - reference dumps

Language cues:

- “In this tutorial, we will …”
- “Now do …”
- “You should see …”
- “Notice that …”

### How-to guides (task)

- Audience: competent practitioner at work
- Goal: complete a real task/problem
- Must be:
  - action-focused and outcome-driven
  - adaptable to real-world conditions
  - structured as logical steps (can branch if needed)
- Avoid:
  - teaching basics
  - long explanations
  - exhaustive option catalogs (link to reference)

Language cues:

- “How to …”
- “If you need X, do Y …”
- “In case Z, choose …”

### Reference (facts)

- Audience: user needing accurate facts during work
- Goal: authoritative, scannable technical truth
- Must be:
  - neutral, precise, complete, consistent
  - structured to mirror the product/system
  - standardized in format/patterns
- Avoid:
  - opinions
  - instructional narrative
  - conceptual essays

Language cues:

- “Parameter `foo` (type: string, default: `bar`) …”
- “Returns …”
- “Valid values are …”

### Explanation (understanding)

- Audience: user at study/reflective mode
- Goal: build mental models and context
- Must be:
  - connective (why, trade-offs, history, design intent)
  - allowed to discuss alternatives and perspective
  - tightly bounded by topic
- Avoid:
  - procedural walkthroughs
  - reference-style exhaustive specs

Language cues:

- “Why …”
- “This design chooses X because …”
- “An alternative is … with trade-offs …”

## Migration playbook (existing mixed docs)

When a page is mixed:

1. Keep page title aligned to dominant user need.
2. Extract out-of-mode blocks into new sibling pages:
   - tutorial extras → explanation/reference
   - how-to digressions → explanation/reference
   - reference examples that teach workflow → how-to
3. Replace removed blocks with short links:
   - “For background, see …”
   - “For full option list, see …”
4. Repeat until each page has one clear mode.

## Information architecture guidance

- Start with user journeys and user types, not only product features.
- In complex docs, Diátaxis can appear at multiple levels.
- Landing pages should provide concise overview/context, not raw long lists.
- Keep lists short and chunked; group related content into navigable sets.
- Complex hierarchy is acceptable if it stays logical and mode boundaries remain clear.

## Quality checks

Use two layers:

1. **Functional quality**: accuracy, completeness, consistency, precision.
2. **Deep quality**: flow, fit to user need, feels good to use, anticipates next question.

Diátaxis primarily improves deep quality and helps reveal functional gaps.

## Agent workflow pattern

When asked to apply Diátaxis to a docs set:

1. Inventory pages.
2. Classify each by mode (tutorial/how-to/reference/explanation).
3. Flag mixed pages and boundary violations.
4. Propose minimal incremental edits.
5. Execute small rewrites/moves.
6. Add cross-links between modes.
7. Summarize:
   - what was reclassified
   - what was split
   - what remains for later iterations
