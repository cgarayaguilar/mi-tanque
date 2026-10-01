import {
  assignableRolesFor,
  canManageMember,
  invitableRolesFor,
  ROLES,
} from 'utils/roles'

// Same table as the backend policy (specs/0005, permissions)
test('the owner manages everyone and invites every role but owner', () => {
  expect(invitableRolesFor('owner')).toEqual(['supervisor', 'driver', 'viewer'])
  expect(assignableRolesFor('owner')).toEqual(ROLES)
  expect(ROLES.every(role => canManageMember('owner', role))).toBe(true)
})

test('a supervisor only manages drivers and viewers', () => {
  expect(invitableRolesFor('supervisor')).toEqual(['driver', 'viewer'])
  expect(assignableRolesFor('supervisor')).toEqual(['driver', 'viewer'])
  expect(canManageMember('supervisor', 'supervisor')).toBe(false)
  expect(canManageMember('supervisor', 'owner')).toBe(false)
})

test('drivers, viewers and non-members manage nobody', () => {
  for (const actor of ['driver', 'viewer', null] as const) {
    expect(invitableRolesFor(actor)).toEqual([])
    expect(assignableRolesFor(actor)).toEqual([])
  }
})
