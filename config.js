module.exports = {
  BOT_NAME: "ELIAKIM-MD",
  OWNER: ["1234567890@s.whatsapp.net"], // replace with your owner number(s)
  PREFIXES: [".", "!"],
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  SESSION_DIR: "./session",
  PLUGIN_DIR: "./plugins",
  ALLOW_PAIRING_FROM_WEB: true, // allow pairing code to be fetched via web UI

  // Pairing / headless start helpers
  // After you pair a device (using the pairing UI) the bot will generate a short session code
  // and send it to the paired WhatsApp account. Copy that code here (PAIRED_SESSION_CODE)
  // and set LINKED_JID to the phone JID (e.g. 1234567890@s.whatsapp.net).
  //
  // Example:
  // PAIRED_SESSION_CODE: "ABC123",
  // LINKED_JID: "1234567890@s.whatsapp.net"
  //
  // When both values are present and match the saved pairing info, the bot will send
  // an automatic greeting on startup and accept commands headless.
  PAIRED_SESSION_CODE: "", // paste the short session id you received via WhatsApp
  LINKED_JID: "",         // paste your phone JID here (e.g. 1234567890@s.whatsapp.net)
  AUTO_GREETING: true     // if true, send the welcome message automatically on startup when session matches
};
