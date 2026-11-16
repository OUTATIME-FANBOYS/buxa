/**
 * The fictional people of Camp Birchwood. Every name is invented and every email uses example.com; nothing here is a real person.
 * The membership state is set by position so the seed is the same every run: campers and guardians are listed in order.
 */
export const CAMP = { name: 'Camp Birchwood', slug: 'camp-birchwood', timezone: 'UTC' } as const;

export type MembershipState = 'valid' | 'expired' | 'revoked' | 'none';

export interface RosterCamper { givenName: string; familyName: string; dateOfBirth: string; membership: MembershipState }
export interface RosterGuardian { givenName: string; email: string; canPickup: boolean; membership: MembershipState }
export interface RosterFamily { surname: string; guardians: RosterGuardian[]; campers: RosterCamper[] }
export interface RosterAdult { givenName: string; familyName: string; email: string; roles: ('instructor' | 'organizer' | 'admin_staff' | 'participant')[]; membership: MembershipState }

const SURNAMES = ['Adeyemi', 'Brandt', 'Castillo', 'Dimitrov', 'Eriksen', 'Fontaine', 'Gupta', 'Halvorsen', 'Ibarra', 'Jensen', 'Kowalski', 'Lindqvist'];
const FIRST_GUARDIANS = ['Helen', 'Marcus', 'Lucia', 'Petar', 'Ingrid', 'Jules', 'Asha', 'Nils', 'Maya', 'Tomas', 'Ewa', 'Sven'];
const SECOND_GUARDIANS = ['Daniel', 'Rosa', 'Ahmed', 'Klara', 'Olaf', 'Claire', 'Ravi', 'Mette', 'Diego', 'Anika', 'Piotr', 'Greta'];
const CHILDREN = ['Owen', 'Mila', 'Theo', 'Ada', 'Finn', 'Noor', 'Leo', 'Iris', 'Kai', 'Sana', 'Eli', 'Rhea', 'Jonah', 'Tara', 'Milo', 'Ines', 'Arlo', 'Vera'];

const slug = (name: string): string => name.toLowerCase();

/** Membership by position: the 5th to 7th campers have lapsed, the 8th is revoked, the 9th never bought one. */
function camperState(index: number): MembershipState {
  if (index >= 4 && index <= 6) return 'expired';
  if (index === 7) return 'revoked';
  if (index === 8) return 'none';
  return 'valid';
}

/** Twelve families: the odd-numbered ones have one child, the even-numbered ones two; a second guardian joins eight of them. */
export function families(): RosterFamily[] {
  let camperIndex = 0;
  return SURNAMES.map((surname, i) => {
    const guardians: RosterGuardian[] = [{
      givenName: FIRST_GUARDIANS[i], email: `${slug(FIRST_GUARDIANS[i])}.${slug(surname)}@example.com`, canPickup: true,
      membership: i === 3 ? 'expired' : 'valid',
    }];
    if (i % 3 !== 2) {
      guardians.push({
        givenName: SECOND_GUARDIANS[i], email: `${slug(SECOND_GUARDIANS[i])}.${slug(surname)}@example.com`, canPickup: i % 2 === 0,
        membership: 'valid',
      });
    }
    const childCount = i % 2 === 0 ? 2 : 1;
    const campers: RosterCamper[] = [];
    for (let c = 0; c < childCount; c++) {
      const birthYear = 2011 + ((camperIndex + c) % 6);
      campers.push({ givenName: CHILDREN[camperIndex % CHILDREN.length], familyName: surname, dateOfBirth: `${birthYear}-06-15`, membership: camperState(camperIndex) });
      camperIndex++;
    }
    return { surname, guardians, campers };
  });
}

/** Staff and adults without a household. */
export const ADULTS: RosterAdult[] = [
  { givenName: 'Priya', familyName: 'Raman', email: 'priya.raman@example.com', roles: ['instructor'], membership: 'valid' },
  { givenName: 'Joel', familyName: 'Okafor', email: 'joel.okafor@example.com', roles: ['instructor'], membership: 'valid' },
  { givenName: 'Mina', familyName: 'Sato', email: 'mina.sato@example.com', roles: ['organizer'], membership: 'valid' },
  { givenName: 'Ben', familyName: 'Hartley', email: 'ben.hartley@example.com', roles: ['admin_staff'], membership: 'valid' },
  { givenName: 'Chloe', familyName: 'Dunmore', email: 'chloe.dunmore@example.com', roles: ['participant'], membership: 'none' },
];

/** Fictional sign-in accounts for the three roles that are not the owner. They cannot sign in; a real account can be linked by email. */
export const STAFF_ACCOUNTS = {
  owner: { name: 'Olive Owner', email: 'olive.owner@example.com' },
  admin: { name: 'Adam Admin', email: 'adam.admin@example.com' },
  staff: { name: 'Sunny Staff', email: 'sunny.staff@example.com' },
  viewer: { name: 'Vic Viewer', email: 'vic.viewer@example.com' },
} as const;
