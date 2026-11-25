# Roles and permissions

This is the single reference for who someone is in Buxa. The code, the database and the screens all use these keys and labels. Change this file first, then the code.

## Three separate concepts

- **Users (`users`):** every account that signs in, whatever its relationship to the camp.
- **Person roles (`person_roles`):** a person's function at camp. A person can hold several.
- **Organization access (`org_members.role`):** what a user may do in one camp.

These never stand in for one another. A person role does not change access, and access does not change a person's function.

## Organization access (highest first)

| Key | Label | Can do |
|---|---|---|
| `owner` | Owner | Everything, including deleting the camp and unarchiving sessions |
| `admin` | Admin | Everything except deleting the camp: settings, team access, the audit log |
| `staff` | Staff | Day-to-day camp work: sessions, classes, registration, check-in, rosters, attendance |
| `viewer` | Viewer | Read-only access to the camp data it is allowed to see; no changes |

Only `admin` and `owner` see the audit log.

## Person roles (highest priority first)

| Key | Label | Type | Function |
|---|---|---|---|
| `admin_staff` | Admin staff | Staff | Runs the camp operation |
| `organizer` | Organizer | Staff | Plans the programme |
| `instructor` | Instructor | Staff | Teaches assigned classes; the only role that can be assigned to a class |
| `participant` | Participant | Staff | Takes part in the programme without teaching |
| `guardian` | Parent or guardian | Family | Manages their children |
| `camper` | Camper | Family | Attends camp |

## Priority and display

- When a person has several staff roles, the highest in the table above is their primary role.
- Family roles do not compete with staff roles. A parent who also helps out shows as Guardian and Instructor.

## Rules

1. A person role never changes organization access. An instructor does not get staff or admin access by teaching.
2. Only instructors appear in the class picker, and an instructor can open their assigned classes.
3. Each role key is defined once, in one shared module. UI labels, database values and permission checks all read from it.
4. The `teacher` access level no longer exists. Teaching is the `instructor` person role.

## Migration of existing teacher logins

- The user account is kept.
- Organization access becomes `viewer`.
- The person role becomes `instructor`.
- Access is limited to their assigned classes.
- Before and after, each person's permissions are compared to confirm nobody gains access or loses something they need.
