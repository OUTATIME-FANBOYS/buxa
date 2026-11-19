import readline from 'node:readline/promises';

/**
 * Asks the operator to type RESET. Without a terminal there is no one to answer, so the answer is no and the caller must pass --yes.
 */
export async function confirmReset(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Type RESET to delete those rows and seed the camp again: ');

    return answer.trim() === 'RESET';
  } finally {
    rl.close();
  }
}
