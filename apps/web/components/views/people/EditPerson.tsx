import { PersonScreen } from './PersonScreen';

/**
 * The Edit person address. It shows the person's page with the Edit person pop-up already open, the same pop-up the page's
 * Edit details button opens. Who may edit is decided where the button is (the person page), so a viewer sees the page without it.
 */
export function EditPerson({ id }: { id: string }) {
  return PersonScreen({ id, editOpen: true });
}
