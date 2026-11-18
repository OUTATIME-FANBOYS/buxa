import { ROUTES } from '@/config/routes';
import { Button } from '@/components/elements/export';

/**
 * Downloads the refused rows of the previewed file as CSV. It shows only when the preview has refused rows; with none, there is no
 * report to download. The file text goes back to the server as a form post, so nothing is kept in the browser.
 */
export function ErrorReportButton({ fileName, text, refused }: { fileName: string; text: string; refused: number }) {
  if (refused === 0) {
    return null;
  }

  return (
    <form method="post" action={ROUTES.classImportErrorReport} className="classes-actions" aria-label="Download the error report">
      <input type="hidden" name="fileName" value={fileName} />
      <input type="hidden" name="csv" value={text} />
      <Button type="submit" className="classes-target">Download error report</Button>
      <span className="muted">One line per problem, with the row number, so you can fix the file.</span>
    </form>
  );
}
