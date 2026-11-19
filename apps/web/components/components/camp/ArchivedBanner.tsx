/** Shown at the top of an archived camp: it can be viewed, and nothing in it can be changed. */
export function ArchivedBanner() {
  return (
    <p className="camp-archived-banner" role="status">
      This camp is archived. You can view it, but you can’t make changes.
    </p>
  );
}
