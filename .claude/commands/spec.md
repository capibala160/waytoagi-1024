---
description: Generate a Kiro-style spec with requirements, design, and tasks
argument-hint: <feature description>
---

# Feature Specification Request

Generate a complete Kiro-style specification for: **$ARGUMENTS**

## Instructions

Follow this workflow. For a hackathon, keep each document short — the goal is shared
understanding, not paperwork.

### Step 1: Research Phase
Explore the project to understand:
- Existing patterns and conventions
- Related code this feature will interact with
- Current architecture constraints

### Step 2: Generate Requirements Document
Create `specs/$FEATURE_NAME-requirements.md` with:

```markdown
# [Feature Name] - Requirements

## Overview
Brief description of what this feature does and why it's needed.

## User Stories
- As a [user], I want to [action] so that [benefit]
- (Include 3-5 user stories)

## Functional Requirements
1. FR-1: [Requirement]
2. FR-2: [Requirement]
(Be specific and testable)

## Non-Functional Requirements
- Performance: [targets]
- Compatibility: [constraints]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Out of Scope
- Items explicitly NOT included
```

### Step 3: Generate Design Document
Create `specs/$FEATURE_NAME-design.md` with:

```markdown
# [Feature Name] - Technical Design

## Architecture Overview
How this fits into the existing system.

## Components
### Component 1
- Purpose:
- Location:
- Dependencies:

## Data Flow
Describe how data moves through the system.

## API/Interface Changes
Any new or modified interfaces.

## File Changes
| File | Change Type | Description |
|------|-------------|-------------|
| path/to/file.ts | Modify | Add X functionality |

## Dependencies
- External libraries needed
- Internal modules affected

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Risk 1 | How to handle |

## Alternatives Considered
Why this approach over others.
```

### Step 4: Generate Task List
Create `specs/$FEATURE_NAME-tasks.md` with:

```markdown
# [Feature Name] - Implementation Tasks

## Phase 1: Setup
- [ ] Task 1.1: Description
- [ ] Task 1.2: Description

## Phase 2: Core Implementation
- [ ] Task 2.1: Description
- [ ] Task 2.2: Description

## Phase 3: Integration
- [ ] Task 3.1: Description

## Phase 4: Testing & Polish
- [ ] Task 4.1: Write tests
- [ ] Task 4.2: Test on a real phone viewport
- [ ] Task 4.3: Performance check

## Estimated Complexity
- Files to modify: X
- New files: Y
- Risk level: Low/Medium/High
```

### Step 5: Summary
After creating all files, provide a brief summary with:
- Links to the created files
- Key decisions made
- Any questions that need user input before implementation

## Important
- Use kebab-case for file names (e.g., `combo-meter-requirements.md`)
- Be specific and actionable in tasks
- Reference actual file paths from the project
- Flag any ambiguities that need clarification
