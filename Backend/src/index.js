// Backward-compatible entrypoint.
// `Backend/server.js` is the real Express listener.
process.env.DMEWS_DELEGATE_TO_SERVER = "1";
require("../server");

