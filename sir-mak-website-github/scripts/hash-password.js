// Prints an ADMIN_PASSWORD_HASH value for .env, plus a fresh SESSION_SECRET.
// Usage: npm run hash-password            (prompts for the password; input is hidden)
//        node scripts/hash-password.js "a long passphrase"
const crypto = require("crypto");
const readline = require("readline");
const { hashPassword } = require("../lib/auth");

function finish(password) {
  if (!password || password.length < 12) {
    console.error("Use a password of at least 12 characters.");
    process.exit(1);
  }
  console.log(`\nADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString("base64url")}\n`);
}

if (process.argv[2]) {
  finish(process.argv[2]);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes("Password")) rl.output.write(s); };
  rl.question("Password for the admin account: ", (pw) => { rl.close(); finish(pw); });
}
